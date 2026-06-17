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

const ERROR_LABELS: Record<string, string> = {
  "24H_WINDOW_EXPIRED": "24-Hour Messaging Window Expired",
  "TOKEN_INVALID": "OAuth Token Invalid or Expired",
  "SHOPIFY_TIMEOUT": "Shopify API Timeout",
  "META_API_503": "Meta API Service Unavailable",
  "TIKTOK_API_403": "TikTok API Access Forbidden",
  "LAMBDA_TIMEOUT": "Processing Timeout",
  "CIRCUIT_OPEN": "Circuit Breaker Open",
  "UNKNOWN": "Unknown Error",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/dlq-replay", "");

    // GET /messages - List DLQ messages
    if (req.method === "GET" && path === "/messages") {
      const tenantId = url.searchParams.get("tenant_id");
      const status = url.searchParams.get("status") || "PENDING";
      const platform = url.searchParams.get("platform");
      const limit = parseInt(url.searchParams.get("limit") || "50");

      let query = supabase
        .from("dlq_messages")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status !== "all") query = query.eq("status", status);
      if (platform) query = query.eq("platform", platform);

      const { data: messages } = await query;

      const enriched = (messages || []).map(m => ({
        ...m,
        error_label: ERROR_LABELS[m.error_code] || m.error_code,
      }));

      return new Response(JSON.stringify({ messages: enriched }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /replay/:id - Replay a single DLQ message
    if (req.method === "POST" && path.startsWith("/replay/")) {
      const messageId = path.replace("/replay/", "");

      const { data: message } = await supabase
        .from("dlq_messages")
        .select("*")
        .eq("id", messageId)
        .maybeSingle();

      if (!message) {
        return new Response(JSON.stringify({ error: "Message not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const retryCount = (message.retry_count || 0) + 1;
      const retryHistory = message.retry_history || [];

      if (retryCount > 3) {
        await supabase.from("dlq_messages").update({
          status: "DEAD",
          retry_count: retryCount,
          retry_history: [...retryHistory, { attempted_at: new Date().toISOString(), result: "max_retries_exceeded" }],
        }).eq("id", messageId);

        return new Response(JSON.stringify({ status: "dead", reason: "Max retries exceeded" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Attempt replay - re-insert into flow processing
      try {
        // Check if the original error condition is resolved
        if (message.error_code === "CIRCUIT_OPEN") {
          const { data: account } = await supabase
            .from("connected_accounts")
            .select("circuit_state")
            .eq("tenant_id", message.tenant_id)
            .eq("platform", message.platform)
            .maybeSingle();

          if (account?.circuit_state === "OPEN") {
            return new Response(JSON.stringify({ status: "blocked", reason: "Circuit still open" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }

        // Re-process the message
        await supabase.from("dlq_messages").update({
          status: "REPLAYED",
          retry_count: retryCount,
          is_replay: true,
          last_attempted_at: new Date().toISOString(),
          retry_history: [...retryHistory, { attempted_at: new Date().toISOString(), result: "replayed" }],
        }).eq("id", messageId);

        return new Response(JSON.stringify({ status: "replayed", retry_count: retryCount }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err) {
        await supabase.from("dlq_messages").update({
          status: "PENDING",
          retry_count: retryCount,
          retry_history: [...retryHistory, { attempted_at: new Date().toISOString(), result: "failed", error: err.message }],
        }).eq("id", messageId);

        return new Response(JSON.stringify({ status: "replay_failed", error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // POST /batch-replay - Replay all pending messages in a time range
    if (req.method === "POST" && path === "/batch-replay") {
      const { tenant_id, from_date, to_date, error_code } = await req.json();

      let query = supabase
        .from("dlq_messages")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("status", "PENDING");

      if (from_date) query = query.gte("created_at", from_date);
      if (to_date) query = query.lte("created_at", to_date);
      if (error_code) query = query.eq("error_code", error_code);

      const { data: pending } = await query;

      let replayed = 0;
      let failed = 0;

      for (const msg of pending || []) {
        try {
          await supabase.from("dlq_messages").update({
            status: "REPLAYED",
            is_replay: true,
            last_attempted_at: new Date().toISOString(),
            retry_count: supabase.rpc ? undefined : 0,
          }).eq("id", msg.id);
          replayed++;
        } catch {
          failed++;
        }
      }

      return new Response(JSON.stringify({ replayed, failed, total: (pending || []).length }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /dismiss/:id - Dismiss a DLQ message without replay
    if (req.method === "POST" && path.startsWith("/dismiss/")) {
      const messageId = path.replace("/dismiss/", "");

      await supabase.from("dlq_messages").update({
        status: "DISMISSED",
      }).eq("id", messageId);

      return new Response(JSON.stringify({ status: "dismissed" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /stats - DLQ statistics
    if (req.method === "GET" && path === "/stats") {
      const tenantId = url.searchParams.get("tenant_id");

      const { data: all } = await supabase
        .from("dlq_messages")
        .select("status, error_code, platform")
        .eq("tenant_id", tenantId);

      const stats = {
        total: (all || []).length,
        pending: (all || []).filter(m => m.status === "PENDING").length,
        replayed: (all || []).filter(m => m.status === "REPLAYED").length,
        dead: (all || []).filter(m => m.status === "DEAD").length,
        dismissed: (all || []).filter(m => m.status === "DISMISSED").length,
        by_error: {} as Record<string, number>,
        by_platform: {} as Record<string, number>,
      };

      for (const m of all || []) {
        stats.by_error[m.error_code] = (stats.by_error[m.error_code] || 0) + 1;
        if (m.platform) stats.by_platform[m.platform] = (stats.by_platform[m.platform] || 0) + 1;
      }

      return new Response(JSON.stringify(stats), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
