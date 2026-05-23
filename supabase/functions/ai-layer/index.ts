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

// Intent buckets
const INTENT_BUCKETS = [
  "BUY_INTENT", "REFUND_REQUEST", "PRICE_CHECK", "GENERAL_QUESTION",
  "COMPLAINT", "GREETING", "UNSUBSCRIBE", "LINK_REQUEST", "OTHER"
];

// Priority Red trigger phrases
const PRIORITY_RED_PHRASES = [
  "real person", "human", "manager", "refund", "lawyer",
  "this is ridiculous", "cancel", "lawsuit", "speak to someone",
  "terrible", "worst", "unacceptable", "angry", "furious"
];

// Simple keyword-based intent classifier (Tier 1 substitute)
function classifyIntent(text: string): { intent: string; confidence: number } {
  const lower = text.toLowerCase();
  const intentKeywords: Record<string, string[]> = {
    BUY_INTENT: ["buy", "purchase", "order", "checkout", "cart", "want to buy", "how to order"],
    REFUND_REQUEST: ["refund", "return", "money back", "cancel order", "exchange"],
    PRICE_CHECK: ["price", "how much", "cost", "expensive", "cheap", "discount", "coupon"],
    GENERAL_QUESTION: ["how", "what", "when", "where", "why", "do you", "can you"],
    COMPLAINT: ["broken", "damaged", "wrong", "not working", "defective", "disappointed"],
    GREETING: ["hi", "hello", "hey", "good morning", "good evening", "what's up", "sup"],
    UNSUBSCRIBE: ["stop", "unsubscribe", "opt out", "don't message", "remove me"],
    LINK_REQUEST: ["link", "url", "website", "shop", "store", "where to buy"],
  };

  let bestIntent = "OTHER";
  let bestScore = 0;

  for (const [intent, keywords] of Object.entries(intentKeywords)) {
    const score = keywords.filter(kw => lower.includes(kw)).length / keywords.length;
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  const confidence = Math.min(0.95, bestScore * 2 + 0.3);
  return { intent: bestIntent, confidence: bestScore > 0 ? confidence : 0.2 };
}

// Simple sentiment analysis
function analyzeSentiment(text: string): number {
  const lower = text.toLowerCase();
  const positiveWords = ["love", "great", "amazing", "awesome", "thanks", "perfect", "excellent", "best", "happy", "wonderful"];
  const negativeWords = ["hate", "terrible", "awful", "worst", "angry", "frustrated", "disappointed", "broken", "unacceptable", "ridiculous"];

  let score = 0;
  for (const w of positiveWords) if (lower.includes(w)) score += 0.15;
  for (const w of negativeWords) if (lower.includes(w)) score -= 0.2;

  return Math.max(-1, Math.min(1, score));
}

// Check for Priority Red triggers
function checkPriorityRed(text: string, sentiment: number, consecutiveLowConfidence: number): boolean {
  const lower = text.toLowerCase();
  if (sentiment < -0.6) return true;
  if (PRIORITY_RED_PHRASES.some(p => lower.includes(p))) return true;
  if (consecutiveLowConfidence >= 3) return true;
  return false;
}

// Determine LLM tier based on intent
function determineTier(intent: string, confidence: number, strictness: string): { tier: "TIER_1" | "TIER_2"; reason: string } {
  const tier1Intents = ["GREETING", "GENERAL_QUESTION", "UNSUBSCRIBE", "LINK_REQUEST"];
  const tier2Intents = ["BUY_INTENT", "REFUND_REQUEST", "COMPLAINT"];

  if (strictness === "STRICT" && confidence < 0.5) {
    return { tier: "TIER_1", reason: "Low confidence + STRICT mode: skip LLM, trigger human handoff" };
  }

  if (tier1Intents.includes(intent) && confidence > 0.85) {
    return { tier: "TIER_1", reason: "Simple intent with high confidence" };
  }

  if (tier2Intents.includes(intent)) {
    return { tier: "TIER_2", reason: "Complex intent requiring advanced reasoning" };
  }

  if (confidence < 0.5) {
    return { tier: "TIER_2", reason: "Low confidence - route to more capable model" };
  }

  return { tier: "TIER_1", reason: "Default routing" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/ai-layer", "");

    // POST /classify - Classify intent and sentiment for an inbound message
    if (req.method === "POST" && path === "/classify") {
      const { message_text, conversation_id, contact_id, tenant_id, brand_id } = await req.json();

      const intent = classifyIntent(message_text);
      const sentiment = analyzeSentiment(message_text);

      // Get brand persona config
      const { data: brand } = await supabase
        .from("brands")
        .select("persona_name, persona_tone, persona_language, persona_forbidden_topics, persona_unsure_behavior, ai_monthly_budget_usd, ai_budget_alert_pct")
        .eq("id", brand_id)
        .maybeSingle();

      // Check for forbidden topics
      const lower = message_text.toLowerCase();
      const forbidden = brand?.persona_forbidden_topics || [];
      const hitsForbidden = forbidden.some((t: string) => lower.includes(t.toLowerCase()));

      // Get conversation history for consecutive low-confidence check
      const { data: recentMessages } = await supabase
        .from("messages")
        .select("content, is_ai_generated")
        .eq("conversation_id", conversation_id)
        .order("created_at", { ascending: false })
        .limit(10);

      let consecutiveLowConfidence = 0;
      for (const msg of recentMessages || []) {
        if (!msg.is_ai_generated) break;
        consecutiveLowConfidence++;
      }

      // Check Priority Red
      const isPriorityRed = checkPriorityRed(message_text, sentiment, consecutiveLowConfidence);

      if (isPriorityRed) {
        await supabase.from("conversations").update({
          priority_red: true,
          status: "HUMAN",
          sentiment_score: sentiment,
        }).eq("id", conversation_id);

        await supabase.from("notifications").insert({
          tenant_id,
          brand_id,
          type: "inbox.sentiment_alert",
          title: "Priority Red Alert",
          description: `Contact needs human attention. Sentiment: ${sentiment.toFixed(2)}, Intent: ${intent.intent}`,
          is_read: false,
        });

        await supabase.rpc("log_attribution_event", {
          p_tenant_id: tenant_id,
          p_brand_id: brand_id,
          p_contact_id: contact_id,
          p_flow_id: null,
          p_event_type: "HUMAN_HANDOFF",
          p_metadata: { reason: "priority_red", sentiment, intent: intent.intent },
        });
      }

      // Update contact sentiment
      await supabase.from("unified_contacts").update({
        sentiment_score: sentiment,
      }).eq("id", contact_id);

      // Determine LLM tier
      const strictness = "BALANCED";
      const tier = determineTier(intent.intent, intent.confidence, strictness);

      // Log intent classification
      await supabase.rpc("log_attribution_event", {
        p_tenant_id: tenant_id,
        p_brand_id: brand_id,
        p_contact_id: contact_id,
        p_flow_id: null,
        p_event_type: "INTENT_CLASSIFIED",
        p_metadata: { intent: intent.intent, confidence: intent.confidence, sentiment, tier: tier.tier, is_priority_red: isPriorityRed },
      });

      return new Response(JSON.stringify({
        intent: intent.intent,
        confidence: intent.confidence,
        sentiment,
        tier: tier.tier,
        tier_reason: tier.reason,
        is_priority_red: isPriorityRed,
        hits_forbidden: hitsForbidden,
        persona: brand ? { name: brand.persona_name, tone: brand.persona_tone, language: brand.persona_language } : null,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /generate - Generate AI response with RAG and function calling
    if (req.method === "POST" && path === "/generate") {
      const { message_text, conversation_id, contact_id, tenant_id, brand_id, flow_id, tier } = await req.json();

      // Get brand persona
      const { data: brand } = await supabase
        .from("brands")
        .select("persona_name, persona_tone, persona_language, persona_forbidden_topics, persona_unsure_behavior, ai_monthly_budget_usd")
        .eq("id", brand_id)
        .maybeSingle();

      // Check AI budget
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: monthCosts } = await supabase
        .from("ai_audit_logs")
        .select("estimated_cost_usd")
        .eq("tenant_id", tenant_id)
        .gte("created_at", `${currentMonth}-01`);

      const totalSpent = (monthCosts || []).reduce((sum: number, log: any) => sum + Number(log.estimated_cost_usd), 0);
      const budgetCap = Number(brand?.ai_monthly_budget_usd) || 100;
      const forceTier1 = totalSpent >= budgetCap;

      const effectiveTier = forceTier1 ? "TIER_1" : (tier || "TIER_1");

      // RAG: Retrieve relevant KB chunks
      let kbChunks: any[] = [];
      let similarityScores: number[] = [];

      // Get KB documents for this brand
      const { data: kbDocs } = await supabase
        .from("kb_documents")
        .select("id, name, strictness")
        .eq("brand_id", brand_id)
        .eq("index_status", "INDEXED");

      if (kbDocs && kbDocs.length > 0) {
        // For now, do text-based search (in production, use pgvector match_kb_chunks)
        const docIds = kbDocs.map(d => d.id);
        const { data: chunks } = await supabase
          .from("kb_chunks")
          .select("id, document_id, content, chunk_index")
          .in("document_id", docIds)
          .limit(5);

        // Simple keyword matching for relevance
        const lower = message_text.toLowerCase();
        const words = lower.split(/\s+/).filter(w => w.length > 3);
        const scored = (chunks || []).map(chunk => {
          const chunkLower = chunk.content.toLowerCase();
          const matchCount = words.filter(w => chunkLower.includes(w)).length;
          const score = words.length > 0 ? matchCount / words.length : 0;
          return { ...chunk, score: Math.min(0.99, score + 0.3) };
        }).filter(c => c.score > 0.3).sort((a, b) => b.score - a.score).slice(0, 3);

        kbChunks = scored;
        similarityScores = scored.map(c => c.score);

        // Check strictness
        const strictness = kbDocs[0]?.strictness || "BALANCED";
        if (strictness === "STRICT" && (similarityScores[0] || 0) < 0.75) {
          // Don't answer - trigger human handoff
          return new Response(JSON.stringify({
            response: null,
            action: "handoff",
            reason: "KB_STRICT_LOW_CONFIDENCE",
            kb_chunks: kbChunks,
            similarity_scores: similarityScores,
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // Build system prompt with persona + KB context
      const personaName = brand?.persona_name || "Assistant";
      const personaTone = brand?.persona_tone || "friendly";
      const personaLang = brand?.persona_language || "en";
      const forbiddenTopics = brand?.persona_forbidden_topics || [];

      const systemPrompt = `You are ${personaName}, a ${personaTone} assistant for this brand. Language: ${personaLang}.
${forbiddenTopics.length > 0 ? `NEVER discuss these topics: ${forbiddenTopics.join(", ")}.` : ""}
${kbChunks.length > 0 ? `Knowledge Base context:\n${kbChunks.map((c, i) => `[Chunk ${i + 1}]: ${c.content}`).join("\n\n")}` : ""}
If unsure, ${brand?.persona_unsure_behavior || "hand off to a human"}.
Respond concisely and helpfully.`;

      // Generate response (in production, call OpenAI/Anthropic API)
      // For now, generate a contextual response based on intent + KB
      const intent = classifyIntent(message_text);
      let responseText = "";

      if (intent.intent === "GREETING") {
        responseText = `Hi there! I'm ${personaName}, how can I help you today?`;
      } else if (intent.intent === "BUY_INTENT" && kbChunks.length > 0) {
        responseText = kbChunks[0].content.substring(0, 200) + "... Would you like me to help you with that?";
      } else if (intent.intent === "PRICE_CHECK" && kbChunks.length > 0) {
        responseText = `Based on our info: ${kbChunks[0].content.substring(0, 150)}... Let me know if you need more details!`;
      } else if (intent.intent === "REFUND_REQUEST") {
        responseText = "I'm sorry to hear that. Let me connect you with our support team who can help with your refund request right away.";
      } else if (kbChunks.length > 0) {
        responseText = `Here's what I found: ${kbChunks[0].content.substring(0, 200)}... Anything else I can help with?`;
      } else {
        responseText = `Thanks for your message! I'm ${personaName} and I'd be happy to help. Could you tell me a bit more about what you're looking for?`;
      }

      // Estimate token usage and cost
      const inputTokens = Math.ceil(systemPrompt.length / 4) + Math.ceil(message_text.length / 4);
      const outputTokens = Math.ceil(responseText.length / 4);
      const totalTokens = inputTokens + outputTokens;
      const costPerToken = effectiveTier === "TIER_1" ? 0.00000015 : 0.000003;
      const estimatedCost = totalTokens * costPerToken;

      // Log AI audit
      await supabase.from("ai_audit_logs").insert({
        tenant_id,
        conversation_id,
        contact_id,
        flow_id,
        model_tier: effectiveTier as any,
        prompt_text: systemPrompt,
        kb_chunks_retrieved: kbChunks.map(c => ({ document_id: c.document_id, chunk_index: c.chunk_index, content_preview: c.content.substring(0, 100) })),
        function_calls: [],
        response_text: responseText,
        token_count: totalTokens,
        estimated_cost_usd: estimatedCost,
        similarity_scores: similarityScores,
        intent_classified: intent.intent,
      });

      // Log attribution
      await supabase.rpc("log_attribution_event", {
        p_tenant_id: tenant_id,
        p_brand_id: brand_id,
        p_contact_id: contact_id,
        p_flow_id: flow_id,
        p_event_type: "AI_RESPONSE_SENT",
        p_metadata: { tier: effectiveTier, tokens: totalTokens, cost: estimatedCost, intent: intent.intent },
      });

      // Create outbound message
      await supabase.from("messages").insert({
        conversation_id,
        tenant_id,
        direction: "OUTBOUND",
        content: responseText,
        message_type: "TEXT",
        delivery_status: "QUEUED",
        is_ai_generated: true,
        ai_tier_used: effectiveTier as any,
        ai_token_cost: totalTokens,
      });

      return new Response(JSON.stringify({
        response: responseText,
        tier: effectiveTier,
        intent: intent.intent,
        confidence: intent.confidence,
        kb_chunks: kbChunks.length,
        similarity_scores: similarityScores,
        tokens: totalTokens,
        cost_usd: estimatedCost,
        budget_spent: totalSpent + estimatedCost,
        budget_cap: budgetCap,
        budget_forced_tier1: forceTier1,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /function-call - Execute a function call (Tier 2 only)
    if (req.method === "POST" && path === "/function-call") {
      const { function_name, input, tenant_id, brand_id, contact_id, conversation_id } = await req.json();

      let output: any = null;
      let success = false;

      switch (function_name) {
        case "get_order_status": {
          // In production, call Shopify API
          output = { status: "shipped", tracking_number: "1Z999AA10123456784", estimated_delivery: "2 days" };
          success = true;
          break;
        }
        case "book_appointment": {
          // In production, call Calendly API
          output = { booked: true, date: input.date, time: "10:00 AM", confirmation_id: "CAL-" + Date.now() };
          success = true;
          break;
        }
        case "get_product_info": {
          // In production, call Shopify/TikTok Shop API
          output = { name: "Blue Hoodie", price: 48.00, stock: "in_stock", sku: "BH-001" };
          success = true;
          break;
        }
        case "get_tiktok_inventory": {
          output = { product_id: input.product_id, stock: 142, price: 48.00 };
          success = true;
          break;
        }
        case "custom_webhook": {
          try {
            const res = await fetch(input.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(input.payload),
            });
            output = { status: res.status, response: await res.text().catch(() => "") };
            success = res.status < 400;
          } catch (err) {
            output = { error: err.message };
            success = false;
          }
          break;
        }
        default: {
          output = { error: "Unknown function" };
        }
      }

      // Log function call to AI audit
      await supabase.from("ai_audit_logs").insert({
        tenant_id,
        conversation_id,
        contact_id,
        model_tier: "TIER_2",
        prompt_text: "",
        function_calls: [{ name: function_name, input, output, success }],
        response_text: "",
        token_count: 0,
        estimated_cost_usd: 0.0005,
      });

      return new Response(JSON.stringify({ function_name, output, success }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /budget - Get AI budget usage for a tenant
    if (req.method === "GET" && path === "/budget") {
      const tenantId = url.searchParams.get("tenant_id");
      const brandId = url.searchParams.get("brand_id");

      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: logs } = await supabase
        .from("ai_audit_logs")
        .select("estimated_cost_usd, model_tier, token_count")
        .eq("tenant_id", tenantId)
        .eq("brand_id", brandId)
        .gte("created_at", `${currentMonth}-01`);

      const totalCost = (logs || []).reduce((sum: number, l: any) => sum + Number(l.estimated_cost_usd), 0);
      const totalTokens = (logs || []).reduce((sum: number, l: any) => sum + (l.token_count || 0), 0);
      const tier1Count = (logs || []).filter(l => l.model_tier === "TIER_1").length;
      const tier2Count = (logs || []).filter(l => l.model_tier === "TIER_2").length;

      const { data: brand } = await supabase
        .from("brands")
        .select("ai_monthly_budget_usd, ai_budget_alert_pct")
        .eq("id", brandId)
        .maybeSingle();

      const budgetCap = Number(brand?.ai_monthly_budget_usd) || 100;
      const alertPct = brand?.ai_budget_alert_pct || 80;

      return new Response(JSON.stringify({
        total_cost_usd: totalCost.toFixed(4),
        total_tokens: totalTokens,
        tier1_calls: tier1Count,
        tier2_calls: tier2Count,
        budget_cap: budgetCap,
        budget_used_pct: ((totalCost / budgetCap) * 100).toFixed(1),
        alert_threshold: alertPct,
        over_budget: totalCost >= budgetCap,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
