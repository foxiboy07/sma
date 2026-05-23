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
    const path = url.pathname.replace("/functions/v1/realtime-events", "");

    // POST /emit - Emit a real-time event (stores notification + logs)
    if (req.method === "POST" && path === "/emit") {
      const { tenant_id, brand_id, user_id, event_type, title, description, action_url, metadata } = await req.json();

      const { data: notification } = await supabase.from("notifications").insert({
        tenant_id,
        brand_id,
        user_id,
        type: event_type,
        title,
        description,
        action_url,
        is_read: false,
      }).select("id, type, title, description, is_read, created_at").single();

      // Also log to attribution events for audit trail
      if (metadata) {
        await supabase.rpc("log_attribution_event", {
          p_tenant_id: tenant_id,
          p_brand_id: brand_id,
          p_contact_id: null,
          p_flow_id: null,
          p_event_type: "MESSAGE_SENT",
          p_metadata: { event_type, notification_id: notification?.id, ...metadata },
        });
      }

      return new Response(JSON.stringify({ notification }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /notifications - Get unread notifications for a user
    if (req.method === "GET" && path === "/notifications") {
      const userId = url.searchParams.get("user_id");
      const tenantId = url.searchParams.get("tenant_id");
      const unreadOnly = url.searchParams.get("unread_only") === "true";
      const limit = parseInt(url.searchParams.get("limit") || "50");

      let query = supabase
        .from("notifications")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (userId) query = query.eq("user_id", userId);
      if (unreadOnly) query = query.eq("is_read", false);

      const { data: notifications } = await query;

      return new Response(JSON.stringify({ notifications }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /notifications/:id/read - Mark notification as read
    if (req.method === "POST" && path.match(/^\/notifications\/[\w-]+\/read$/)) {
      const notifId = path.replace("/notifications/", "").replace("/read", "");

      await supabase.from("notifications").update({ is_read: true }).eq("id", notifId);

      return new Response(JSON.stringify({ status: "read" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /notifications/mark-all-read - Mark all notifications as read
    if (req.method === "POST" && path === "/notifications/mark-all-read") {
      const { tenant_id, user_id } = await req.json();

      await supabase.from("notifications").update({ is_read: true })
        .eq("tenant_id", tenant_id)
        .eq("is_read", false);

      if (user_id) {
        await supabase.from("notifications").update({ is_read: true })
          .eq("user_id", user_id)
          .eq("is_read", false);
      }

      return new Response(JSON.stringify({ status: "all_read" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /unread-count - Get unread notification count
    if (req.method === "GET" && path === "/unread-count") {
      const tenantId = url.searchParams.get("tenant_id");
      const userId = url.searchParams.get("user_id");

      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("is_read", false);

      return new Response(JSON.stringify({ unread_count: count || 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /event-types - List all supported event types
    if (req.method === "GET" && path === "/event-types") {
      const eventTypes = [
        { type: "inbox.new_message", description: "New DM arrives in any connected account", category: "Inbox" },
        { type: "inbox.message_read", description: "Read receipt from platform", category: "Inbox" },
        { type: "inbox.typing", description: "User is typing indicator", category: "Inbox" },
        { type: "inbox.sentiment_alert", description: "Priority Red handoff trigger", category: "Inbox" },
        { type: "flow.edit.cursor_move", description: "Multiplayer cursor position", category: "Flow Builder" },
        { type: "flow.edit.node_update", description: "Node property changed by another user", category: "Flow Builder" },
        { type: "flow.edit.conflict_resolved", description: "CRDT merge notification", category: "Flow Builder" },
        { type: "account.token_broken", description: "Token health alert", category: "Accounts" },
        { type: "account.token_refreshed", description: "Successful token refresh", category: "Accounts" },
        { type: "account.circuit_open", description: "Circuit breaker tripped", category: "Accounts" },
        { type: "account.rate_limit_warning", description: "Approaching rate limit", category: "Accounts" },
        { type: "account.missing_scopes", description: "Missing required permissions", category: "Accounts" },
        { type: "dlq.message_added", description: "New message in DLQ", category: "DLQ" },
        { type: "dlq.message_replayed", description: "DLQ message reprocessed", category: "DLQ" },
        { type: "kb.indexed", description: "Knowledge base document indexed", category: "Knowledge Base" },
      ];

      return new Response(JSON.stringify({ event_types: eventTypes }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
