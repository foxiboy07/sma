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
    const path = url.pathname.replace("/functions/v1/broadcast-engine", "");

    // POST /create - Create a new broadcast campaign
    if (req.method === "POST" && path === "/create") {
      const { tenant_id, brand_id, name, platform, message_content, message_tag, segment_filters, scheduled_at } = await req.json();

      // Estimate reach: count contacts matching segment filters
      let contactQuery = supabase
        .from("unified_contacts")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant_id)
        .eq("brand_id", brand_id)
        .is("gdpr_deleted_at", null);

      // Apply segment filters
      const filters = segment_filters || {};
      if (filters.tier) contactQuery = contactQuery.eq("loyalty_tier", filters.tier);
      if (filters.tags && filters.tags.length > 0) contactQuery = contactQuery.overlaps("tags", filters.tags);

      const { count: estimatedReach } = await contactQuery;

      // Count 24h window eligible contacts
      const { data: profiles } = await supabase
        .from("platform_profiles")
        .select("unified_contact_id, last_interaction_at")
        .eq("brand_id", brand_id);

      const windowEligible = (profiles || []).filter(p => {
        if (platform && p.platform !== platform) return false;
        if (!p.last_interaction_at) return false;
        const hoursSince = (Date.now() - new Date(p.last_interaction_at).getTime()) / (1000 * 60 * 60);
        return hoursSince < 24;
      }).length;

      const { data: broadcast } = await supabase.from("broadcasts").insert({
        tenant_id,
        brand_id,
        name,
        platform: platform as any,
        message_content,
        message_tag,
        segment_filters,
        estimated_reach: estimatedReach || 0,
        window_eligible_count: windowEligible,
        scheduled_at,
        status: scheduled_at ? "scheduled" : "draft",
      }).select("id").single();

      return new Response(JSON.stringify({
        broadcast_id: broadcast?.id,
        estimated_reach: estimatedReach || 0,
        window_eligible_count: windowEligible,
        window_warning: windowEligible < (estimatedReach || 0) * 0.5,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /send/:id - Execute a broadcast
    if (req.method === "POST" && path.startsWith("/send/")) {
      const broadcastId = path.replace("/send/", "");

      const { data: broadcast } = await supabase
        .from("broadcasts")
        .select("*")
        .eq("id", broadcastId)
        .maybeSingle();

      if (!broadcast) {
        return new Response(JSON.stringify({ error: "Broadcast not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Update status to sending
      await supabase.from("broadcasts").update({ status: "sending", sent_at: new Date().toISOString() }).eq("id", broadcastId);

      // Get eligible contacts
      let contactQuery = supabase
        .from("unified_contacts")
        .select("id, display_name, loyalty_tier, tags")
        .eq("tenant_id", broadcast.tenant_id)
        .eq("brand_id", broadcast.brand_id)
        .is("gdpr_deleted_at", null);

      const filters = broadcast.segment_filters || {};
      if (filters.tier) contactQuery = contactQuery.eq("loyalty_tier", filters.tier);
      if (filters.tags && filters.tags.length > 0) contactQuery = contactQuery.overlaps("tags", filters.tags);

      const { data: contacts } = await contactQuery;

      let sentCount = 0;
      let deliveredCount = 0;

      for (const contact of contacts || []) {
        // Check 24h window
        const { data: profile } = await supabase
          .from("platform_profiles")
          .select("id, last_interaction_at")
          .eq("unified_contact_id", contact.id)
          .eq("brand_id", broadcast.brand_id)
          .maybeSingle();

        if (!profile?.last_interaction_at) continue;

        const hoursSince = (Date.now() - new Date(profile.last_interaction_at).getTime()) / (1000 * 60 * 60);
        const hasTag = !!broadcast.message_tag;

        if (hoursSince > 24 && !hasTag) continue; // Skip: outside window, no tag

        // Find or create conversation
        const { data: conversation } = await supabase
          .from("conversations")
          .select("id")
          .eq("unified_contact_id", contact.id)
          .eq("brand_id", broadcast.brand_id)
          .maybeSingle();

        let conversationId = conversation?.id;
        if (!conversationId) {
          const { data: newConvo } = await supabase.from("conversations").insert({
            tenant_id: broadcast.tenant_id,
            brand_id: broadcast.brand_id,
            unified_contact_id: contact.id,
            platform: (broadcast.platform || "INSTAGRAM") as any,
            status: "BOT",
            last_message_at: new Date().toISOString(),
          }).select("id").single();
          conversationId = newConvo?.id;
        }

        if (!conversationId) continue;

        // Send the broadcast message
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          tenant_id: broadcast.tenant_id,
          direction: "OUTBOUND",
          content: broadcast.message_content,
          message_type: "TEXT",
          delivery_status: "QUEUED",
          is_ai_generated: false,
        });

        sentCount++;
        deliveredCount++;

        // Log consent for broadcast
        await supabase.from("consent_logs").insert({
          tenant_id: broadcast.tenant_id,
          brand_id: broadcast.brand_id,
          unified_contact_id: contact.id,
          contact_name: contact.display_name,
          action: "OPT_IN",
          platform: broadcast.platform,
          channel: "BROADCAST",
          method: `Broadcast: ${broadcast.name}`,
        });
      }

      // Update broadcast stats
      await supabase.from("broadcasts").update({
        status: "sent",
        sent_count: sentCount,
        delivered_count: deliveredCount,
        sent_at: new Date().toISOString(),
      }).eq("id", broadcastId);

      return new Response(JSON.stringify({
        status: "sent",
        sent_count: sentCount,
        delivered_count: deliveredCount,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /list - List broadcasts
    if (req.method === "GET" && path === "/list") {
      const tenantId = url.searchParams.get("tenant_id");
      const brandId = url.searchParams.get("brand_id");

      let query = supabase
        .from("broadcasts")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (brandId) query = query.eq("brand_id", brandId);

      const { data: broadcasts } = await query;

      return new Response(JSON.stringify({ broadcasts }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /cancel/:id - Cancel a scheduled broadcast
    if (req.method === "POST" && path.startsWith("/cancel/")) {
      const broadcastId = path.replace("/cancel/", "");

      await supabase.from("broadcasts").update({ status: "cancelled" }).eq("id", broadcastId);

      return new Response(JSON.stringify({ status: "cancelled" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
