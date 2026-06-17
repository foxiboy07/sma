import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(data: unknown, status = 200, meta?: Record<string, unknown>) {
  const body: Record<string, unknown> = { data, error: null };
  if (meta) body.meta = meta;
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function errorResponse(error: string, code: string, status = 400, retryable = false, details?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ data: null, error, code, retryable, details }),
    { status, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
}

function getSupabaseClient(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Create admin client for RLS-bypassed operations
  const adminClient = createClient(supabaseUrl, serviceKey);

  // Create user client with token for RLS-protected operations
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  return { adminClient, userClient, token };
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── AUTH HELPERS ─────────────────────────────────────────────

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function getTenantForUser(userId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(supabaseUrl, serviceKey);

  const { data } = await client
    .from("team_members")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .single();

  return data;
}

// ─── BRANDS ──────────────────────────────────────────────────

async function handleBrands(req: Request, user: any, adminClient: any, pathParts: string[], method: string) {
  const tenantData = await getTenantForUser(user.id);
  if (!tenantData) return errorResponse("No tenant found", "NO_TENANT", 403);

  // GET /api/brands
  if (method === "GET" && pathParts.length === 0) {
    const { data, error } = await adminClient
      .from("brands")
      .select("id, name, logo_url, timezone, brand_color, plan")
      .eq("tenant_id", tenantData.tenant_id);

    if (error) return errorResponse(error.message, "DB_ERROR", 500);
    return jsonResponse(data);
  }

  // POST /api/brands
  if (method === "POST" && pathParts.length === 0) {
    const body = await req.json();
    const { data, error } = await adminClient
      .from("brands")
      .insert({
        tenant_id: tenantData.tenant_id,
        name: body.name,
        timezone: body.timezone || "UTC",
        logo_url: body.logoUrl,
        brand_color: body.brandColor,
        persona_name: body.personaName,
        persona_tone: body.personaTone || "FRIENDLY",
        forbidden_topics: body.forbiddenTopics || [],
        ai_monthly_cap_usd: body.aiMonthlyCapUsd || 50,
      })
      .select()
      .single();

    if (error) return errorResponse(error.message, "DB_ERROR", 400);
    return jsonResponse(data, 201);
  }

  // PATCH /api/brands/:id
  if (method === "PATCH" && pathParts.length === 1) {
    const body = await req.json();
    const updateFields: Record<string, unknown> = {};
    const allowedFields = ["name", "logo_url", "timezone", "brand_color", "persona_name", "persona_tone", "forbidden_topics", "ai_monthly_cap_usd"];
    for (const key of allowedFields) {
      if (body[key] !== undefined) updateFields[key] = body[key];
    }

    const { data, error } = await adminClient
      .from("brands")
      .update(updateFields)
      .eq("id", pathParts[0])
      .eq("tenant_id", tenantData.tenant_id)
      .select()
      .single();

    if (error) return errorResponse(error.message, "DB_ERROR", 400);
    if (!data) return errorResponse("Brand not found", "NOT_FOUND", 404);
    return jsonResponse(data);
  }

  return errorResponse("Not found", "NOT_FOUND", 404);
}

// ─── CONNECTED ACCOUNTS ─────────────────────────────────────

async function handleConnectedAccounts(req: Request, user: any, adminClient: any, pathParts: string[], method: string) {
  const tenantData = await getTenantForUser(user.id);
  if (!tenantData) return errorResponse("No tenant found", "NO_TENANT", 403);

  // GET /api/brands/:brandId/connected-accounts
  if (method === "GET" && pathParts.length >= 2 && pathParts[1] === "connected-accounts") {
    const brandId = pathParts[0];
    const { data, error } = await adminClient
      .from("connected_accounts")
      .select("id, platform, platform_username, health_status, circuit_state, failure_count, failure_rate_60s, token_expires_at, last_refresh_at, last_webhook_at, granted_scopes")
      .eq("brand_id", brandId)
      .eq("tenant_id", tenantData.tenant_id);

    if (error) return errorResponse(error.message, "DB_ERROR", 500);

    const accounts = (data || []).map((a: any) => {
      const tokenAgeHours = a.last_refresh_at
        ? Math.round((Date.now() - new Date(a.last_refresh_at).getTime()) / 3600000)
        : null;
      const expiresInHours = a.token_expires_at
        ? Math.round((new Date(a.token_expires_at).getTime() - Date.now()) / 3600000)
        : null;

      return {
        id: a.id,
        platform: a.platform,
        platformUsername: a.platform_username,
        healthStatus: a.health_status,
        tokenAgeHours,
        expiresInHours,
        lastWebhookAt: a.last_webhook_at,
        circuitState: a.circuit_state,
        failureRate: a.failure_rate_60s ? `${(a.failure_rate_60s * 100).toFixed(1)}%` : "0%",
        grantedScopes: a.granted_scopes || [],
        missingScopes: [],
      };
    });

    return jsonResponse(accounts);
  }

  // POST /api/connected-accounts/:id/force-refresh
  if (method === "POST" && pathParts.length === 2 && pathParts[1] === "force-refresh") {
    // Delegate to token-vault edge function
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const tvResponse = await fetch(`${supabaseUrl}/functions/v1/token-vault`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ action: "force-refresh", accountId: pathParts[0] }),
    });
    const tvData = await tvResponse.json();
    return jsonResponse(tvData);
  }

  // DELETE /api/connected-accounts/:id
  if (method === "DELETE" && pathParts.length === 1) {
    const { error } = await adminClient
      .from("connected_accounts")
      .delete()
      .eq("id", pathParts[0])
      .eq("tenant_id", tenantData.tenant_id);

    if (error) return errorResponse(error.message, "DB_ERROR", 500);
    return jsonResponse({ success: true });
  }

  return errorResponse("Not found", "NOT_FOUND", 404);
}

// ─── FLOWS ──────────────────────────────────────────────────

async function handleFlows(req: Request, user: any, adminClient: any, pathParts: string[], method: string) {
  const tenantData = await getTenantForUser(user.id);
  if (!tenantData) return errorResponse("No tenant found", "NO_TENANT", 403);

  // GET /api/brands/:brandId/flows
  if (method === "GET" && pathParts.length >= 2 && pathParts[1] === "flows") {
    const brandId = pathParts[0];
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const triggerType = url.searchParams.get("triggerType");

    let query = adminClient
      .from("flows")
      .select("id, name, status, trigger_type, triggered_count, conversion_count, revenue_attributed, updated_at, created_at, ghost_variant_id, ghost_traffic_pct")
      .eq("brand_id", brandId)
      .eq("tenant_id", tenantData.tenant_id);

    if (status) query = query.eq("status", status);
    if (triggerType) query = query.eq("trigger_type", triggerType);

    const { data, error } = await query;
    if (error) return errorResponse(error.message, "DB_ERROR", 500);

    const flows = (data || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      status: f.status,
      triggerType: f.trigger_type,
      platforms: [],
      ghostVariantId: f.ghost_variant_id,
      ghostTrafficPct: f.ghost_traffic_pct,
      metrics: {
        triggeredCount: f.triggered_count || 0,
        conversionPct: f.triggered_count > 0 ? Math.round((f.conversion_count / f.triggered_count) * 100 * 10) / 10 : 0,
        revenueAttributed: f.revenue_attributed || 0,
      },
      lastEditedAt: f.updated_at,
      updatedAt: f.updated_at,
    }));

    return jsonResponse(flows);
  }

  // GET /api/flows/:id
  if (method === "GET" && pathParts.length === 1) {
    const { data: flow, error } = await adminClient
      .from("flows")
      .select("*, flow_nodes(*), flow_edges(*)")
      .eq("id", pathParts[0])
      .eq("tenant_id", tenantData.tenant_id)
      .single();

    if (error) return errorResponse("Flow not found", "NOT_FOUND", 404);

    const result = {
      id: flow.id,
      name: flow.name,
      status: flow.status,
      triggerType: flow.trigger_type,
      triggerConfig: flow.trigger_config,
      ghostVariantId: flow.ghost_variant_id,
      ghostTrafficPct: flow.ghost_traffic_pct,
      metrics: {
        triggeredCount: flow.triggered_count || 0,
        conversionPct: flow.triggered_count > 0 ? Math.round((flow.conversion_count / flow.triggered_count) * 100 * 10) / 10 : 0,
        revenueAttributed: flow.revenue_attributed || 0,
      },
      nodes: (flow.flow_nodes || []).map((n: any) => ({
        id: n.id,
        flowId: n.flow_id,
        nodeType: n.node_type,
        config: n.config,
        positionX: n.position_x,
        positionY: n.position_y,
        label: n.label,
        isDisabled: n.is_disabled,
        createdAt: n.created_at,
      })),
      edges: (flow.flow_edges || []).map((e: any) => ({
        id: e.id,
        flowId: e.flow_id,
        sourceNodeId: e.source_node_id,
        targetNodeId: e.target_node_id,
        edgeLabel: e.edge_label,
        conditionConfig: e.condition_config,
      })),
      yjsState: flow.yjs_state ? btoa(String.fromCharCode(...new Uint8Array(flow.yjs_state))) : null,
      updatedAt: flow.updated_at,
      createdAt: flow.created_at,
    };

    return jsonResponse(result);
  }

  // POST /api/brands/:brandId/flows
  if (method === "POST" && pathParts.length >= 2 && pathParts[1] === "flows") {
    const body = await req.json();
    const brandId = pathParts[0];

    const { data, error } = await adminClient
      .from("flows")
      .insert({
        tenant_id: tenantData.tenant_id,
        brand_id: brandId,
        name: body.name || "Untitled Flow",
        trigger_type: body.triggerType || "MANUAL",
        trigger_config: body.triggerConfig || {},
        status: "DRAFT",
      })
      .select()
      .single();

    if (error) return errorResponse(error.message, "DB_ERROR", 400);

    // Create trigger node
    await adminClient.from("flow_nodes").insert({
      flow_id: data.id,
      tenant_id: tenantData.tenant_id,
      node_type: "TRIGGER",
      config: { triggerType: data.trigger_type },
      position_x: 250,
      position_y: 50,
      label: "Trigger",
    });

    return jsonResponse({
      ...data,
      nodes: [],
      edges: [],
      yjsState: null,
      metrics: { triggeredCount: 0, conversionPct: 0, revenueAttributed: 0 },
    }, 201);
  }

  // PATCH /api/flows/:id
  if (method === "PATCH" && pathParts.length === 1) {
    const body = await req.json();
    const updateFields: Record<string, unknown> = {};
    if (body.name !== undefined) updateFields.name = body.name;
    if (body.status !== undefined) updateFields.status = body.status;
    if (body.triggerConfig !== undefined) updateFields.trigger_config = body.triggerConfig;

    const { data, error } = await adminClient
      .from("flows")
      .update(updateFields)
      .eq("id", pathParts[0])
      .eq("tenant_id", tenantData.tenant_id)
      .select()
      .single();

    if (error) return errorResponse(error.message, "DB_ERROR", 400);
    if (!data) return errorResponse("Flow not found", "NOT_FOUND", 404);
    return jsonResponse(data);
  }

  // PUT /api/flows/:id/nodes
  if (method === "PUT" && pathParts.length === 2 && pathParts[1] === "nodes") {
    const body = await req.json();
    const flowId = pathParts[0];

    // Validate flow ownership
    const { data: flow } = await adminClient
      .from("flows")
      .select("id")
      .eq("id", flowId)
      .eq("tenant_id", tenantData.tenant_id)
      .single();

    if (!flow) return errorResponse("Flow not found", "NOT_FOUND", 404);

    // Delete existing nodes and edges, then re-insert
    await adminClient.from("flow_edges").delete().eq("flow_id", flowId);
    await adminClient.from("flow_nodes").delete().eq("flow_id", flowId);

    if (body.nodes?.length) {
      const nodes = body.nodes.map((n: any) => ({
        id: n.id,
        flow_id: flowId,
        tenant_id: tenantData.tenant_id,
        node_type: n.nodeType || n.node_type,
        config: n.config || {},
        position_x: n.positionX ?? n.position_x ?? 0,
        position_y: n.positionY ?? n.position_y ?? 0,
        label: n.label || "",
        is_disabled: n.isDisabled ?? n.is_disabled ?? false,
      }));
      await adminClient.from("flow_nodes").upsert(nodes);
    }

    if (body.edges?.length) {
      const edges = body.edges.map((e: any) => ({
        id: e.id,
        flow_id: flowId,
        tenant_id: tenantData.tenant_id,
        source_node_id: e.sourceNodeId ?? e.source_node_id,
        target_node_id: e.targetNodeId ?? e.target_node_id,
        edge_label: e.edgeLabel ?? e.edge_label,
        condition_config: e.conditionConfig ?? e.condition_config ?? {},
      }));
      await adminClient.from("flow_edges").upsert(edges);
    }

    return jsonResponse({ savedAt: new Date().toISOString() });
  }

  // POST /api/flows/:id/publish
  if (method === "POST" && pathParts.length === 2 && pathParts[1] === "publish") {
    const flowId = pathParts[0];

    // Validate flow
    const { data: flow } = await adminClient
      .from("flows")
      .select("*, flow_nodes(*)")
      .eq("id", flowId)
      .eq("tenant_id", tenantData.tenant_id)
      .single();

    if (!flow) return errorResponse("Flow not found", "NOT_FOUND", 404);

    const validationErrors: any[] = [];
    const nodes = flow.flow_nodes || [];

    // Must have a trigger node
    const hasTrigger = nodes.some((n: any) => n.node_type === "TRIGGER");
    if (!hasTrigger) validationErrors.push({ severity: "ERROR", nodeId: "", message: "Flow must have a trigger node" });

    // All nodes must be connected
    const orphanNodes = nodes.filter((n: any) => n.node_type !== "TRIGGER");
    const { data: edges } = await adminClient.from("flow_edges").select("target_node_id").eq("flow_id", flowId);
    const connectedNodeIds = new Set((edges || []).map((e: any) => e.target_node_id));
    for (const node of orphanNodes) {
      if (!connectedNodeIds.has(node.id)) {
        validationErrors.push({ severity: "WARNING", nodeId: node.id, message: "Node is not connected to the flow" });
      }
    }

    if (validationErrors.some((e: any) => e.severity === "ERROR")) {
      return jsonResponse({ status: flow.status, validationErrors });
    }

    // Publish
    const { data: updated } = await adminClient
      .from("flows")
      .update({ status: "ACTIVE" })
      .eq("id", flowId)
      .select()
      .single();

    return jsonResponse({ status: "ACTIVE", validationErrors });
  }

  // POST /api/flows/:id/pause
  if (method === "POST" && pathParts.length === 2 && pathParts[1] === "pause") {
    const { data, error } = await adminClient
      .from("flows")
      .update({ status: "PAUSED" })
      .eq("id", pathParts[0])
      .eq("tenant_id", tenantData.tenant_id)
      .select()
      .single();

    if (error) return errorResponse(error.message, "DB_ERROR", 400);
    return jsonResponse(data);
  }

  // POST /api/flows/:id/duplicate
  if (method === "POST" && pathParts.length === 2 && pathParts[1] === "duplicate") {
    const flowId = pathParts[0];
    const { data: original } = await adminClient
      .from("flows")
      .select("*, flow_nodes(*), flow_edges(*)")
      .eq("id", flowId)
      .eq("tenant_id", tenantData.tenant_id)
      .single();

    if (!original) return errorResponse("Flow not found", "NOT_FOUND", 404);

    // Create new flow
    const { data: newFlow, error } = await adminClient
      .from("flows")
      .insert({
        tenant_id: tenantData.tenant_id,
        brand_id: original.brand_id,
        name: `${original.name} (Copy)`,
        trigger_type: original.trigger_type,
        trigger_config: original.trigger_config,
        status: "DRAFT",
      })
      .select()
      .single();

    if (error) return errorResponse(error.message, "DB_ERROR", 400);

    // Copy nodes with new IDs
    const nodeIdMap: Record<string, string> = {};
    for (const node of original.flow_nodes || []) {
      const newId = crypto.randomUUID();
      nodeIdMap[node.id] = newId;
      await adminClient.from("flow_nodes").insert({
        id: newId,
        flow_id: newFlow.id,
        tenant_id: tenantData.tenant_id,
        node_type: node.node_type,
        config: node.config,
        position_x: node.position_x,
        position_y: node.position_y,
        label: node.label,
        is_disabled: node.is_disabled,
      });
    }

    // Copy edges
    for (const edge of original.flow_edges || []) {
      await adminClient.from("flow_edges").insert({
        flow_id: newFlow.id,
        tenant_id: tenantData.tenant_id,
        source_node_id: nodeIdMap[edge.source_node_id],
        target_node_id: nodeIdMap[edge.target_node_id],
        edge_label: edge.edge_label,
        condition_config: edge.condition_config,
      });
    }

    return jsonResponse(newFlow, 201);
  }

  // DELETE /api/flows/:id (soft-delete -> ARCHIVED)
  if (method === "DELETE" && pathParts.length === 1) {
    const { data, error } = await adminClient
      .from("flows")
      .update({ status: "ARCHIVED" })
      .eq("id", pathParts[0])
      .eq("tenant_id", tenantData.tenant_id)
      .select()
      .single();

    if (error) return errorResponse(error.message, "DB_ERROR", 400);
    if (!data) return errorResponse("Flow not found", "NOT_FOUND", 404);
    return jsonResponse(data);
  }

  // POST /api/flows/:id/validate
  if (method === "POST" && pathParts.length === 2 && pathParts[1] === "validate") {
    const flowId = pathParts[0];
    const { data: flow } = await adminClient
      .from("flows")
      .select("*, flow_nodes(*), flow_edges(*)")
      .eq("id", flowId)
      .eq("tenant_id", tenantData.tenant_id)
      .single();

    if (!flow) return errorResponse("Flow not found", "NOT_FOUND", 404);

    const errors: any[] = [];
    const warnings: any[] = [];
    const nodes = flow.flow_nodes || [];
    const edges = flow.flow_edges || [];

    if (!nodes.some((n: any) => n.node_type === "TRIGGER")) {
      errors.push({ severity: "ERROR", nodeId: "", message: "Missing trigger node" });
    }

    const sourceNodeIds = new Set(edges.map((e: any) => e.source_node_id));
    const terminalNodes = nodes.filter((n: any) => n.node_type !== "TRIGGER" && !sourceNodeIds.has(n.id));
    for (const n of terminalNodes) {
      if (n.node_type !== "CONDITION" && n.node_type !== "SUPER_RANDOMIZER") {
        warnings.push({ severity: "WARNING", nodeId: n.id, message: "Node has no outgoing connections" });
      }
    }

    // Check for send_message nodes without content
    for (const n of nodes) {
      if (n.node_type === "SEND_MESSAGE" && (!n.config?.message || n.config.message.trim() === "")) {
        errors.push({ severity: "ERROR", nodeId: n.id, message: "Send Message node has no content" });
      }
    }

    return jsonResponse({ errors, warnings });
  }

  return errorResponse("Not found", "NOT_FOUND", 404);
}

// ─── INBOX ──────────────────────────────────────────────────

async function handleInbox(req: Request, user: any, adminClient: any, pathParts: string[], method: string) {
  const tenantData = await getTenantForUser(user.id);
  if (!tenantData) return errorResponse("No tenant found", "NO_TENANT", 403);

  // GET /api/brands/:brandId/conversations
  if (method === "GET" && pathParts.length >= 2 && pathParts[0] === "brands" && pathParts[2] === "conversations") {
    const brandId = pathParts[1];
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const platform = url.searchParams.get("platform");
    const sort = url.searchParams.get("sort") || "RECENT";
    const search = url.searchParams.get("search");
    const page = parseInt(url.searchParams.get("page") || "1");
    const perPage = parseInt(url.searchParams.get("perPage") || "25");

    let query = adminClient
      .from("conversations")
      .select("id, platform, status, priority_red, last_message_at, created_at, assigned_agent_id, sentiment_score, unified_contact_id, unified_contacts(id, display_name, loyalty_tier)")
      .eq("brand_id", brandId)
      .eq("tenant_id", tenantData.tenant_id)
      .range((page - 1) * perPage, page * perPage - 1);

    if (status) query = query.eq("status", status);
    if (platform) query = query.eq("platform", platform);

    const { data, error, count } = await query;
    if (error) return errorResponse(error.message, "DB_ERROR", 500);

    // Get last message for each conversation
    const conversations = await Promise.all((data || []).map(async (c: any) => {
      const { data: lastMsg } = await adminClient
        .from("messages")
        .select("content, direction, created_at")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const { data: unread } = await adminClient
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", c.id)
        .eq("direction", "INBOUND")
        .is("read_at", null);

      const contact = c.unified_contacts;
      return {
        id: c.id,
        platform: c.platform,
        status: c.status,
        priorityRed: c.priority_red,
        contact: {
          id: contact?.id,
          displayName: contact?.display_name,
          loyaltyTier: contact?.loyalty_tier,
        },
        lastMessage: lastMsg ? {
          content: lastMsg.content,
          direction: lastMsg.direction,
          createdAt: lastMsg.created_at,
        } : null,
        unreadCount: unread || 0,
        lastMessageAt: c.last_message_at,
        sentimentScore: c.sentiment_score,
      };
    }));

    return jsonResponse(conversations, 200, {
      page, perPage, total: count || 0, hasNext: (count || 0) > page * perPage,
    });
  }

  // GET /api/conversations/:id
  if (method === "GET" && pathParts.length === 1 && pathParts[0] !== "brands") {
    const convId = pathParts[0];
    const { data: conv, error } = await adminClient
      .from("conversations")
      .select("*, unified_contacts(*)")
      .eq("id", convId)
      .eq("tenant_id", tenantData.tenant_id)
      .single();

    if (error || !conv) return errorResponse("Conversation not found", "NOT_FOUND", 404);

    // Get messages with cursor pagination
    const url = new URL(req.url);
    const before = url.searchParams.get("before");
    const limit = parseInt(url.searchParams.get("limit") || "50");

    let msgQuery = adminClient
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) msgQuery = msgQuery.lt("created_at", before);

    const { data: messages } = await msgQuery;

    return jsonResponse({
      id: conv.id,
      platform: conv.platform,
      status: conv.status,
      priorityRed: conv.priority_red,
      assignedAgentId: conv.assigned_agent_id,
      sentimentScore: conv.sentiment_score,
      contact: conv.unified_contacts,
      messages: (messages || []).reverse().map((m: any) => ({
        id: m.id,
        direction: m.direction,
        content: m.content,
        messageType: m.message_type,
        deliveryStatus: m.delivery_status,
        isAiGenerated: m.is_ai_generated,
        aiTierUsed: m.ai_tier_used,
        platformMessageId: m.platform_message_id,
        sentAt: m.sent_at,
        createdAt: m.created_at,
      })),
      lastMessageAt: conv.last_message_at,
      createdAt: conv.created_at,
    });
  }

  // POST /api/conversations/:id/messages
  if (method === "POST" && pathParts.length === 2 && pathParts[1] === "messages") {
    const body = await req.json();
    const convId = pathParts[0];

    // Get conversation
    const { data: conv } = await adminClient
      .from("conversations")
      .select("brand_id, tenant_id, unified_contact_id, status")
      .eq("id", convId)
      .eq("tenant_id", tenantData.tenant_id)
      .single();

    if (!conv) return errorResponse("Conversation not found", "NOT_FOUND", 404);

    // Create message
    const { data: message, error } = await adminClient
      .from("messages")
      .insert({
        conversation_id: convId,
        tenant_id: tenantData.tenant_id,
        direction: "OUTBOUND",
        content: body.content,
        message_type: body.messageType || "TEXT",
        delivery_status: "QUEUED",
      })
      .select()
      .single();

    if (error) return errorResponse(error.message, "DB_ERROR", 400);

    // Update conversation
    await adminClient
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", convId);

    return jsonResponse({
      id: message.id,
      direction: message.direction,
      content: message.content,
      messageType: message.message_type,
      deliveryStatus: message.delivery_status,
      isAiGenerated: false,
      createdAt: message.created_at,
    }, 201);
  }

  // PATCH /api/conversations/:id
  if (method === "PATCH" && pathParts.length === 1) {
    const body = await req.json();
    const updateFields: Record<string, unknown> = {};
    if (body.status !== undefined) updateFields.status = body.status;
    if (body.assignedAgentId !== undefined) updateFields.assigned_agent_id = body.assignedAgentId;
    if (body.priorityRed !== undefined) updateFields.priority_red = body.priorityRed;

    const { data, error } = await adminClient
      .from("conversations")
      .update(updateFields)
      .eq("id", pathParts[0])
      .eq("tenant_id", tenantData.tenant_id)
      .select()
      .single();

    if (error) return errorResponse(error.message, "DB_ERROR", 400);
    if (!data) return errorResponse("Conversation not found", "NOT_FOUND", 404);
    return jsonResponse(data);
  }

  // POST /api/conversations/:id/ai-suggest
  if (method === "POST" && pathParts.length === 2 && pathParts[1] === "ai-suggest") {
    const convId = pathParts[0];

    const { data: conv } = await adminClient
      .from("conversations")
      .select("brand_id, unified_contact_id")
      .eq("id", convId)
      .eq("tenant_id", tenantData.tenant_id)
      .single();

    if (!conv) return errorResponse("Conversation not found", "NOT_FOUND", 404);

    // Get recent messages for context
    const { data: recentMsgs } = await adminClient
      .from("messages")
      .select("content, direction")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(5);

    const inboundMessages = (recentMsgs || []).filter((m: any) => m.direction === "INBOUND");
    const lastMessage = inboundMessages[0]?.content || "";

    // Simple template-based suggestion
    let suggestion = "Thank you for reaching out! Let me look into that for you.";
    const lowerMsg = lastMessage.toLowerCase();

    if (lowerMsg.includes("price") || lowerMsg.includes("cost") || lowerMsg.includes("how much")) {
      suggestion = "I'd be happy to help with pricing! Could you tell me which product you're interested in?";
    } else if (lowerMsg.includes("refund") || lowerMsg.includes("return")) {
      suggestion = "I'm sorry to hear that. Let me help you with the return process. Could you share your order number?";
    } else if (lowerMsg.includes("order") || lowerMsg.includes("shipping") || lowerMsg.includes("delivery")) {
      suggestion = "Let me check your order status. Could you provide your order number?";
    } else if (lowerMsg.includes("help") || lowerMsg.includes("support")) {
      suggestion = "I'm here to help! Could you describe the issue you're experiencing?";
    } else if (lowerMsg.includes("thank")) {
      suggestion = "You're welcome! Is there anything else I can help you with?";
    }

    return jsonResponse({ suggestion, confidence: 0.7 });
  }

  return errorResponse("Not found", "NOT_FOUND", 404);
}

// ─── CONTACTS ───────────────────────────────────────────────

async function handleContacts(req: Request, user: any, adminClient: any, pathParts: string[], method: string) {
  const tenantData = await getTenantForUser(user.id);
  if (!tenantData) return errorResponse("No tenant found", "NO_TENANT", 403);

  // GET /api/brands/:brandId/contacts
  if (method === "GET" && pathParts.length >= 2 && pathParts[0] === "brands" && pathParts[2] === "contacts") {
    const brandId = pathParts[1];
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const perPage = parseInt(url.searchParams.get("perPage") || "25");
    const search = url.searchParams.get("search");
    const loyaltyTier = url.searchParams.get("loyaltyTier");

    let query = adminClient
      .from("unified_contacts")
      .select("id, display_name, email, phone, loyalty_score, loyalty_tier, tags, sentiment_score, created_at, gdpr_deleted_at, platform_profiles(platform, platform_username, last_interaction_at)")
      .eq("brand_id", brandId)
      .eq("tenant_id", tenantData.tenant_id)
      .is("gdpr_deleted_at", null)
      .range((page - 1) * perPage, page * perPage - 1);

    if (loyaltyTier) query = query.eq("loyalty_tier", loyaltyTier);
    if (search) query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) return errorResponse(error.message, "DB_ERROR", 500);

    const contacts = (data || []).map((c: any) => ({
      id: c.id,
      displayName: c.display_name,
      email: c.email,
      phone: c.phone,
      platforms: (c.platform_profiles || []).map((p: any) => ({
        platform: p.platform,
        username: p.platform_username,
      })),
      loyaltyScore: c.loyalty_score,
      loyaltyTier: c.loyalty_tier,
      tags: c.tags,
      sentimentScore: c.sentiment_score,
      lastInteractionAt: c.platform_profiles?.[0]?.last_interaction_at,
      createdAt: c.created_at,
    }));

    return jsonResponse(contacts, 200, {
      page, perPage, total: count || 0, hasNext: (count || 0) > page * perPage,
    });
  }

  // GET /api/contacts/:id
  if (method === "GET" && pathParts.length === 1 && pathParts[0] !== "brands") {
    const contactId = pathParts[0];
    const { data: contact, error } = await adminClient
      .from("unified_contacts")
      .select("*, platform_profiles(*)")
      .eq("id", contactId)
      .eq("tenant_id", tenantData.tenant_id)
      .is("gdpr_deleted_at", null)
      .single();

    if (error || !contact) return errorResponse("Contact not found", "NOT_FOUND", 404);

    // Get attribution data
    const { data: attribution } = await adminClient.rpc("get_contact_attribution", { p_contact_id: contactId });

    // Get sentiment history
    const { data: sentimentHistory } = await adminClient
      .from("ai_audit_logs")
      .select("similarity_scores, created_at")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(10);

    return jsonResponse({
      id: contact.id,
      displayName: contact.display_name,
      email: contact.email,
      phone: contact.phone,
      platformProfiles: (contact.platform_profiles || []).map((p: any) => ({
        platform: p.platform,
        platformUsername: p.platform_username,
        platformUserId: p.platform_user_id,
        lastInteractionAt: p.last_interaction_at,
      })),
      loyaltyScore: contact.loyalty_score,
      loyaltyTier: contact.loyalty_tier,
      tags: contact.tags,
      customFields: contact.custom_fields || {},
      zeroPartySignals: contact.zero_party_signals || {},
      sentimentScore: contact.sentiment_score,
      notes: contact.notes,
      attribution: attribution || { revenueAttributed: 0, purchasesCount: 0, contributingFlows: [] },
      gdpr: { consentMethod: null, consentDate: null },
      createdAt: contact.created_at,
    });
  }

  // PATCH /api/contacts/:id
  if (method === "PATCH" && pathParts.length === 1) {
    const body = await req.json();
    const updateFields: Record<string, unknown> = {};
    if (body.displayName !== undefined) updateFields.display_name = body.displayName;
    if (body.customFields !== undefined) updateFields.custom_fields = body.customFields;
    if (body.notes !== undefined) updateFields.notes = body.notes;

    const { data, error } = await adminClient
      .from("unified_contacts")
      .update(updateFields)
      .eq("id", pathParts[0])
      .eq("tenant_id", tenantData.tenant_id)
      .select()
      .single();

    if (error) return errorResponse(error.message, "DB_ERROR", 400);
    if (!data) return errorResponse("Contact not found", "NOT_FOUND", 404);
    return jsonResponse(data);
  }

  // POST /api/contacts/:id/tags
  if (method === "POST" && pathParts.length === 2 && pathParts[1] === "tags") {
    const body = await req.json();
    const { data: contact } = await adminClient
      .from("unified_contacts")
      .select("tags")
      .eq("id", pathParts[0])
      .eq("tenant_id", tenantData.tenant_id)
      .single();

    if (!contact) return errorResponse("Contact not found", "NOT_FOUND", 404);

    const existingTags = contact.tags || [];
    const newTags = [...new Set([...existingTags, ...body.tags])];

    await adminClient
      .from("unified_contacts")
      .update({ tags: newTags })
      .eq("id", pathParts[0]);

    return jsonResponse({ tags: newTags });
  }

  // DELETE /api/contacts/:id/tags
  if (method === "DELETE" && pathParts.length === 2 && pathParts[1] === "tags") {
    const body = await req.json();
    const { data: contact } = await adminClient
      .from("unified_contacts")
      .select("tags")
      .eq("id", pathParts[0])
      .eq("tenant_id", tenantData.tenant_id)
      .single();

    if (!contact) return errorResponse("Contact not found", "NOT_FOUND", 404);

    const newTags = (contact.tags || []).filter((t: string) => !body.tags.includes(t));
    await adminClient
      .from("unified_contacts")
      .update({ tags: newTags })
      .eq("id", pathParts[0]);

    return jsonResponse({ tags: newTags });
  }

  // POST /api/contacts/merge
  if (method === "POST" && pathParts.length === 1 && pathParts[0] === "merge") {
    const body = await req.json();

    // Get both contacts
    const { data: contacts } = await adminClient
      .from("unified_contacts")
      .select("*")
      .in("id", [body.contactAId, body.contactBId])
      .eq("tenant_id", tenantData.tenant_id);

    if (!contacts || contacts.length < 2) return errorResponse("Both contacts not found", "NOT_FOUND", 404);

    const keepContact = contacts.find((c: any) => c.id === body.keepId);
    const removeContact = contacts.find((c: any) => c.id !== body.keepId);

    if (!keepContact) return errorResponse("Keep contact not found", "NOT_FOUND", 404);

    // Merge: transfer platform profiles, conversations, attribution events
    await adminClient.from("platform_profiles").update({ unified_contact_id: body.keepId }).eq("unified_contact_id", removeContact.id);
    await adminClient.from("conversations").update({ unified_contact_id: body.keepId }).eq("unified_contact_id", removeContact.id);
    await adminClient.from("attribution_events").update({ unified_contact_id: body.keepId }).eq("unified_contact_id", removeContact.id);

    // Merge tags
    const mergedTags = [...new Set([...(keepContact.tags || []), ...(removeContact.tags || [])])];
    const mergedFields = { ...removeContact.custom_fields, ...keepContact.custom_fields };

    await adminClient
      .from("unified_contacts")
      .update({
        tags: mergedTags,
        custom_fields: mergedFields,
        display_name: keepContact.display_name || removeContact.display_name,
        email: keepContact.email || removeContact.email,
        phone: keepContact.phone || removeContact.phone,
      })
      .eq("id", body.keepId);

    // Soft-delete the merged-away contact
    await adminClient
      .from("unified_contacts")
      .update({ gdpr_deleted_at: new Date().toISOString() })
      .eq("id", removeContact.id);

    return jsonResponse({ mergedContactId: body.keepId });
  }

  // DELETE /api/contacts/:id/data (GDPR erasure)
  if (method === "DELETE" && pathParts.length === 2 && pathParts[1] === "data") {
    const body = await req.json();
    if (body.confirmation !== "DELETE") return errorResponse("Confirmation required", "INVALID_CONFIRMATION", 400);

    const now = new Date().toISOString();
    await adminClient
      .from("unified_contacts")
      .update({
        display_name: "[DELETED]",
        email: null,
        phone: null,
        tags: [],
        custom_fields: {},
        zero_party_signals: {},
        sentiment_score: 0,
        notes: null,
        gdpr_deleted_at: now,
      })
      .eq("id", pathParts[0])
      .eq("tenant_id", tenantData.tenant_id);

    await adminClient.from("platform_profiles").delete().eq("unified_contact_id", pathParts[0]);

    return jsonResponse({ deletedAt: now });
  }

  // GET /api/brands/:brandId/identity-matches
  if (method === "GET" && pathParts.length >= 3 && pathParts[2] === "identity-matches") {
    const brandId = pathParts[1];
    const { data, error } = await adminClient
      .from("identity_match_queue")
      .select("*, contact_a:unified_contacts!identity_match_queue_contact_a_id_fkey(id, display_name), contact_b:unified_contacts!identity_match_queue_contact_b_id_fkey(id, display_name)")
      .eq("brand_id", brandId)
      .eq("tenant_id", tenantData.tenant_id)
      .eq("status", "PENDING");

    if (error) return errorResponse(error.message, "DB_ERROR", 500);
    return jsonResponse(data);
  }

  return errorResponse("Not found", "NOT_FOUND", 404);
}

// ─── ANALYTICS ──────────────────────────────────────────────

async function handleAnalytics(req: Request, user: any, adminClient: any, pathParts: string[], method: string) {
  const tenantData = await getTenantForUser(user.id);
  if (!tenantData) return errorResponse("No tenant found", "NO_TENANT", 403);

  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "30d";
  const platform = url.searchParams.get("platform");

  // GET /api/brands/:brandId/analytics/overview
  if (pathParts.length >= 3 && pathParts[2] === "overview") {
    const brandId = pathParts[1];

    // Calculate period start
    const periodDays = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const periodStart = new Date(Date.now() - periodDays * 86400000).toISOString();

    const { data: messages } = await adminClient
      .from("messages")
      .select("created_at, direction")
      .eq("tenant_id", tenantData.tenant_id)
      .gte("created_at", periodStart);

    const { data: conversations } = await adminClient
      .from("conversations")
      .select("created_at, status")
      .eq("tenant_id", tenantData.tenant_id)
      .gte("created_at", periodStart);

    const { data: revenue } = await adminClient
      .from("attribution_events")
      .select("revenue, event_type")
      .eq("brand_id", brandId)
      .gte("created_at", periodStart);

    const totalRevenue = (revenue || []).reduce((sum: number, e: any) => sum + (parseFloat(e.revenue) || 0), 0);
    const totalSent = (messages || []).filter((m: any) => m.direction === "OUTBOUND").length;
    const totalConvs = conversations?.length || 0;

    // Generate time series (messages per day)
    const messagesOverTime = [];
    for (let i = periodDays - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000);
      const dateStr = date.toISOString().split("T")[0];
      const dayMessages = (messages || []).filter((m: any) => m.created_at?.startsWith(dateStr)).length;
      messagesOverTime.push({ date: dateStr, count: dayMessages });
    }

    return jsonResponse({
      metrics: {
        totalMessagesSent: totalSent,
        totalConversations: totalConvs,
        revenueAttributed: totalRevenue,
        avgConversationDurationMin: 0,
        aiCacheHitRate: 0,
        activeContacts: 0,
      },
      messagesOverTime,
      funnel: [],
      revenueByDay: [],
      platformMix: [],
    });
  }

  // GET /api/brands/:brandId/analytics/flows
  if (pathParts.length >= 3 && pathParts[2] === "flows") {
    const brandId = pathParts[1];
    const { data: flows } = await adminClient
      .from("flows")
      .select("id, name, trigger_type, triggered_count, conversion_count, revenue_attributed, status")
      .eq("brand_id", brandId)
      .eq("tenant_id", tenantData.tenant_id)
      .neq("status", "ARCHIVED");

    const flowPerformance = (flows || []).map((f: any) => ({
      flowId: f.id,
      flowName: f.name,
      triggerType: f.trigger_type,
      triggered: f.triggered_count || 0,
      completionPct: 0,
      conversionPct: f.triggered_count > 0 ? Math.round((f.conversion_count / f.triggered_count) * 100 * 10) / 10 : 0,
      revenueAttributed: f.revenue_attributed || 0,
      ghostActive: false,
    }));

    return jsonResponse(flowPerformance);
  }

  // GET /api/brands/:brandId/analytics/ai
  if (pathParts.length >= 3 && pathParts[2] === "ai") {
    const brandId = pathParts[1];
    const { data: aiLogs } = await adminClient
      .from("ai_audit_logs")
      .select("model_tier, estimated_cost_usd, token_count")
      .eq("brand_id", brandId)
      .eq("tenant_id", tenantData.tenant_id);

    const totalSpend = (aiLogs || []).reduce((sum: number, l: any) => sum + (parseFloat(l.estimated_cost_usd) || 0), 0);
    const tier1Tokens = (aiLogs || []).filter((l: any) => l.model_tier === "TIER_1").reduce((sum: number, l: any) => sum + (l.token_count || 0), 0);
    const tier2Tokens = (aiLogs || []).filter((l: any) => l.model_tier === "TIER_2").reduce((sum: number, l: any) => sum + (l.token_count || 0), 0);

    return jsonResponse({
      totalSpendUsd: totalSpend,
      budgetCapUsd: 50,
      spendPct: Math.round((totalSpend / 50) * 100),
      tier1UsageTokens: tier1Tokens,
      tier2UsageTokens: tier2Tokens,
      cacheHitRate: 0,
      aiCreditsSavedUsd: 0,
      costPerConversation: totalSpend > 0 ? totalSpend / Math.max(1, (aiLogs || []).length) : 0,
      intentDistribution: [],
    });
  }

  // GET /api/brands/:brandId/analytics/attribution
  if (pathParts.length >= 3 && pathParts[2] === "attribution") {
    const brandId = pathParts[1];
    const periodDays = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const periodStart = new Date(Date.now() - periodDays * 86400000).toISOString();

    const { data: events } = await adminClient
      .from("attribution_events")
      .select("event_type, revenue, created_at, flow_id")
      .eq("brand_id", brandId)
      .gte("created_at", periodStart);

    const revenueByDay: Record<string, number> = {};
    for (const e of events || []) {
      const date = e.created_at?.split("T")[0];
      if (date) revenueByDay[date] = (revenueByDay[date] || 0) + (parseFloat(e.revenue) || 0);
    }

    const { data: shortLinks } = await adminClient
      .from("short_links")
      .select("slug, click_count, destination_url")
      .eq("brand_id", brandId);

    return jsonResponse({
      timeline: Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue })),
      revenueByFlow: [],
      revenueByKeyword: [],
      revenueByTier: [],
      capiCoveragePct: 0,
      shortLinkTable: (shortLinks || []).map((sl: any) => ({
        slug: sl.slug,
        destinationUrl: sl.destination_url,
        clickCount: sl.click_count,
      })),
    });
  }

  // GET /api/brands/:brandId/dashboard
  if (pathParts.length >= 2 && pathParts[0] === "brands" && pathParts[2] === "dashboard") {
    const brandId = pathParts[1];
    const { data: dashboardData } = await adminClient.rpc("get_dashboard_data", { p_brand_id: brandId });
    return jsonResponse(dashboardData);
  }

  return errorResponse("Not found", "NOT_FOUND", 404);
}

// ─── KNOWLEDGE BASE ─────────────────────────────────────────

async function handleKnowledgeBase(req: Request, user: any, adminClient: any, pathParts: string[], method: string) {
  const tenantData = await getTenantForUser(user.id);
  if (!tenantData) return errorResponse("No tenant found", "NO_TENANT", 403);

  // GET /api/brands/:brandId/knowledge-base
  if (method === "GET" && pathParts.length >= 3 && pathParts[0] === "brands" && pathParts[2] === "knowledge-base") {
    const brandId = pathParts[1];
    const { data, error } = await adminClient
      .from("kb_documents")
      .select("id, name, source_type, index_status, chunk_count, strictness, created_at")
      .eq("brand_id", brandId)
      .eq("tenant_id", tenantData.tenant_id);

    if (error) return errorResponse(error.message, "DB_ERROR", 500);
    return jsonResponse(data);
  }

  // GET /api/knowledge-base/:id
  if (method === "GET" && pathParts.length === 1) {
    const { data, error } = await adminClient
      .from("kb_documents")
      .select("*, kb_chunks(id, chunk_index, content, token_count)")
      .eq("id", pathParts[0])
      .eq("tenant_id", tenantData.tenant_id)
      .single();

    if (error || !data) return errorResponse("Document not found", "NOT_FOUND", 404);
    return jsonResponse({
      ...data,
      chunks: (data.kb_chunks || []).map((c: any) => ({
        id: c.id,
        chunkIndex: c.chunk_index,
        contentPreview: c.content?.substring(0, 200),
        charCount: c.content?.length || 0,
      })),
    });
  }

  // DELETE /api/knowledge-base/:id
  if (method === "DELETE" && pathParts.length === 1) {
    await adminClient.from("kb_chunks").delete().eq("document_id", pathParts[0]);
    const { error } = await adminClient
      .from("kb_documents")
      .delete()
      .eq("id", pathParts[0])
      .eq("tenant_id", tenantData.tenant_id);

    if (error) return errorResponse(error.message, "DB_ERROR", 500);
    return jsonResponse({ success: true });
  }

  return errorResponse("Not found", "NOT_FOUND", 404);
}

// ─── BROADCASTS ─────────────────────────────────────────────

async function handleBroadcasts(req: Request, user: any, adminClient: any, pathParts: string[], method: string) {
  const tenantData = await getTenantForUser(user.id);
  if (!tenantData) return errorResponse("No tenant found", "NO_TENANT", 403);

  // GET /api/brands/:brandId/broadcasts
  if (method === "GET" && pathParts.length >= 3 && pathParts[0] === "brands" && pathParts[2] === "broadcasts") {
    const brandId = pathParts[1];
    const url = new URL(req.url);
    const status = url.searchParams.get("status");

    let query = adminClient
      .from("broadcasts")
      .select("*")
      .eq("brand_id", brandId)
      .eq("tenant_id", tenantData.tenant_id);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return errorResponse(error.message, "DB_ERROR", 500);
    return jsonResponse(data);
  }

  // POST /api/brands/:brandId/broadcasts
  if (method === "POST" && pathParts.length >= 3 && pathParts[0] === "brands" && pathParts[2] === "broadcasts") {
    const body = await req.json();
    const brandId = pathParts[1];

    const { data, error } = await adminClient
      .from("broadcasts")
      .insert({
        tenant_id: tenantData.tenant_id,
        brand_id: brandId,
        name: body.name,
        platform: body.platform,
        status: "draft",
        message_content: body.messageContent,
        audience_filters: body.audienceFilters || [],
        message_tag: body.messageTag,
        scheduled_at: body.scheduledAt,
      })
      .select()
      .single();

    if (error) return errorResponse(error.message, "DB_ERROR", 400);
    return jsonResponse(data, 201);
  }

  // POST /api/broadcasts/:id/estimate-reach
  if (method === "POST" && pathParts.length === 2 && pathParts[1] === "estimate-reach") {
    const body = await req.json();
    const filters = body.audienceFilters || [];

    // Estimate reach based on filters
    let query = adminClient
      .from("unified_contacts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantData.tenant_id)
      .is("gdpr_deleted_at", null);

    for (const f of filters) {
      if (f.field === "loyaltyTier") query = query.eq("loyalty_tier", f.value);
      if (f.field === "tags" && f.operator === "contains") query = query.contains("tags", [f.value]);
    }

    const { count, error } = await query;
    if (error) return errorResponse(error.message, "DB_ERROR", 500);

    return jsonResponse({
      estimatedReach: count || 0,
      eligibleReach: Math.floor((count || 0) * 0.3),
      windowComplianceRate: 30,
    });
  }

  // DELETE /api/broadcasts/:id
  if (method === "DELETE" && pathParts.length === 1) {
    const { error } = await adminClient
      .from("broadcasts")
      .delete()
      .eq("id", pathParts[0])
      .eq("tenant_id", tenantData.tenant_id);

    if (error) return errorResponse(error.message, "DB_ERROR", 500);
    return jsonResponse({ success: true });
  }

  return errorResponse("Not found", "NOT_FOUND", 404);
}

// ─── DLQ ────────────────────────────────────────────────────

async function handleDlq(req: Request, user: any, adminClient: any, pathParts: string[], method: string) {
  const tenantData = await getTenantForUser(user.id);
  if (!tenantData) return errorResponse("No tenant found", "NO_TENANT", 403);

  // GET /api/brands/:brandId/dlq
  if (method === "GET" && pathParts.length >= 3 && pathParts[0] === "brands" && pathParts[2] === "dlq") {
    const brandId = pathParts[1];
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const perPage = parseInt(url.searchParams.get("perPage") || "25");
    const status = url.searchParams.get("status");
    const errorCode = url.searchParams.get("errorCode");

    let query = adminClient
      .from("dlq_messages")
      .select("*", { count: "exact" })
      .eq("brand_id", brandId)
      .eq("tenant_id", tenantData.tenant_id)
      .order("created_at", { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);

    if (status) query = query.eq("status", status);
    if (errorCode) query = query.eq("error_code", errorCode);

    const { data, error, count } = await query;
    if (error) return errorResponse(error.message, "DB_ERROR", 500);

    const pendingCount = (data || []).filter((d: any) => d.status === "PENDING").length;

    return jsonResponse({
      messages: (data || []).map((d: any) => ({
        id: d.id,
        createdAt: d.created_at,
        platform: d.platform,
        flowName: d.flow_name,
        nodeName: d.node_name,
        errorCode: d.error_code,
        errorLabel: d.error_code === "24H_WINDOW_EXPIRED" ? "24-hour window expired" :
                    d.error_code === "TOKEN_INVALID" ? "Token invalid" :
                    d.error_code === "CIRCUIT_OPEN" ? "Circuit breaker open" : d.error_code,
        status: d.status,
        retryCount: d.retry_count,
        originalPayload: d.original_payload,
      })),
      totalCount: count || 0,
      pendingCount,
      autoReplayNextIn: 900,
      meta: { page, perPage, total: count || 0, hasNext: (count || 0) > page * perPage },
    });
  }

  // POST /api/dlq/:id/replay
  if (method === "POST" && pathParts.length === 2 && pathParts[1] === "replay") {
    const { data, error } = await adminClient
      .from("dlq_messages")
      .update({ status: "REPLAYING", replayed_at: new Date().toISOString() })
      .eq("id", pathParts[0])
      .eq("tenant_id", tenantData.tenant_id)
      .select()
      .single();

    if (error) return errorResponse(error.message, "DB_ERROR", 400);
    if (!data) return errorResponse("Message not found", "NOT_FOUND", 404);
    return jsonResponse({ status: "REPLAYING" });
  }

  // POST /api/dlq/:id/dismiss
  if (method === "POST" && pathParts.length === 2 && pathParts[1] === "dismiss") {
    const { data, error } = await adminClient
      .from("dlq_messages")
      .update({ status: "DISMISSED", dismissed_at: new Date().toISOString() })
      .eq("id", pathParts[0])
      .eq("tenant_id", tenantData.tenant_id)
      .select()
      .single();

    if (error) return errorResponse(error.message, "DB_ERROR", 400);
    if (!data) return errorResponse("Message not found", "NOT_FOUND", 404);
    return jsonResponse({ status: "DISMISSED" });
  }

  return errorResponse("Not found", "NOT_FOUND", 404);
}

// ─── HEALTH ─────────────────────────────────────────────────

async function handleHealth(req: Request, user: any, adminClient: any, pathParts: string[], method: string) {
  const tenantData = await getTenantForUser(user.id);
  if (!tenantData) return errorResponse("No tenant found", "NO_TENANT", 403);

  // GET /api/brands/:brandId/health
  if (method === "GET" && pathParts.length >= 2 && pathParts[0] === "brands" && pathParts[2] === "health") {
    const brandId = pathParts[1];
    const { data: accounts, error } = await adminClient
      .from("connected_accounts")
      .select("id, platform, platform_username, health_status, circuit_state, failure_count, failure_rate_60s, token_expires_at, last_refresh_at, last_webhook_at, granted_scopes")
      .eq("brand_id", brandId)
      .eq("tenant_id", tenantData.tenant_id);

    if (error) return errorResponse(error.message, "DB_ERROR", 500);

    const healthy = (accounts || []).filter((a: any) => a.health_status === "HEALTHY").length;
    const expiring = (accounts || []).filter((a: any) => a.health_status === "EXPIRING").length;
    const broken = (accounts || []).filter((a: any) => a.health_status === "BROKEN").length;

    return jsonResponse({
      summary: { healthy, expiringSoon: expiring, broken, total: accounts?.length || 0 },
      accounts: (accounts || []).map((a: any) => ({
        id: a.id,
        platform: a.platform,
        platformUsername: a.platform_username,
        healthStatus: a.health_status,
        tokenAgeHours: a.last_refresh_at ? Math.round((Date.now() - new Date(a.last_refresh_at).getTime()) / 3600000) : null,
        expiresInHours: a.token_expires_at ? Math.round((new Date(a.token_expires_at).getTime() - Date.now()) / 3600000) : null,
        lastWebhookAt: a.last_webhook_at,
        circuitState: a.circuit_state,
        failureRate: a.failure_rate_60s ? `${(a.failure_rate_60s * 100).toFixed(1)}%` : "0%",
        grantedScopes: a.granted_scopes || [],
        missingScopes: [],
      })),
    });
  }

  return errorResponse("Not found", "NOT_FOUND", 404);
}

// ─── SETTINGS ───────────────────────────────────────────────

async function handleSettings(req: Request, user: any, adminClient: any, pathParts: string[], method: string) {
  const tenantData = await getTenantForUser(user.id);
  if (!tenantData) return errorResponse("No tenant found", "NO_TENANT", 403);

  // GET /api/tenants/:id/users
  if (method === "GET" && pathParts.length >= 3 && pathParts[1] === "users") {
    const { data, error } = await adminClient
      .from("team_members")
      .select("id, user_id, role, created_at")
      .eq("tenant_id", tenantData.tenant_id);

    if (error) return errorResponse(error.message, "DB_ERROR", 500);
    return jsonResponse(data);
  }

  // DELETE /api/tenants/:id/users/:userId
  if (method === "DELETE" && pathParts.length >= 3 && pathParts[1] === "users") {
    const { error } = await adminClient
      .from("team_members")
      .delete()
      .eq("user_id", pathParts[2])
      .eq("tenant_id", tenantData.tenant_id);

    if (error) return errorResponse(error.message, "DB_ERROR", 500);
    return jsonResponse({ success: true });
  }

  // GET /api/tenants/:id/billing
  if (method === "GET" && pathParts.length >= 2 && pathParts[1] === "billing") {
    const { data: tenant } = await adminClient
      .from("tenants")
      .select("plan, stripe_customer_id")
      .eq("id", tenantData.tenant_id)
      .single();

    return jsonResponse({
      plan: tenant?.plan || "FREE",
      stripeCustomerId: tenant?.stripe_customer_id,
      usage: { accounts: 0, contacts: 0, aiMessages: 0 },
      limits: { accounts: tenant?.plan === "LEGEND" ? 50 : tenant?.plan === "PRO" ? 10 : 3, contacts: tenant?.plan === "LEGEND" ? 100000 : tenant?.plan === "PRO" ? 10000 : 1000, aiMessages: tenant?.plan === "LEGEND" ? 10000 : tenant?.plan === "PRO" ? 2000 : 500 },
      invoices: [],
    });
  }

  // GET /api/tenants/:id/api-keys
  if (method === "GET" && pathParts.length >= 2 && pathParts[1] === "api-keys") {
    const { data, error } = await adminClient
      .from("api_keys")
      .select("id, name, scopes, last_used_at, revoked_at, created_at")
      .eq("tenant_id", tenantData.tenant_id)
      .is("revoked_at", null);

    if (error) return errorResponse(error.message, "DB_ERROR", 500);
    return jsonResponse(data);
  }

  // POST /api/tenants/:id/api-keys
  if (method === "POST" && pathParts.length >= 2 && pathParts[1] === "api-keys") {
    const body = await req.json();
    const rawKey = `fp_live_${btoa(crypto.randomUUID())}`;
    const keyHash = await hashKey(rawKey);

    const { data, error } = await adminClient
      .from("api_keys")
      .insert({
        tenant_id: tenantData.tenant_id,
        name: body.name,
        key_hash: keyHash,
        scopes: body.scopes || [],
      })
      .select("id, name, scopes, created_at")
      .single();

    if (error) return errorResponse(error.message, "DB_ERROR", 400);
    return jsonResponse({ ...data, key: rawKey }, 201);
  }

  // DELETE /api/tenants/:id/api-keys/:keyId
  if (method === "DELETE" && pathParts.length >= 3 && pathParts[1] === "api-keys") {
    const { data, error } = await adminClient
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", pathParts[2])
      .eq("tenant_id", tenantData.tenant_id)
      .select("revoked_at")
      .single();

    if (error) return errorResponse(error.message, "DB_ERROR", 500);
    return jsonResponse({ revokedAt: data?.revoked_at });
  }

  return errorResponse("Not found", "NOT_FOUND", 404);
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── SHORT LINKS ────────────────────────────────────────────

async function handleShortLinks(req: Request, user: any, adminClient: any, pathParts: string[], method: string) {
  const tenantData = await getTenantForUser(user.id);
  if (!tenantData) return errorResponse("No tenant found", "NO_TENANT", 403);

  // GET /api/brands/:brandId/short-links
  if (method === "GET" && pathParts.length >= 3 && pathParts[0] === "brands" && pathParts[2] === "short-links") {
    const brandId = pathParts[1];
    const { data, error } = await adminClient
      .from("short_links")
      .select("id, slug, destination_url, click_count, custom_domain, created_at, expires_at")
      .eq("brand_id", brandId)
      .eq("tenant_id", tenantData.tenant_id);

    if (error) return errorResponse(error.message, "DB_ERROR", 500);
    return jsonResponse(data);
  }

  // POST /api/brands/:brandId/short-links
  if (method === "POST" && pathParts.length >= 3 && pathParts[0] === "brands" && pathParts[2] === "short-links") {
    const body = await req.json();
    const brandId = pathParts[1];
    const slug = body.customSlug || Math.random().toString(36).substring(2, 7);
    const identityToken = crypto.randomUUID();

    const { data, error } = await adminClient
      .from("short_links")
      .insert({
        tenant_id: tenantData.tenant_id,
        brand_id: brandId,
        slug,
        destination_url: body.destinationUrl,
        identity_token: identityToken,
        contact_id: body.contactId,
        flow_id: body.flowId,
        custom_domain: body.customDomain,
        expires_at: body.expiresAt,
      })
      .select()
      .single();

    if (error) return errorResponse(error.message, "DB_ERROR", 400);
    return jsonResponse(data, 201);
  }

  return errorResponse("Not found", "NOT_FOUND", 404);
}

// ─── MAIN ROUTER ─────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathSegments = url.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);

  // Remove 'api' prefix if present
  if (pathSegments[0] === "api") pathSegments.shift();

  const method = req.method;

  // Authenticate
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return errorResponse("Authentication required", "UNAUTHORIZED", 401);
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Route to handler based on first path segment
    const resource = pathSegments[0] || "";

    // Brands: GET/PATCH /api/brands, GET/POST/PATCH /api/brands/:id
    if (resource === "brands" && pathSegments.length <= 2) {
      return await handleBrands(req, user, adminClient, pathSegments.slice(1), method);
    }

    // Connected Accounts: /api/brands/:brandId/connected-accounts or /api/connected-accounts/:id
    if (resource === "brands" && pathSegments.length >= 3 && pathSegments[2] === "connected-accounts") {
      return await handleConnectedAccounts(req, user, adminClient, pathSegments.slice(3), method);
    }
    if (resource === "connected-accounts") {
      return await handleConnectedAccounts(req, user, adminClient, pathSegments.slice(1), method);
    }

    // Flows: /api/brands/:brandId/flows or /api/flows/:id
    if (resource === "brands" && pathSegments.length >= 3 && pathSegments[2] === "flows") {
      return await handleFlows(req, user, adminClient, [pathSegments[1], "flows", ...pathSegments.slice(3)], method);
    }
    if (resource === "flows") {
      return await handleFlows(req, user, adminClient, pathSegments.slice(1), method);
    }

    // Conversations/Inbox: /api/brands/:brandId/conversations or /api/conversations/:id
    if (resource === "brands" && pathSegments.length >= 3 && pathSegments[2] === "conversations") {
      return await handleInbox(req, user, adminClient, ["brands", pathSegments[1], "conversations", ...pathSegments.slice(3)], method);
    }
    if (resource === "conversations") {
      return await handleInbox(req, user, adminClient, pathSegments.slice(1), method);
    }

    // Contacts: /api/brands/:brandId/contacts or /api/contacts/:id
    if (resource === "brands" && pathSegments.length >= 3 && pathSegments[2] === "contacts") {
      return await handleContacts(req, user, adminClient, ["brands", pathSegments[1], "contacts", ...pathSegments.slice(3)], method);
    }
    if (resource === "contacts") {
      return await handleContacts(req, user, adminClient, pathSegments.slice(1), method);
    }

    // Analytics: /api/brands/:brandId/analytics/*
    if (resource === "brands" && pathSegments.length >= 4 && pathSegments[2] === "analytics") {
      return await handleAnalytics(req, user, adminClient, ["brands", pathSegments[1], ...pathSegments.slice(2)], method);
    }

    // Dashboard: /api/brands/:brandId/dashboard
    if (resource === "brands" && pathSegments.length >= 3 && pathSegments[2] === "dashboard") {
      return await handleAnalytics(req, user, adminClient, ["brands", pathSegments[1], "dashboard"], method);
    }

    // Health: /api/brands/:brandId/health
    if (resource === "brands" && pathSegments.length >= 3 && pathSegments[2] === "health") {
      return await handleHealth(req, user, adminClient, pathSegments.slice(1), method);
    }

    // Knowledge Base: /api/brands/:brandId/knowledge-base or /api/knowledge-base/:id
    if (resource === "brands" && pathSegments.length >= 3 && pathSegments[2] === "knowledge-base") {
      return await handleKnowledgeBase(req, user, adminClient, ["brands", pathSegments[1], "knowledge-base", ...pathSegments.slice(3)], method);
    }
    if (resource === "knowledge-base") {
      return await handleKnowledgeBase(req, user, adminClient, pathSegments.slice(1), method);
    }

    // Broadcasts: /api/brands/:brandId/broadcasts or /api/broadcasts/:id
    if (resource === "brands" && pathSegments.length >= 3 && pathSegments[2] === "broadcasts") {
      return await handleBroadcasts(req, user, adminClient, ["brands", pathSegments[1], "broadcasts", ...pathSegments.slice(3)], method);
    }
    if (resource === "broadcasts") {
      return await handleBroadcasts(req, user, adminClient, pathSegments.slice(1), method);
    }

    // DLQ: /api/brands/:brandId/dlq or /api/dlq/:id
    if (resource === "brands" && pathSegments.length >= 3 && pathSegments[2] === "dlq") {
      return await handleDlq(req, user, adminClient, ["brands", pathSegments[1], "dlq", ...pathSegments.slice(3)], method);
    }
    if (resource === "dlq") {
      return await handleDlq(req, user, adminClient, pathSegments.slice(1), method);
    }

    // Short Links: /api/brands/:brandId/short-links
    if (resource === "brands" && pathSegments.length >= 3 && pathSegments[2] === "short-links") {
      return await handleShortLinks(req, user, adminClient, ["brands", pathSegments[1], "short-links", ...pathSegments.slice(3)], method);
    }

    // Settings: /api/tenants/:id/*
    if (resource === "tenants") {
      return await handleSettings(req, user, adminClient, pathSegments.slice(1), method);
    }

    return errorResponse("Not found", "NOT_FOUND", 404);
  } catch (err) {
    console.error("API Error:", err);
    return errorResponse("Internal server error", "INTERNAL_ERROR", 500, true);
  }
});
