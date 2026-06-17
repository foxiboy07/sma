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
    const path = url.pathname.replace("/functions/v1/flow-engine", "");

    // POST /execute - Execute a flow for a contact (processes the next node)
    if (req.method === "POST" && path === "/execute") {
      const { session_id } = await req.json();

      const { data: session } = await supabase
        .from("flow_sessions")
        .select("*, flows:flow_id(id, name, status, trigger_type, trigger_config, ghost_variant_id, ghost_traffic_pct)")
        .eq("id", session_id)
        .eq("is_active", true)
        .maybeSingle();

      if (!session) {
        return new Response(JSON.stringify({ error: "No active session found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const flow = session.flows as any;
      if (!flow || flow.status !== "ACTIVE") {
        await supabase.from("flow_sessions").update({ is_active: false }).eq("id", session_id);
        return new Response(JSON.stringify({ error: "Flow is not active", flow_status: flow?.status }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get current node
      const currentNodeId = session.current_node_id;
      if (!currentNodeId) {
        // Find the trigger node to start
        const { data: triggerNode } = await supabase
          .from("flow_nodes")
          .select("id, node_type, config, label")
          .eq("flow_id", session.flow_id)
          .eq("node_type", "TRIGGER")
          .maybeSingle();

        if (triggerNode) {
          await supabase.from("flow_sessions").update({ current_node_id: triggerNode.id }).eq("id", session_id);
          // Get the next node after trigger
          const { data: nextEdge } = await supabase
            .from("flow_edges")
            .select("target_node_id")
            .eq("source_node_id", triggerNode.id)
            .eq("flow_id", session.flow_id)
            .maybeSingle();

          if (nextEdge) {
            await supabase.from("flow_sessions").update({ current_node_id: nextEdge.target_node_id }).eq("id", session_id);
            return executeNode(nextEdge.target_node_id, session, flow);
          }
        }
        return new Response(JSON.stringify({ error: "No trigger node found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return await executeNode(currentNodeId, session, flow);
    }

    // POST /advance - Move to the next node in the flow
    if (req.method === "POST" && path === "/advance") {
      const { session_id, edge_condition } = await req.json();

      const { data: session } = await supabase
        .from("flow_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("is_active", true)
        .maybeSingle();

      if (!session) {
        return new Response(JSON.stringify({ error: "No active session" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Find the next edge from current node
      let edgeQuery = supabase
        .from("flow_edges")
        .select("id, target_node_id, edge_label, condition_config")
        .eq("source_node_id", session.current_node_id)
        .eq("flow_id", session.flow_id);

      const { data: edges } = await edgeQuery;

      if (!edges || edges.length === 0) {
        // End of flow - mark session as complete
        await supabase.from("flow_sessions").update({ is_active: false }).eq("id", session_id);
        await supabase.rpc("increment_flow_stats", { p_flow_id: session.flow_id, p_converted: true });
        return new Response(JSON.stringify({ status: "flow_completed" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let nextNodeId: string | null = null;

      if (edges.length === 1) {
        nextNodeId = edges[0].target_node_id;
      } else {
        // Multiple edges - evaluate conditions
        for (const edge of edges) {
          const cond = edge.condition_config as any;
          if (edge_condition && cond?.condition === edge_condition) {
            nextNodeId = edge.target_node_id;
            break;
          }
          if (!edge_condition && (!cond || Object.keys(cond).length === 0)) {
            nextNodeId = edge.target_node_id;
            break;
          }
        }
        if (!nextNodeId) nextNodeId = edges[0].target_node_id;
      }

      // Update session to next node
      await supabase.from("flow_sessions").update({ current_node_id: nextNodeId }).eq("id", session_id);

      // Log attribution
      await supabase.rpc("log_attribution_event", {
        p_tenant_id: session.tenant_id,
        p_brand_id: session.brand_id,
        p_contact_id: session.unified_contact_id,
        p_flow_id: session.flow_id,
        p_event_type: "MESSAGE_SENT",
        p_platform: session.platform,
        p_metadata: { node_id: nextNodeId, session_id },
      });

      return new Response(JSON.stringify({ status: "advanced", next_node_id: nextNodeId }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /validate - Validate a flow's configuration
    if (req.method === "POST" && path === "/validate") {
      const { flow_id } = await req.json();

      const { data: nodes } = await supabase
        .from("flow_nodes")
        .select("id, node_type, config, label")
        .eq("flow_id", flow_id);

      const { data: edges } = await supabase
        .from("flow_edges")
        .select("source_node_id, target_node_id")
        .eq("flow_id", flow_id);

      const warnings: string[] = [];
      const errors: string[] = [];

      const nodeIds = new Set((nodes || []).map(n => n.id));
      const sourceNodes = new Set((edges || []).map(e => e.source_node_id));
      const targetNodes = new Set((edges || []).map(e => e.target_node_id));

      // Check for orphan nodes (no incoming or outgoing edges, except trigger)
      for (const node of nodes || []) {
        if (node.node_type !== "TRIGGER" && !targetNodes.has(node.id) && !sourceNodes.has(node.id)) {
          warnings.push(`Node "${node.label || node.node_type}" has no connections`);
        }
        // Check required config fields
        if (node.node_type === "SEND_MESSAGE" && !node.config?.message) {
          errors.push(`Node "${node.label || "Send Message"}" is missing message content`);
        }
        if (node.node_type === "SMART_DELAY") {
          const delayMs = node.config?.delay_ms || 0;
          if (delayMs > 23.5 * 60 * 60 * 1000) {
            warnings.push(`Smart Delay "${node.label || "Delay"}" may push past 24h messaging window`);
          }
        }
        if (node.node_type === "SUPER_RANDOMIZER") {
          const paths = node.config?.paths || [];
          const totalPct = paths.reduce((sum: number, p: any) => sum + (p.percentage || 0), 0);
          if (totalPct !== 100) {
            errors.push(`Super Randomizer "${node.label || "Randomizer"}" paths must sum to 100% (currently ${totalPct}%)`);
          }
        }
      }

      // Check for trigger node
      const hasTrigger = (nodes || []).some(n => n.node_type === "TRIGGER");
      if (!hasTrigger) {
        errors.push("Flow must have a trigger node");
      }

      return new Response(JSON.stringify({ valid: errors.length === 0, errors, warnings }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /sessions - Get active sessions for a contact
    if (req.method === "GET" && path === "/sessions") {
      const contactId = url.searchParams.get("contact_id");
      if (!contactId) {
        return new Response(JSON.stringify({ error: "contact_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: sessions } = await supabase
        .from("flow_sessions")
        .select("*, flows:flow_id(id, name)")
        .eq("unified_contact_id", contactId)
        .eq("is_active", true);

      return new Response(JSON.stringify({ sessions }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /check-window - 24-Hour messaging window check
    if (req.method === "POST" && path === "/check-window") {
      const { contact_id, platform, brand_id, has_message_tag } = await req.json();

      const { data: result } = await supabase.rpc("check_24h_window", {
        p_contact_id: contact_id,
        p_platform: platform,
        p_brand_id: brand_id,
        p_has_message_tag: has_message_tag || false,
      });

      return new Response(JSON.stringify({ window_status: result }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function executeNode(nodeId: string, session: any, flow: any) {
  const { data: node } = await supabase
    .from("flow_nodes")
    .select("id, node_type, config, label")
    .eq("id", nodeId)
    .maybeSingle();

  if (!node) {
    return new Response(JSON.stringify({ error: "Node not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const result: any = { node_id: node.id, node_type: node.node_type, label: node.label };

  switch (node.node_type) {
    case "TRIGGER": {
      result.action = "trigger_fired";
      result.config = node.config;
      break;
    }
    case "SEND_MESSAGE": {
      // Check 24h window before sending
      const { data: windowStatus } = await supabase.rpc("check_24h_window", {
        p_contact_id: session.unified_contact_id,
        p_platform: session.platform,
        p_brand_id: session.brand_id,
        p_has_message_tag: !!node.config?.message_tag,
      });

      if (windowStatus === "EXPIRED_BLOCKED") {
        result.action = "blocked";
        result.reason = "24H_WINDOW_EXPIRED";
        // Route to DLQ
        await supabase.from("dlq_messages").insert({
          tenant_id: session.tenant_id,
          brand_id: session.brand_id,
          platform: session.platform,
          contact_name: session.unified_contact_id,
          flow_id: session.flow_id,
          error_code: "24H_WINDOW_EXPIRED",
          error_detail: "Message blocked: 24-hour messaging window has expired",
          original_payload: { node_id: node.id, config: node.config },
          status: "PENDING",
        });
      } else {
        // Create outbound message
        const { data: conversation } = await supabase
          .from("conversations")
          .select("id")
          .eq("unified_contact_id", session.unified_contact_id)
          .eq("brand_id", session.brand_id)
          .maybeSingle();

        if (conversation) {
          await supabase.from("messages").insert({
            conversation_id: conversation.id,
            tenant_id: session.tenant_id,
            direction: "OUTBOUND",
            content: node.config?.message || "",
            message_type: "TEXT",
            delivery_status: "QUEUED",
            is_ai_generated: false,
          });
        }
        result.action = "message_sent";
        result.window_status = windowStatus;
      }
      break;
    }
    case "SEND_DM_CARD": {
      result.action = "dm_card_sent";
      result.card = node.config;
      break;
    }
    case "AI_STEP": {
      result.action = "ai_step";
      result.config = { kb_id: node.config?.kb_document_id, strictness: node.config?.strictness, fallback: node.config?.fallback_state };
      break;
    }
    case "CONDITION": {
      result.action = "condition_eval";
      result.condition = node.config?.condition;
      result.branches = node.config?.branches || ["true", "false"];
      break;
    }
    case "SUPER_RANDOMIZER": {
      const paths = node.config?.paths || [];
      const rand = Math.random() * 100;
      let cumulative = 0;
      let selectedPath = paths[0];
      for (const p of paths) {
        cumulative += p.percentage || 0;
        if (rand <= cumulative) { selectedPath = p; break; }
      }
      result.action = "randomizer_split";
      result.selected_path = selectedPath;
      break;
    }
    case "SMART_DELAY": {
      const delayMs = node.config?.delay_ms || 0;
      const nextActionAt = new Date(Date.now() + delayMs).toISOString();
      await supabase.from("flow_sessions").update({ next_action_at: nextActionAt }).eq("id", session.id);
      result.action = "delay_scheduled";
      result.delay_ms = delayMs;
      result.next_action_at = nextActionAt;
      if (delayMs > 23.5 * 60 * 60 * 1000) {
        result.warning = "Delay may push past 24h messaging window";
      }
      break;
    }
    case "ACTION_BLOCK": {
      result.action = "action_executed";
      result.action_type = node.config?.action_type;
      break;
    }
    case "FRICTION_RECOVERY": {
      // Auto-activate: set priority red, alert human
      const { data: conversation } = await supabase
        .from("conversations")
        .select("id")
        .eq("unified_contact_id", session.unified_contact_id)
        .eq("brand_id", session.brand_id)
        .maybeSingle();

      if (conversation) {
        await supabase.from("conversations").update({
          priority_red: true,
          status: "HUMAN",
        }).eq("id", conversation.id);
      }

      await supabase.from("notifications").insert({
        tenant_id: session.tenant_id,
        brand_id: session.brand_id,
        type: "inbox.sentiment_alert",
        title: "Priority Red Alert",
        description: "Friction recovery activated - contact needs human attention",
        is_read: false,
      });

      result.action = "friction_recovery";
      result.recovery_message = node.config?.recovery_message;
      break;
    }
    case "TIKTOK_SHOP_PRODUCT": {
      result.action = "tiktok_shop_product";
      result.product_id = node.config?.product_id;
      break;
    }
    case "OUTBOUND_WEBHOOK": {
      result.action = "webhook_fired";
      result.url = node.config?.url;
      break;
    }
    default: {
      result.action = "unknown_node";
    }
  }

  return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
