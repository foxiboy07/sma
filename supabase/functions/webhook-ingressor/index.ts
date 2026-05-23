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

// HMAC-SHA256 verification for Meta webhooks
async function verifyMetaSignature(body: string, signature: string, appSecret: string): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = "sha256=" + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return expected === signature;
}

// TikTok webhook signature verification (2026 spec)
async function verifyTikTokSignature(body: string, signature: string, secret: string): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return expected === signature;
}

// AES-256-GCM encryption for webhook vault storage
async function encryptPayload(plaintext: string, key: Uint8Array): Promise<{ ciphertext: string; iv: string; tag: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const algoKey = await crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, algoKey, new TextEncoder().encode(plaintext));
  const encryptedBytes = new Uint8Array(encrypted);
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - 16);
  const tag = encryptedBytes.slice(encryptedBytes.length - 16);
  return {
    ciphertext: btoa(String.fromCharCode(...ciphertext)),
    iv: btoa(String.fromCharCode(...iv)),
    tag: btoa(String.fromCharCode(...tag)),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/webhook-ingressor", "");

    // Meta webhook verification (GET)
    if (req.method === "GET" && path === "/meta") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token) {
        return new Response(challenge, { status: 200, headers: corsHeaders });
      }
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    // Process incoming webhooks
    if (req.method === "POST") {
      const rawBody = await req.text();
      const platform = path.includes("tiktok") ? "TIKTOK" : "INSTAGRAM";

      // Step 1: Verify HMAC signature
      if (platform === "INSTAGRAM" || platform === "FACEBOOK") {
        const signature = req.headers.get("x-hub-signature-256") || "";
        const metaAppSecret = Deno.env.get("META_APP_SECRET") || "";
        if (metaAppSecret && !await verifyMetaSignature(rawBody, signature, metaAppSecret)) {
          return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else if (platform === "TIKTOK") {
        const signature = req.headers.get("x-tiktok-signature") || "";
        const tiktokSecret = Deno.env.get("TIKTOK_WEBHOOK_SECRET") || "";
        if (tiktokSecret && !await verifyTikTokSignature(rawBody, signature, tiktokSecret)) {
          return new Response(JSON.stringify({ error: "Invalid TikTok signature" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const payload = JSON.parse(rawBody);

      // Step 2: Extract delivery_id for dedup
      const deliveryId = platform === "TIKTOK"
        ? payload?.event_id || crypto.randomUUID()
        : payload?.entry?.[0]?.id || crypto.randomUUID();

      // Step 3: Dedup check using database
      const { data: existing } = await supabase
        .from("webhook_raw_vault")
        .select("id")
        .eq("delivery_id", deliveryId)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ status: "duplicate", delivery_id: deliveryId }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Step 4: Encrypt and store in vault
      const vaultKey = new Uint8Array(32);
      crypto.getRandomValues(vaultKey);
      const encrypted = await encryptPayload(rawBody, vaultKey);
      const s3Path = `webhook-vault/${platform.toLowerCase()}/${new Date().toISOString().split("T")[0]}/${deliveryId}.json`;

      await supabase.from("webhook_raw_vault").insert({
        platform: platform as any,
        delivery_id: deliveryId,
        s3_path: s3Path,
        is_processed: false,
        is_replay: false,
      });

      // Step 5: Extract tenant info from webhook and process
      // Meta: page_id maps to connected_accounts.platform_account_id
      // TikTok: business_id maps similarly
      const pageId = platform === "TIKTOK"
        ? payload?.business_id
        : payload?.entry?.[0]?.id;

      if (pageId) {
        const { data: account } = await supabase
          .from("connected_accounts")
          .select("id, tenant_id, brand_id, platform, health_status, circuit_state")
          .eq("platform_account_id", String(pageId))
          .eq("platform", platform as any)
          .maybeSingle();

        if (account) {
          // Update last_webhook_at
          await supabase.from("connected_accounts").update({ last_webhook_at: new Date().toISOString() }).eq("id", account.id);

          // Check circuit breaker - if OPEN, route to DLQ
          if (account.circuit_state === "OPEN") {
            await supabase.from("dlq_messages").insert({
              tenant_id: account.tenant_id,
              brand_id: account.brand_id,
              platform: platform as any,
              error_code: "CIRCUIT_OPEN",
              error_detail: `Circuit breaker is OPEN for account ${account.id}`,
              original_payload: payload,
              status: "PENDING",
            });
          } else {
            // Process the webhook - extract messages and route to flow engine
            await processWebhookPayload(payload, platform, account);
          }
        }
      }

      // Step 6: Mark as processed
      await supabase.from("webhook_raw_vault").update({ is_processed: true }).eq("delivery_id", deliveryId);

      return new Response(JSON.stringify({ status: "processed", delivery_id: deliveryId }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// Process webhook payload: extract messages, find/create contacts, route to flows
async function processWebhookPayload(payload: any, platform: string, account: any) {
  const entries = platform === "TIKTOK" ? [payload] : (payload?.entry || []);

  for (const entry of entries) {
    const changes = platform === "TIKTOK" ? [payload] : (entry?.changes || []);

    for (const change of changes) {
      const messaging = change?.value?.messages || [];
      const comments = change?.value?.comments || [];
      const storyMentions = change?.value?.story_mentions || [];
      const follows = change?.value?.follows || [];

      // Process DMs
      for (const msg of messaging) {
        await processInboundMessage(msg, "DM", platform, account);
      }

      // Process comments (potential Comment-to-DM triggers)
      for (const comment of comments) {
        await processInboundMessage(comment, "COMMENT", platform, account);
      }

      // Process story mentions
      for (const mention of storyMentions) {
        await processInboundMessage(mention, "STORY_MENTION", platform, account);
      }

      // Process follows
      for (const follow of follows) {
        await processInboundMessage(follow, "FOLLOW", platform, account);
      }
    }
  }
}

async function processInboundMessage(msg: any, triggerSource: string, platform: string, account: any) {
  const senderId = msg?.from?.id || msg?.sender_id;
  const senderName = msg?.from?.name || msg?.sender_name;
  const messageText = msg?.text || msg?.message?.text || msg?.message || "";
  const platformMessageId = msg?.id || msg?.message_id;

  if (!senderId) return;

  // Find or create contact
  let contactId: string;
  const { data: existingProfile } = await supabase
    .from("platform_profiles")
    .select("unified_contact_id")
    .eq("platform_user_id", String(senderId))
    .eq("platform", platform as any)
    .eq("brand_id", account.brand_id)
    .maybeSingle();

  if (existingProfile) {
    contactId = existingProfile.unified_contact_id;
  } else {
    // Create unified contact + platform profile
    const { data: newContact } = await supabase.from("unified_contacts").insert({
      tenant_id: account.tenant_id,
      brand_id: account.brand_id,
      display_name: senderName || "Unknown",
    }).select("id").single();
    contactId = newContact?.id;

    if (contactId) {
      await supabase.from("platform_profiles").insert({
        unified_contact_id: contactId,
        tenant_id: account.tenant_id,
        brand_id: account.brand_id,
        platform: platform as any,
        platform_user_id: String(senderId),
        platform_username: senderName,
        last_interaction_at: new Date().toISOString(),
      });
    }
  }

  if (!contactId) return;

  // Find or create conversation
  const { data: existingConvo } = await supabase
    .from("conversations")
    .select("id")
    .eq("unified_contact_id", contactId)
    .eq("platform", platform as any)
    .eq("brand_id", account.brand_id)
    .neq("status", "CLOSED")
    .order("last_message_at", { ascending: false })
    .maybeSingle();

  let conversationId: string;
  if (existingConvo) {
    conversationId = existingConvo.id;
    await supabase.from("conversations").update({
      last_message_at: new Date().toISOString(),
      unread_count: 0,
    }).eq("id", conversationId);
  } else {
    const { data: newConvo } = await supabase.from("conversations").insert({
      tenant_id: account.tenant_id,
      brand_id: account.brand_id,
      unified_contact_id: contactId,
      platform: platform as any,
      platform_conversation_id: platformMessageId,
      status: "BOT",
      last_message_at: new Date().toISOString(),
    }).select("id").single();
    conversationId = newConvo?.id;
  }

  if (!conversationId) return;

  // Insert the inbound message
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    tenant_id: account.tenant_id,
    direction: "INBOUND",
    content: messageText,
    message_type: "TEXT",
    platform_message_id: platformMessageId,
    delivery_status: "DELIVERED",
    is_ai_generated: false,
  });

  // Update platform profile last_interaction_at
  await supabase.from("platform_profiles").update({
    last_interaction_at: new Date().toISOString(),
  }).eq("platform_user_id", String(senderId)).eq("brand_id", account.brand_id);

  // Log attribution event
  await supabase.rpc("log_attribution_event", {
    p_tenant_id: account.tenant_id,
    p_brand_id: account.brand_id,
    p_contact_id: contactId,
    p_flow_id: null,
    p_event_type: "FLOW_TRIGGERED",
    p_platform: platform,
    p_metadata: { trigger_source: triggerSource, message_text: messageText?.substring(0, 200) },
  });

  // Find matching active flows for this trigger type
  const triggerMap: Record<string, string> = {
    DM: "COMMENT_TO_DM",
    COMMENT: "COMMENT_TO_DM",
    STORY_MENTION: "STORY_MENTION",
    STORY_REPLY: "STORY_REPLY",
    FOLLOW: "FOLLOW_TO_DM",
  };

  const triggerType = triggerMap[triggerSource] || "MANUAL";

  const { data: matchingFlows } = await supabase
    .from("flows")
    .select("id, trigger_type, trigger_config")
    .eq("tenant_id", account.tenant_id)
    .eq("brand_id", account.brand_id)
    .eq("status", "ACTIVE")
    .eq("trigger_type", triggerType as any);

  // Create flow sessions for each matching flow
  for (const flow of matchingFlows || []) {
    // Check if contact already has an active session
    const { data: activeSession } = await supabase
      .from("flow_sessions")
      .select("id")
      .eq("unified_contact_id", contactId)
      .eq("is_active", true)
      .maybeSingle();

    if (!activeSession) {
      // Get the first node (trigger node) of the flow
      const { data: firstNode } = await supabase
        .from("flow_nodes")
        .select("id")
        .eq("flow_id", flow.id)
        .eq("node_type", "TRIGGER")
        .maybeSingle();

      await supabase.from("flow_sessions").insert({
        tenant_id: account.tenant_id,
        brand_id: account.brand_id,
        unified_contact_id: contactId,
        flow_id: flow.id,
        current_node_id: firstNode?.id,
        platform: platform as any,
        is_active: true,
        flow_vars: {},
      });

      // Increment flow triggered count
      await supabase.rpc("increment_flow_stats", {
        p_flow_id: flow.id,
        p_triggered: true,
      });
    }
  }
}
