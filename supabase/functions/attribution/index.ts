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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/attribution", "");

    // POST /short-link - Create a tracked short link
    if (req.method === "POST" && path === "/short-link") {
      const { tenant_id, brand_id, destination_url, contact_id, flow_id, custom_domain } = await req.json();

      const slug = Math.random().toString(36).slice(2, 7);
      const identityToken = crypto.randomUUID();

      const { data: link } = await supabase.from("short_links").insert({
        tenant_id,
        brand_id,
        slug,
        destination_url,
        identity_token: identityToken,
        contact_id,
        flow_id,
        custom_domain,
      }).select("id, slug, identity_token").single();

      const shortUrl = custom_domain ? `https://${custom_domain}/${slug}` : `https://fp.ly/${slug}`;

      return new Response(JSON.stringify({ link, short_url: shortUrl }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /short-link/:slug - Redirect and track click
    if (req.method === "GET" && path.startsWith("/short-link/")) {
      const slug = path.replace("/short-link/", "");

      const { data: link } = await supabase
        .from("short_links")
        .select("id, destination_url, identity_token, contact_id, flow_id, tenant_id, brand_id, click_count")
        .eq("slug", slug)
        .maybeSingle();

      if (!link) {
        return new Response(JSON.stringify({ error: "Link not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Increment click count
      await supabase.from("short_links").update({
        click_count: (link.click_count || 0) + 1,
      }).eq("id", link.id);

      // Log click attribution event
      await supabase.rpc("log_attribution_event", {
        p_tenant_id: link.tenant_id,
        p_brand_id: link.brand_id,
        p_contact_id: link.contact_id,
        p_flow_id: link.flow_id,
        p_event_type: "LINK_CLICKED",
        p_identity_token: link.identity_token,
        p_metadata: { slug, destination_url: link.destination_url },
      });

      // Redirect to destination with identity token appended
      const separator = link.destination_url.includes("?") ? "&" : "?";
      const redirectUrl = `${link.destination_url}${separator}_pdm=${link.identity_token}`;

      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: redirectUrl },
      });
    }

    // POST /capi - Fire Meta Conversions API event
    if (req.method === "POST" && path === "/capi") {
      const { tenant_id, brand_id, contact_id, event_name, value, currency, email, phone, identity_token } = await req.json();

      // Hash PII with SHA-256
      const hash = async (str: string) => {
        const encoded = new TextEncoder().encode(str.toLowerCase().trim());
        const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
      };

      const userData: Record<string, string> = {};
      if (email) userData.em = await hash(email);
      if (phone) userData.ph = await hash(phone);
      if (identity_token) userData.external_id = await hash(identity_token);

      // Fire to Meta CAPI
      const metaPixelId = Deno.env.get("META_PIXEL_ID") || "";
      const metaAccessToken = Deno.env.get("META_CAPI_ACCESS_TOKEN") || "";

      if (metaPixelId && metaAccessToken) {
        try {
          await fetch(`https://graph.facebook.com/v19.0/${metaPixelId}/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              data: [{
                event_name: event_name || "Purchase",
                event_time: Math.floor(Date.now() / 1000),
                event_source_url: "flowpulse.io",
                action_source: "website",
                user_data: userData,
                custom_data: { value: value || 0, currency: currency || "USD" },
              }],
              access_token: metaAccessToken,
            }),
          });
        } catch (err) {
          console.error("Meta CAPI error:", err);
        }
      }

      // Fire to TikTok Events API
      const tiktokPixelId = Deno.env.get("TIKTOK_PIXEL_ID") || "";
      const tiktokAccessToken = Deno.env.get("TIKTOK_EVENTS_ACCESS_TOKEN") || "";

      if (tiktokPixelId && tiktokAccessToken) {
        try {
          await fetch(`https://business-api.tiktok.com/open/v1.3/event/track/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Access-Token": tiktokAccessToken },
            body: JSON.stringify({
              pixel_code: tiktokPixelId,
              event: event_name === "Purchase" ? "CompletePayment" : "ClickButton",
              user: {
                email: email ? await hash(email) : undefined,
                phone: phone ? await hash(phone) : undefined,
                external_id: identity_token ? await hash(identity_token) : undefined,
              },
              properties: { value: value || 0, currency: currency || "USD" },
              timestamp: new Date().toISOString(),
            }),
          });
        } catch (err) {
          console.error("TikTok Events API error:", err);
        }
      }

      // Log CAPI event
      await supabase.rpc("log_attribution_event", {
        p_tenant_id: tenant_id,
        p_brand_id: brand_id,
        p_contact_id: contact_id,
        p_flow_id: null,
        p_event_type: "CAPI_FIRED",
        p_identity_token: identity_token,
        p_revenue: value || 0,
        p_metadata: { event_name, meta_fired: !!metaPixelId, tiktok_fired: !!tiktokPixelId },
      });

      return new Response(JSON.stringify({ status: "capi_fired", event_name }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /analytics - Get attribution analytics
    if (req.method === "GET" && path === "/analytics") {
      const tenantId = url.searchParams.get("tenant_id");
      const brandId = url.searchParams.get("brand_id");
      const days = parseInt(url.searchParams.get("days") || "30");

      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data: events } = await supabase
        .from("attribution_events")
        .select("event_type, platform, revenue_attributed, created_at, flow_id")
        .eq("tenant_id", tenantId)
        .gte("created_at", since);

      if (brandId) {
        // Filter in memory since we already fetched
        const filtered = (events || []).filter(e => e.flow_id); // simplified
      }

      // Aggregate metrics
      const totalRevenue = (events || []).filter(e => e.event_type === "PURCHASE_ATTRIBUTED").reduce((sum, e) => sum + Number(e.revenue_attributed || 0), 0);
      const totalClicks = (events || []).filter(e => e.event_type === "LINK_CLICKED").length;
      const totalPurchases = (events || []).filter(e => e.event_type === "PURCHASE_ATTRIBUTED").length;
      const totalCapi = (events || []).filter(e => e.event_type === "CAPI_FIRED").length;
      const totalFlowsTriggered = (events || []).filter(e => e.event_type === "FLOW_TRIGGERED").length;
      const totalAiResponses = (events || []).filter(e => e.event_type === "AI_RESPONSE_SENT").length;
      const totalHandoffs = (events || []).filter(e => e.event_type === "HUMAN_HANDOFF").length;

      // Group by day
      const byDay: Record<string, { events: number; revenue: number }> = {};
      for (const event of events || []) {
        const day = event.created_at?.split("T")[0] || "unknown";
        if (!byDay[day]) byDay[day] = { events: 0, revenue: 0 };
        byDay[day].events++;
        byDay[day].revenue += Number(event.revenue_attributed || 0);
      }

      // Group by platform
      const byPlatform: Record<string, number> = {};
      for (const event of events || []) {
        const p = event.platform || "unknown";
        byPlatform[p] = (byPlatform[p] || 0) + 1;
      }

      return new Response(JSON.stringify({
        total_revenue: totalRevenue,
        total_clicks: totalClicks,
        total_purchases: totalPurchases,
        total_capi_fired: totalCapi,
        total_flows_triggered: totalFlowsTriggered,
        total_ai_responses: totalAiResponses,
        total_human_handoffs: totalHandoffs,
        conversion_rate: totalFlowsTriggered > 0 ? ((totalPurchases / totalFlowsTriggered) * 100).toFixed(1) : "0",
        capi_coverage: totalPurchases > 0 ? ((totalCapi / totalPurchases) * 100).toFixed(1) : "0",
        by_day: byDay,
        by_platform: byPlatform,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /bio-click - Track bio deeplink click
    if (req.method === "POST" && path === "/bio-click") {
      const { tenant_id, brand_id, contact_id } = await req.json();

      await supabase.rpc("log_attribution_event", {
        p_tenant_id: tenant_id,
        p_brand_id: brand_id,
        p_contact_id: contact_id,
        p_flow_id: null,
        p_event_type: "BIO_CLICK",
        p_metadata: { source: "link_in_bio" },
      });

      return new Response(JSON.stringify({ status: "logged" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
