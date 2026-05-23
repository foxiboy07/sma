import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Simple text chunking: 512 tokens (~2048 chars) with 50-token overlap (~200 chars)
function chunkText(text: string, maxChars: number = 2048, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start >= text.length) break;
    if (end === text.length) break;
  }
  return chunks.filter(c => c.trim().length > 0);
}

// Simple embedding generation (in production, call OpenAI embeddings API)
async function generateEmbedding(text: string): Promise<number[]> {
  // Placeholder: generate a deterministic pseudo-embedding from text hash
  // In production, call: POST https://api.openai.com/v1/embeddings
  const encoded = new TextEncoder().encode(text.slice(0, 500));
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = new Uint8Array(hash);
  const embedding = new Array(1536).fill(0);
  for (let i = 0; i < 1536; i++) {
    embedding[i] = (Math.sin(bytes[i % 32] * (i + 1) * 0.001) + 1) / 2;
  }
  // Normalize
  const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
  return embedding.map(v => v / (norm || 1));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/knowledge-base", "");

    // POST /upload - Upload and index a document
    if (req.method === "POST" && path === "/upload") {
      const { tenant_id, brand_id, name, source_type, source_url, content, strictness } = await req.json();

      // Create document record
      const { data: doc } = await supabase.from("kb_documents").insert({
        tenant_id,
        brand_id,
        name,
        source_type: source_type || "URL",
        source_url,
        index_status: "PENDING",
        strictness: strictness || "BALANCED",
      }).select("id").single();

      if (!doc) {
        return new Response(JSON.stringify({ error: "Failed to create document" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Chunk the content
      const chunks = chunkText(content || "");
      let indexedCount = 0;

      for (let i = 0; i < chunks.length; i++) {
        try {
          const embedding = await generateEmbedding(chunks[i]);
          const tokenCount = Math.ceil(chunks[i].length / 4);

          await supabase.from("kb_chunks").insert({
            tenant_id,
            brand_id,
            document_id: doc.id,
            chunk_index: i,
            content: chunks[i],
            token_count: tokenCount,
            embedding: `[${embedding.join(",")}]`,
          });
          indexedCount++;
        } catch (err) {
          console.error(`Failed to index chunk ${i}:`, err);
        }
      }

      // Update document status
      await supabase.from("kb_documents").update({
        index_status: indexedCount > 0 ? "INDEXED" : "FAILED",
        chunk_count: indexedCount,
        error_message: indexedCount === 0 ? "All chunks failed to index" : null,
      }).eq("id", doc.id);

      return new Response(JSON.stringify({
        document_id: doc.id,
        status: indexedCount > 0 ? "indexed" : "failed",
        chunk_count: indexedCount,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /search - Search KB with vector similarity
    if (req.method === "POST" && path === "/search") {
      const { brand_id, query, match_threshold, match_count, strictness } = await req.json();

      const queryEmbedding = await generateEmbedding(query);

      const { data: results } = await supabase.rpc("match_kb_chunks", {
        query_embedding: queryEmbedding,
        p_brand_id: brand_id,
        p_match_threshold: match_threshold || 0.5,
        p_match_count: match_count || 3,
      });

      // Check strictness
      const maxScore = (results || []).length > 0 ? results[0].similarity : 0;
      let action = "answer";
      if (strictness === "STRICT" && maxScore < 0.75) {
        action = "handoff";
      } else if (strictness === "BALANCED" && maxScore < 0.5) {
        action = "answer_with_disclaimer";
      }

      // Get document names for the chunks
      const docIds = (results || []).map((r: any) => r.document_id);
      const { data: docs } = await supabase
        .from("kb_documents")
        .select("id, name")
        .in("id", docIds);

      const enriched = (results || []).map((r: any) => ({
        ...r,
        document_name: docs?.find((d: any) => d.id === r.document_id)?.name || "Unknown",
      }));

      return new Response(JSON.stringify({
        results: enriched,
        action,
        max_similarity: maxScore,
        strictness,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /test - Test Q&A against KB
    if (req.method === "POST" && path === "/test") {
      const { brand_id, question } = await req.json();

      const queryEmbedding = await generateEmbedding(question);

      const { data: results } = await supabase.rpc("match_kb_chunks", {
        query_embedding: queryEmbedding,
        p_brand_id: brand_id,
        p_match_threshold: 0.3,
        p_match_count: 3,
      });

      const docIds = (results || []).map((r: any) => r.document_id);
      const { data: docs } = await supabase
        .from("kb_documents")
        .select("id, name, strictness")
        .in("id", docIds);

      const strictness = docs?.[0]?.strictness || "BALANCED";
      const maxScore = (results || []).length > 0 ? results[0].similarity : 0;

      let tier = "TIER_1";
      if (maxScore > 0.85 && strictness !== "STRICT") tier = "TIER_1";
      else if (maxScore > 0.5) tier = "TIER_2";
      else tier = "TIER_2";

      return new Response(JSON.stringify({
        question,
        chunks: (results || []).map((r: any) => ({
          document: docs?.find((d: any) => d.id === r.document_id)?.name,
          content_preview: r.content?.substring(0, 200),
          similarity: r.similarity,
        })),
        max_similarity: maxScore,
        recommended_tier: tier,
        strictness,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // DELETE /documents/:id - Delete a document and its chunks
    if (req.method === "DELETE" && path.startsWith("/documents/")) {
      const docId = path.replace("/documents/", "");

      // Delete chunks first
      await supabase.from("kb_chunks").delete().eq("document_id", docId);
      // Delete document
      await supabase.from("kb_documents").delete().eq("id", docId);

      return new Response(JSON.stringify({ status: "deleted" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /documents - List KB documents
    if (req.method === "GET" && path === "/documents") {
      const tenantId = url.searchParams.get("tenant_id");
      const brandId = url.searchParams.get("brand_id");

      let query = supabase
        .from("kb_documents")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (brandId) query = query.eq("brand_id", brandId);

      const { data: documents } = await query;

      return new Response(JSON.stringify({ documents }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
