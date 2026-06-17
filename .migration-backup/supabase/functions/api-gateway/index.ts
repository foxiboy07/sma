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

// Rate limits per plan
const PLAN_LIMITS: Record<string, { requests_per_min: number; contacts_max: number; flows_max: number; features: string[] }> = {
  FREE: { requests_per_min: 30, contacts_max: 500, flows_max: 5, features: ["flows:read", "contacts:read", "contacts:write"] },
  PRO: { requests_per_min: 100, contacts_max: 10000, flows_max: 50, features: ["flows:read", "flows:write", "contacts:read", "contacts:write", "broadcasts:write", "analytics:read", "inbox:read"] },
  LEGEND: { requests_per_min: 300, contacts_max: 999999, flows_max: 999, features: ["flows:read", "flows:write", "contacts:read", "contacts:write", "broadcasts:write", "analytics:read", "inbox:read", "admin"] },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/api-gateway", "");

    // POST /keys - Generate a new API key
    if (req.method === "POST" && path === "/keys") {
      const { tenant_id, name, permissions } = await req.json();

      // Generate API key
      const keyBytes = crypto.getRandomValues(new Uint8Array(32));
      const apiKey = "fp_live_" + Array.from(keyBytes).map(b => b.toString(16).padStart(2, "0")).join("");
      const keyPrefix = apiKey.substring(0, 14);

      // Hash the key for storage
      const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(apiKey));
      const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

      const { data: keyRecord } = await supabase.from("api_keys").insert({
        tenant_id,
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        permissions: permissions || ["flows:read", "contacts:read"],
      }).select("id, key_prefix, permissions, created_at").single();

      return new Response(JSON.stringify({
        id: keyRecord?.id,
        key: apiKey, // Only returned once!
        key_prefix: keyPrefix,
        permissions: keyRecord?.permissions,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /keys - List API keys for a tenant
    if (req.method === "GET" && path === "/keys") {
      const tenantId = url.searchParams.get("tenant_id");

      const { data: keys } = await supabase
        .from("api_keys")
        .select("id, name, key_prefix, permissions, last_used_at, request_count, status, created_at")
        .eq("tenant_id", tenantId)
        .eq("status", "active");

      return new Response(JSON.stringify({ keys }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // DELETE /keys/:id - Revoke an API key
    if (req.method === "DELETE" && path.startsWith("/keys/")) {
      const keyId = path.replace("/keys/", "");

      await supabase.from("api_keys").update({ status: "revoked" }).eq("id", keyId);

      return new Response(JSON.stringify({ status: "revoked" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /contacts - REST API: List contacts
    if (req.method === "GET" && path === "/contacts") {
      const apiKey = req.headers.get("x-api-key") || url.searchParams.get("api_key");
      const authResult = await authenticateApiKey(apiKey, "contacts:read");
      if (!authResult.valid) return unauthorized(authResult.error);

      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
      const offset = (page - 1) * limit;

      const { data: contacts, count } = await supabase
        .from("unified_contacts")
        .select("id, display_name, email, phone, loyalty_score, loyalty_tier, tags, sentiment_score, created_at", { count: "exact" })
        .eq("tenant_id", authResult.tenant_id)
        .is("gdpr_deleted_at", null)
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });

      return new Response(JSON.stringify({
        data: contacts,
        pagination: { page, limit, total: count, pages: Math.ceil((count || 0) / limit) },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /contacts/:id - REST API: Get single contact
    if (req.method === "GET" && path.match(/^\/contacts\/[\w-]+$/)) {
      const contactId = path.replace("/contacts/", "");
      const apiKey = req.headers.get("x-api-key") || url.searchParams.get("api_key");
      const authResult = await authenticateApiKey(apiKey, "contacts:read");
      if (!authResult.valid) return unauthorized(authResult.error);

      const { data: contact } = await supabase
        .from("unified_contacts")
        .select("*")
        .eq("id", contactId)
        .eq("tenant_id", authResult.tenant_id)
        .maybeSingle();

      if (!contact) return new Response(JSON.stringify({ error: "Contact not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: profiles } = await supabase
        .from("platform_profiles")
        .select("platform, platform_username, last_interaction_at")
        .eq("unified_contact_id", contactId);

      return new Response(JSON.stringify({ data: { ...contact, platform_profiles: profiles } }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /flows - REST API: List flows
    if (req.method === "GET" && path === "/flows") {
      const apiKey = req.headers.get("x-api-key") || url.searchParams.get("api_key");
      const authResult = await authenticateApiKey(apiKey, "flows:read");
      if (!authResult.valid) return unauthorized(authResult.error);

      const { data: flows } = await supabase
        .from("flows")
        .select("id, name, status, trigger_type, triggered_count, conversion_count, revenue_attributed, created_at, updated_at")
        .eq("tenant_id", authResult.tenant_id)
        .order("updated_at", { ascending: false });

      return new Response(JSON.stringify({ data: flows }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /flows/:id/trigger - REST API: Manually trigger a flow
    if (req.method === "POST" && path.match(/^\/flows\/[\w-]+\/trigger$/)) {
      const flowId = path.replace("/flows/", "").replace("/trigger", "");
      const apiKey = req.headers.get("x-api-key") || url.searchParams.get("api_key");
      const authResult = await authenticateApiKey(apiKey, "flows:write");
      if (!authResult.valid) return unauthorized(authResult.error);

      const { contact_id } = await req.json();

      const { data: flow } = await supabase
        .from("flows")
        .select("id, tenant_id, brand_id, status")
        .eq("id", flowId)
        .eq("tenant_id", authResult.tenant_id)
        .maybeSingle();

      if (!flow) return new Response(JSON.stringify({ error: "Flow not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (flow.status !== "ACTIVE") return new Response(JSON.stringify({ error: "Flow is not active" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Create flow session
      const { data: triggerNode } = await supabase
        .from("flow_nodes")
        .select("id")
        .eq("flow_id", flowId)
        .eq("node_type", "TRIGGER")
        .maybeSingle();

      const { data: session } = await supabase.from("flow_sessions").insert({
        tenant_id: flow.tenant_id,
        brand_id: flow.brand_id,
        unified_contact_id: contact_id,
        flow_id: flowId,
        current_node_id: triggerNode?.id,
        platform: "INSTAGRAM" as any,
        is_active: true,
      }).select("id").single();

      await supabase.rpc("increment_flow_stats", { p_flow_id: flowId, p_triggered: true });

      return new Response(JSON.stringify({ session_id: session?.id, status: "triggered" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /analytics/overview - REST API: Get analytics
    if (req.method === "GET" && path === "/analytics/overview") {
      const apiKey = req.headers.get("x-api-key") || url.searchParams.get("api_key");
      const authResult = await authenticateApiKey(apiKey, "analytics:read");
      if (!authResult.valid) return unauthorized(authResult.error);

      const days = parseInt(url.searchParams.get("days") || "30");
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data: events } = await supabase
        .from("attribution_events")
        .select("event_type, revenue_attributed, created_at")
        .eq("tenant_id", authResult.tenant_id)
        .gte("created_at", since);

      const totalRevenue = (events || []).filter(e => e.event_type === "PURCHASE_ATTRIBUTED").reduce((s, e) => s + Number(e.revenue_attributed || 0), 0);
      const totalTriggers = (events || []).filter(e => e.event_type === "FLOW_TRIGGERED").length;
      const totalPurchases = (events || []).filter(e => e.event_type === "PURCHASE_ATTRIBUTED").length;

      return new Response(JSON.stringify({
        data: {
          total_revenue: totalRevenue,
          total_flow_triggers: totalTriggers,
          total_purchases: totalPurchases,
          conversion_rate: totalTriggers > 0 ? ((totalPurchases / totalTriggers) * 100).toFixed(1) : "0",
          period_days: days,
        },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /rate-limits - Check current rate limit status
    if (req.method === "GET" && path === "/rate-limits") {
      const apiKey = req.headers.get("x-api-key") || url.searchParams.get("api_key");
      const authResult = await authenticateApiKey(apiKey, "contacts:read");
      if (!authResult.valid) return unauthorized(authResult.error);

      const { data: tenant } = await supabase
        .from("tenants")
        .select("plan")
        .eq("id", authResult.tenant_id)
        .maybeSingle();

      const plan = tenant?.plan || "FREE";
      const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;

      return new Response(JSON.stringify({
        plan,
        requests_per_min: limits.requests_per_min,
        contacts_max: limits.contacts_max,
        flows_max: limits.flows_max,
        features: limits.features,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function authenticateApiKey(apiKey: string | null, requiredPermission: string): Promise<{ valid: boolean; tenant_id?: string; error?: string }> {
  if (!apiKey) return { valid: false, error: "Missing API key" };

  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(apiKey));
  const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

  const { data: keyRecord } = await supabase
    .from("api_keys")
    .select("id, tenant_id, permissions, status")
    .eq("key_hash", keyHash)
    .eq("status", "active")
    .maybeSingle();

  if (!keyRecord) return { valid: false, error: "Invalid API key" };

  if (!keyRecord.permissions?.includes(requiredPermission) && !keyRecord.permissions?.includes("admin")) {
    return { valid: false, error: `Missing permission: ${requiredPermission}` };
  }

  // Update last used and request count
  await supabase.from("api_keys").update({
    last_used_at: new Date().toISOString(),
    request_count: (keyRecord.request_count || 0) + 1,
  }).eq("id", keyRecord.id);

  return { valid: true, tenant_id: keyRecord.tenant_id };
}

function unauthorized(error?: string) {
  return new Response(JSON.stringify({ error: error || "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
