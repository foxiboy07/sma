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

// Circuit breaker states
const CLOSED = "CLOSED";
const OPEN = "OPEN";
const HALF_OPEN = "HALF_OPEN";

// Rate limit thresholds per platform
const RATE_LIMITS: Record<string, { per_second: number; per_hour: number }> = {
  INSTAGRAM: { per_second: 10, per_hour: 250 },
  FACEBOOK: { per_second: 10, per_hour: 250 },
  TIKTOK: { per_second: 5, per_hour: 100 },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/circuit-breaker", "");

    // POST /check - Check circuit breaker state and rate limits before sending
    if (req.method === "POST" && path === "/check") {
      const { account_id } = await req.json();

      const { data: account } = await supabase
        .from("connected_accounts")
        .select("id, tenant_id, brand_id, platform, circuit_state, circuit_tripped_at, failure_count, health_status")
        .eq("id", account_id)
        .maybeSingle();

      if (!account) {
        return new Response(JSON.stringify({ error: "Account not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let circuitState = account.circuit_state;
      let canSend = true;
      let reason = "";

      // Check circuit breaker state
      if (circuitState === OPEN) {
        const trippedAt = account.circuit_tripped_at ? new Date(account.circuit_tripped_at).getTime() : 0;
        const elapsed = Date.now() - trippedAt;
        const backoffMs = getBackoffDuration(account.failure_count);

        if (elapsed >= backoffMs) {
          // Transition to HALF_OPEN
          circuitState = HALF_OPEN;
          await supabase.from("connected_accounts").update({ circuit_state: "HALF_OPEN" as any }).eq("id", account_id);
          canSend = true;
          reason = "HALF_OPEN: allowing probe message";
        } else {
          canSend = false;
          reason = `OPEN: circuit breaker tripped, retry after ${Math.ceil((backoffMs - elapsed) / 1000)}s`;
        }
      }

      // Check rate limits
      const platform = account.platform;
      const limits = RATE_LIMITS[platform] || RATE_LIMITS.INSTAGRAM;

      // Count messages sent in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: hourCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", account.tenant_id)
        .eq("direction", "OUTBOUND")
        .gte("created_at", oneHourAgo);

      const hourUsage = hourCount || 0;
      const hourPct = (hourUsage / limits.per_hour) * 100;

      let rateLimitStatus = "ok";
      if (hourPct >= 100) {
        rateLimitStatus = "limited";
        canSend = false;
        reason = `Rate limit reached: ${hourUsage}/${limits.per_hour} per hour`;
      } else if (hourPct >= 80) {
        rateLimitStatus = "approaching";
        // Notify if approaching limit
        await supabase.from("notifications").insert({
          tenant_id: account.tenant_id,
          brand_id: account.brand_id,
          type: "account.rate_limit_warning",
          title: "Rate Limit Approaching",
          description: `${platform} account at ${hourPct.toFixed(0)}% of hourly limit`,
          is_read: false,
        });
      }

      return new Response(JSON.stringify({
        can_send: canSend,
        circuit_state: circuitState,
        reason,
        rate_limit: {
          status: rateLimitStatus,
          hour_usage: hourUsage,
          hour_limit: limits.per_hour,
          hour_pct: hourPct.toFixed(1),
          per_second_limit: limits.per_second,
        },
        health_status: account.health_status,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /report-success - Report a successful API call
    if (req.method === "POST" && path === "/report-success") {
      const { account_id } = await req.json();

      const { data: account } = await supabase
        .from("connected_accounts")
        .select("id, circuit_state, failure_count")
        .eq("id", account_id)
        .maybeSingle();

      if (!account) {
        return new Response(JSON.stringify({ error: "Account not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (account.circuit_state === HALF_OPEN) {
        // Probe succeeded - close the circuit
        await supabase.from("connected_accounts").update({
          circuit_state: "CLOSED" as any,
          failure_count: 0,
          health_status: "HEALTHY",
        }).eq("id", account_id);

        await supabase.from("notifications").insert({
          tenant_id: (await supabase.from("connected_accounts").select("tenant_id, brand_id").eq("id", account_id).maybeSingle()).data?.tenant_id,
          brand_id: (await supabase.from("connected_accounts").select("brand_id").eq("id", account_id).maybeSingle()).data?.brand_id,
          type: "account.circuit_closed",
          title: "Circuit Breaker Recovered",
          description: "Account is back to normal operation",
          is_read: false,
        });
      } else if (account.circuit_state === CLOSED) {
        // Reset failure count on success
        await supabase.from("connected_accounts").update({ failure_count: 0 }).eq("id", account_id);
      }

      return new Response(JSON.stringify({ status: "success_recorded" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /report-failure - Report a failed API call
    if (req.method === "POST" && path === "/report-failure") {
      const { account_id, error_code, error_detail } = await req.json();

      const { data: account } = await supabase
        .from("connected_accounts")
        .select("id, tenant_id, brand_id, platform, circuit_state, failure_count")
        .eq("id", account_id)
        .maybeSingle();

      if (!account) {
        return new Response(JSON.stringify({ error: "Account not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const newFailureCount = (account.failure_count || 0) + 1;

      // Check if we should trip the circuit breaker (>15% failure rate over 60s)
      // Simplified: trip if failure_count > 5
      const shouldTrip = newFailureCount > 5;

      if (shouldTrip && account.circuit_state !== OPEN) {
        await supabase.from("connected_accounts").update({
          circuit_state: "OPEN" as any,
          circuit_tripped_at: new Date().toISOString(),
          failure_count: newFailureCount,
        }).eq("id", account_id);

        await supabase.from("notifications").insert({
          tenant_id: account.tenant_id,
          brand_id: account.brand_id,
          type: "account.circuit_open",
          title: "Circuit Breaker Tripped",
          description: `${account.platform} account circuit breaker is OPEN. Outbound messages blocked.`,
          is_read: false,
        });

        // Route pending messages to DLQ
        const { data: pendingSessions } = await supabase
          .from("flow_sessions")
          .select("id, flow_id")
          .eq("is_active", true)
          .limit(50);

        for (const session of pendingSessions || []) {
          await supabase.from("dlq_messages").insert({
            tenant_id: account.tenant_id,
            brand_id: account.brand_id,
            platform: account.platform as any,
            flow_id: session.flow_id,
            error_code: "CIRCUIT_OPEN",
            error_detail: `Circuit breaker tripped for account ${account_id}`,
            status: "PENDING",
          });
        }
      } else if (account.circuit_state === HALF_OPEN) {
        // Probe failed - back to OPEN
        await supabase.from("connected_accounts").update({
          circuit_state: "OPEN" as any,
          circuit_tripped_at: new Date().toISOString(),
          failure_count: newFailureCount,
        }).eq("id", account_id);
      } else {
        await supabase.from("connected_accounts").update({
          failure_count: newFailureCount,
        }).eq("id", account_id);
      }

      return new Response(JSON.stringify({
        status: "failure_recorded",
        failure_count: newFailureCount,
        circuit_state: shouldTrip ? "OPEN" : account.circuit_state,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /status - Get circuit breaker status for all accounts
    if (req.method === "GET" && path === "/status") {
      const tenantId = url.searchParams.get("tenant_id");

      const { data: accounts } = await supabase
        .from("connected_accounts")
        .select("id, platform, platform_username, circuit_state, failure_count, health_status, circuit_tripped_at, last_webhook_at")
        .eq("tenant_id", tenantId);

      return new Response(JSON.stringify({ accounts: accounts || [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function getBackoffDuration(failureCount: number): number {
  // Exponential backoff: 5m → 10m → 20m
  const baseMs = 5 * 60 * 1000;
  const multiplier = Math.min(failureCount, 4);
  return baseMs * Math.pow(2, multiplier - 1);
}
