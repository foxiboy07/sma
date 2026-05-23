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
    const path = url.pathname.replace("/functions/v1/gdpr-compliance", "");

    // POST /export - Export all data for a contact (GDPR Art. 15)
    if (req.method === "POST" && path === "/export") {
      const { contact_id, tenant_id, brand_id } = await req.json();

      const [contact, profiles, conversations, messages, attribution, consentLogs] = await Promise.all([
        supabase.from("unified_contacts").select("*").eq("id", contact_id).maybeSingle(),
        supabase.from("platform_profiles").select("*").eq("unified_contact_id", contact_id),
        supabase.from("conversations").select("id, platform, status, created_at, last_message_at").eq("unified_contact_id", contact_id),
        supabase.from("messages").select("content, direction, message_type, is_ai_generated, created_at").in("conversation_id",
          (await supabase.from("conversations").select("id").eq("unified_contact_id", contact_id)).data?.map((c: any) => c.id) || []),
        supabase.from("attribution_events").select("event_type, platform, revenue_attributed, created_at").eq("unified_contact_id", contact_id),
        supabase.from("consent_logs").select("action, platform, channel, method, created_at").eq("unified_contact_id", contact_id),
      ]);

      const exportData = {
        export_date: new Date().toISOString(),
        contact: contact.data,
        platform_profiles: profiles.data,
        conversations: conversations.data,
        messages: messages.data,
        attribution_events: attribution.data,
        consent_logs: consentLogs.data,
      };

      // Log the export
      await supabase.from("consent_logs").insert({
        tenant_id,
        brand_id,
        unified_contact_id: contact_id,
        contact_name: contact.data?.display_name,
        action: "DATA_EXPORT",
        method: "Self-service data request",
        metadata: { sections: Object.keys(exportData) },
      });

      return new Response(JSON.stringify(exportData), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /erase - Erase/anonymize contact data (GDPR Art. 17)
    if (req.method === "POST" && path === "/erase") {
      const { contact_id, tenant_id, brand_id } = await req.json();

      // Soft-delete: set gdpr_deleted_at and null out PII
      await supabase.from("unified_contacts").update({
        display_name: "ANONYMIZED",
        email: null,
        phone: null,
        tags: [],
        custom_fields: {},
        zero_party_signals: {},
        notes: "",
        gdpr_deleted_at: new Date().toISOString(),
      }).eq("id", contact_id);

      // Anonymize platform profiles
      await supabase.from("platform_profiles").update({
        platform_username: "ANONYMIZED",
      }).eq("unified_contact_id", contact_id);

      // Purge message content
      const { data: convos } = await supabase.from("conversations").select("id").eq("unified_contact_id", contact_id);
      for (const convo of convos || []) {
        await supabase.from("messages").update({ content: "[REDACTED]" }).eq("conversation_id", convo.id);
      }

      // Log the erasure
      await supabase.from("consent_logs").insert({
        tenant_id,
        brand_id,
        unified_contact_id: contact_id,
        action: "SOFT_DELETE",
        method: "Right to erasure request",
        metadata: { fields_anonymized: ["display_name", "email", "phone", "custom_fields", "notes"] },
      });

      return new Response(JSON.stringify({ status: "erased", contact_id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /consent - Log a consent event
    if (req.method === "POST" && path === "/consent") {
      const { tenant_id, brand_id, contact_id, contact_name, action, platform, channel, ip_address, method } = await req.json();

      const { data: log } = await supabase.from("consent_logs").insert({
        tenant_id,
        brand_id,
        unified_contact_id: contact_id,
        contact_name,
        action,
        platform,
        channel,
        ip_address,
        method,
      }).select("id").single();

      return new Response(JSON.stringify({ id: log?.id, status: "logged" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /consent-logs - Retrieve consent audit log
    if (req.method === "GET" && path === "/consent-logs") {
      const tenantId = url.searchParams.get("tenant_id");
      const contactId = url.searchParams.get("contact_id");
      const limit = parseInt(url.searchParams.get("limit") || "50");

      let query = supabase
        .from("consent_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (contactId) query = query.eq("unified_contact_id", contactId);

      const { data: logs } = await query;

      return new Response(JSON.stringify({ logs }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /compliance-status - Get compliance status for a tenant
    if (req.method === "GET" && path === "/compliance-status") {
      const tenantId = url.searchParams.get("tenant_id");

      const { data: contacts } = await supabase
        .from("unified_contacts")
        .select("id, gdpr_deleted_at")
        .eq("tenant_id", tenantId);

      const total = (contacts || []).length;
      const deleted = (contacts || []).filter(c => c.gdpr_deleted_at).length;
      const active = total - deleted;

      const { data: consentLogs } = await supabase
        .from("consent_logs")
        .select("action")
        .eq("tenant_id", tenantId);

      const optIns = (consentLogs || []).filter(l => l.action === "OPT_IN").length;
      const optOuts = (consentLogs || []).filter(l => l.action === "OPT_OUT").length;
      const consentRate = total > 0 ? (((total - optOuts) / total) * 100).toFixed(1) : "100";

      const { data: pendingDsars } = await supabase
        .from("consent_logs")
        .select("id")
        .eq("tenant_id", tenantId)
        .in("action", ["DATA_EXPORT", "SOFT_DELETE"])
        .order("created_at", { ascending: false });

      return new Response(JSON.stringify({
        compliant: true,
        total_contacts: total,
        active_contacts: active,
        gdpr_deleted: deleted,
        consent_rate: consentRate,
        opt_ins: optIns,
        opt_outs: optOuts,
        pending_dsars: (pendingDsars || []).length,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
