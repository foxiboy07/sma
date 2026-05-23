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

// AES-256-GCM encryption (KMS-style envelope encryption)
async function generateDataKey(): Promise<{ plaintext: Uint8Array; encrypted: string }> {
  const key = crypto.getRandomValues(new Uint8Array(32));
  // In production, this would call KMS GenerateDataKey
  // For Supabase, we use a master key from env to encrypt the data key
  const masterKeyStr = Deno.env.get("ENCRYPTION_MASTER_KEY") || "default-master-key-change-in-prod-32b";
  const masterKey = new TextEncoder().encode(masterKeyStr.padEnd(32, "0").slice(0, 32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const algoKey = await crypto.subtle.importKey("raw", masterKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, algoKey, key);
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return { plaintext: key, encrypted: btoa(String.fromCharCode(...combined)) };
}

async function decryptDataKey(encryptedKey: string): Promise<Uint8Array> {
  const masterKeyStr = Deno.env.get("ENCRYPTION_MASTER_KEY") || "default-master-key-change-in-prod-32b";
  const masterKey = new TextEncoder().encode(masterKeyStr.padEnd(32, "0").slice(0, 32));
  const combined = Uint8Array.from(atob(encryptedKey), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const algoKey = await crypto.subtle.importKey("raw", masterKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, algoKey, ciphertext);
  return new Uint8Array(decrypted);
}

async function encryptToken(token: string, dataKey: Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const algoKey = await crypto.subtle.importKey("raw", dataKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, algoKey, new TextEncoder().encode(token));
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptToken(encryptedToken: string, dataKey: Uint8Array): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const algoKey = await crypto.subtle.importKey("raw", dataKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, algoKey, ciphertext);
  return new TextDecoder().decode(decrypted);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/token-vault", "");

    // POST /encrypt - Encrypt and store a token
    if (req.method === "POST" && path === "/encrypt") {
      const { account_id, access_token, refresh_token } = await req.json();
      const { plaintext: dataKey, encrypted: encryptedDataKey } = await generateDataKey();
      const encAccess = await encryptToken(access_token, dataKey);
      const encRefresh = refresh_token ? await encryptToken(refresh_token, dataKey) : null;

      await supabase.from("connected_accounts").update({
        encrypted_access_token: encAccess,
        encrypted_refresh_token: encRefresh,
        encrypted_data_key: encryptedDataKey,
        last_refresh_at: new Date().toISOString(),
        health_status: "HEALTHY",
      }).eq("id", account_id);

      return new Response(JSON.stringify({ status: "encrypted" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /decrypt - Decrypt a token for API use
    if (req.method === "POST" && path === "/decrypt") {
      const { account_id, calling_service } = await req.json();
      const { data: account } = await supabase
        .from("connected_accounts")
        .select("id, encrypted_access_token, encrypted_refresh_token, encrypted_data_key, health_status, token_expires_at")
        .eq("id", account_id)
        .maybeSingle();

      if (!account || !account.encrypted_data_key || !account.encrypted_access_token) {
        return new Response(JSON.stringify({ error: "No encrypted token found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check if token is expired
      if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
        await supabase.from("connected_accounts").update({ health_status: "BROKEN" }).eq("id", account_id);
        return new Response(JSON.stringify({ error: "Token expired", health: "BROKEN" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const dataKey = await decryptDataKey(account.encrypted_data_key);
      const accessToken = await decryptToken(account.encrypted_access_token, dataKey);

      // Audit the decryption
      await supabase.from("token_decryption_audit").insert({
        connected_account_id: account_id,
        calling_service: calling_service || "unknown",
      });

      return new Response(JSON.stringify({ access_token: accessToken }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /refresh - Auto-refresh tokens expiring within 48h
    if (req.method === "POST" && path === "/refresh") {
      const cutoff = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const { data: expiringAccounts } = await supabase
        .from("connected_accounts")
        .select("id, tenant_id, brand_id, platform, encrypted_refresh_token, encrypted_data_key, platform_account_id, health_status")
        .lt("token_expires_at", cutoff)
        .neq("health_status", "BROKEN");

      const results = [];
      for (const account of expiringAccounts || []) {
        if (!account.encrypted_refresh_token || !account.encrypted_data_key) {
          results.push({ id: account.id, status: "skipped", reason: "no_refresh_token" });
          continue;
        }

        try {
          const dataKey = await decryptDataKey(account.encrypted_data_key);
          const refreshToken = await decryptToken(account.encrypted_refresh_token, dataKey);

          // Attempt token refresh via platform API
          let newAccessToken: string | null = null;
          let newRefreshToken: string | null = null;
          let newExpiresAt: string | null = null;

          if (account.platform === "INSTAGRAM" || account.platform === "FACEBOOK") {
            const appId = Deno.env.get("META_APP_ID") || "";
            const appSecret = Deno.env.get("META_APP_SECRET") || "";
            const res = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${refreshToken}`);
            const data = await res.json();
            if (data.access_token) {
              newAccessToken = data.access_token;
              newExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // ~60 days
            }
          } else if (account.platform === "TIKTOK") {
            const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY") || "";
            const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET") || "";
            const res = await fetch("https://business-api.tiktok.com/open/v1.3/oauth2/refresh_token/", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ client_key: clientKey, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: refreshToken }),
            });
            const data = await res.json();
            if (data?.data?.access_token) {
              newAccessToken = data.data.access_token;
              newRefreshToken = data.data.refresh_token || null;
              newExpiresAt = new Date(Date.now() + (data.data.expires_in || 86400) * 1000).toISOString();
            }
          }

          if (newAccessToken) {
            const { plaintext: newDataKey, encrypted: newEncDataKey } = await generateDataKey();
            const encAccess = await encryptToken(newAccessToken, newDataKey);
            const encRefresh = newRefreshToken ? await encryptToken(newRefreshToken, newDataKey) : null;

            await supabase.from("connected_accounts").update({
              encrypted_access_token: encAccess,
              encrypted_refresh_token: encRefresh || account.encrypted_refresh_token,
              encrypted_data_key: newEncDataKey,
              token_expires_at: newExpiresAt,
              last_refresh_at: new Date().toISOString(),
              health_status: "HEALTHY",
            }).eq("id", account.id);

            // Notify tenant
            await supabase.from("notifications").insert({
              tenant_id: account.tenant_id,
              brand_id: account.brand_id,
              type: "account.token_refreshed",
              title: "Token Refreshed",
              description: `${account.platform} account token was auto-refreshed`,
              is_read: false,
            });

            results.push({ id: account.id, status: "refreshed" });
          } else {
            throw new Error("No access token in response");
          }
        } catch (err) {
          await supabase.from("connected_accounts").update({
            health_status: "BROKEN",
            failure_count: 0,
          }).eq("id", account.id);

          await supabase.from("notifications").insert({
            tenant_id: account.tenant_id,
            brand_id: account.brand_id,
            type: "account.token_broken",
            title: "Token Broken",
            description: `${account.platform} account token refresh failed: ${err.message}`,
            is_read: false,
          });

          results.push({ id: account.id, status: "failed", error: err.message });
        }
      }

      return new Response(JSON.stringify({ refreshed: results }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /health - Check token health for an account
    if (req.method === "GET" && path.startsWith("/health")) {
      const accountId = url.searchParams.get("account_id");
      if (!accountId) {
        return new Response(JSON.stringify({ error: "account_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: account } = await supabase
        .from("connected_accounts")
        .select("id, platform, platform_username, health_status, token_expires_at, last_refresh_at, last_webhook_at, circuit_state, failure_count, granted_scopes")
        .eq("id", accountId)
        .maybeSingle();

      if (!account) {
        return new Response(JSON.stringify({ error: "Account not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const hoursUntilExpiry = account.token_expires_at
        ? (new Date(account.token_expires_at).getTime() - Date.now()) / (1000 * 60 * 60)
        : null;

      let healthStatus = account.health_status;
      if (hoursUntilExpiry !== null && hoursUntilExpiry < 72 && healthStatus === "HEALTHY") {
        healthStatus = "EXPIRING";
        await supabase.from("connected_accounts").update({ health_status: "EXPIRING" }).eq("id", accountId);
      }

      return new Response(JSON.stringify({
        ...account,
        health_status: healthStatus,
        hours_until_expiry: hoursUntilExpiry,
        next_refresh_at: account.token_expires_at
          ? new Date(new Date(account.token_expires_at).getTime() - 48 * 60 * 60 * 1000).toISOString()
          : null,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /force-refresh - Force refresh a specific account
    if (req.method === "POST" && path === "/force-refresh") {
      const { account_id } = await req.json();
      await supabase.from("connected_accounts").update({
        health_status: "HEALTHY",
        failure_count: 0,
        circuit_state: "CLOSED",
      }).eq("id", account_id);

      return new Response(JSON.stringify({ status: "reset", account_id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
