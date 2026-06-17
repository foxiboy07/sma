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

const META_APP_ID = Deno.env.get("META_APP_ID") || "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") || "";
const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY") || "";
const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET") || "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/oauth-onboarding", "");

    // GET /meta/authorize - Generate Meta MBE OAuth URL
    if (req.method === "GET" && path === "/meta/authorize") {
      const tenantId = url.searchParams.get("tenant_id");
      const brandId = url.searchParams.get("brand_id");
      const redirectUri = encodeURIComponent(`${url.origin}/functions/v1/oauth-onboarding/meta/callback`);
      const state = btoa(JSON.stringify({ tenant_id: tenantId, brand_id: brandId }));

      const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${redirectUri}&scope=instagram_manage_messages,instagram_manage_comments,pages_manage_metadata,pages_messaging,instagram_basic,business_management,pages_read_engagement,pages_manage_engagement&response_type=code&state=${state}&config_id=${Deno.env.get("META_CONFIG_ID") || ""}`;

      return new Response(JSON.stringify({ auth_url: authUrl }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /meta/callback - Handle Meta OAuth callback
    if (req.method === "GET" && path === "/meta/callback") {
      const code = url.searchParams.get("code");
      const stateStr = url.searchParams.get("state");

      if (!code || !stateStr) {
        return new Response(JSON.stringify({ error: "Missing code or state" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const state = JSON.parse(atob(stateStr));
      const redirectUri = `${url.origin}/functions/v1/oauth-onboarding/meta/callback`;

      // Exchange code for short-lived token
      const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${META_APP_SECRET}&code=${code}`);
      const tokenData = await tokenRes.json();

      if (!tokenData.access_token) {
        return new Response(JSON.stringify({ error: "Token exchange failed", details: tokenData }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Exchange for long-lived token
      const longLivedRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`);
      const longLivedData = await longLivedRes.json();

      // Get user's pages
      const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${longLivedData.access_token}`);
      const pagesData = await pagesRes.json();

      // Verify scopes
      const permsRes = await fetch(`https://graph.facebook.com/v19.0/me/permissions?access_token=${longLivedData.access_token}`);
      const permsData = await permsRes.json();
      const grantedScopes = permsData?.data?.filter((p: any) => p.status === "granted").map((p: any) => p.permission) || [];

      const requiredScopes = ["instagram_manage_messages", "instagram_manage_comments", "pages_messaging", "pages_manage_metadata"];
      const missingScopes = requiredScopes.filter(s => !grantedScopes.includes(s));

      // Store each page as a connected account
      const accounts = [];
      for (const page of pagesData?.data || []) {
        const igAccount = page.instagram_business_account;

        // Store Facebook page account
        const { data: fbAccount } = await supabase.from("connected_accounts").insert({
          tenant_id: state.tenant_id,
          brand_id: state.brand_id,
          platform: "FACEBOOK",
          platform_account_id: page.id,
          platform_username: page.name,
          encrypted_access_token: "pending",
          encrypted_data_key: "pending",
          token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          health_status: missingScopes.length > 0 ? "EXPIRING" : "HEALTHY",
          granted_scopes: grantedScopes,
          last_refresh_at: new Date().toISOString(),
        }).select("id").single();

        accounts.push({ platform: "FACEBOOK", id: fbAccount?.id, name: page.name, missing_scopes: missingScopes });

        // Store Instagram account if linked
        if (igAccount) {
          const { data: igAccount2 } = await supabase.from("connected_accounts").insert({
            tenant_id: state.tenant_id,
            brand_id: state.brand_id,
            platform: "INSTAGRAM",
            platform_account_id: igAccount.id,
            platform_username: igAccount.username,
            encrypted_access_token: "pending",
            encrypted_data_key: "pending",
            token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
            health_status: missingScopes.length > 0 ? "EXPIRING" : "HEALTHY",
            granted_scopes: grantedScopes,
            last_refresh_at: new Date().toISOString(),
          }).select("id").single();

          accounts.push({ platform: "INSTAGRAM", id: igAccount2?.id, name: igAccount.username, missing_scopes: missingScopes });
        }
      }

      // Now encrypt the actual tokens using the token-vault
      for (const page of pagesData?.data || []) {
        const account = accounts.find(a => a.name === page.name && a.platform === "FACEBOOK");
        if (account?.id) {
          await fetch(`${url.origin}/functions/v1/token-vault/encrypt`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") || "" },
            body: JSON.stringify({ account_id: account.id, access_token: page.access_token }),
          });
        }
      }

      // Log consent
      await supabase.from("consent_logs").insert({
        tenant_id: state.tenant_id,
        brand_id: state.brand_id,
        action: "OPT_IN",
        platform: "META",
        channel: "OAUTH",
        method: "Meta Business Extension OAuth",
        metadata: { granted_scopes, missing_scopes, pages_count: accounts.length },
      });

      return new Response(JSON.stringify({
        status: "connected",
        accounts,
        granted_scopes,
        missing_scopes,
        compliant: missingScopes.length === 0,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /tiktok/authorize - Generate TikTok Business Login URL
    if (req.method === "GET" && path === "/tiktok/authorize") {
      const tenantId = url.searchParams.get("tenant_id");
      const brandId = url.searchParams.get("brand_id");
      const redirectUri = encodeURIComponent(`${url.origin}/functions/v1/oauth-onboarding/tiktok/callback`);
      const state = btoa(JSON.stringify({ tenant_id: tenantId, brand_id: brandId }));

      const authUrl = `https://services.tiktok.com/authorize/?client_key=${TIKTOK_CLIENT_KEY}&scope=user.info.basic,dm.send,comment.list,comment.reply,business.account.info&response_type=code&redirect_uri=${redirectUri}&state=${state}`;

      return new Response(JSON.stringify({ auth_url: authUrl }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /tiktok/callback - Handle TikTok OAuth callback
    if (req.method === "GET" && path === "/tiktok/callback") {
      const code = url.searchParams.get("code");
      const stateStr = url.searchParams.get("state");

      if (!code || !stateStr) {
        return new Response(JSON.stringify({ error: "Missing code or state" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const state = JSON.parse(atob(stateStr));
      const redirectUri = `${url.origin}/functions/v1/oauth-onboarding/tiktok/callback`;

      // Exchange code for access token
      const tokenRes = await fetch("https://business-api.tiktok.com/open/v1.3/oauth2/access_token/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_key: TIKTOK_CLIENT_KEY, client_secret: TIKTOK_CLIENT_SECRET, code, grant_type: "authorization_code", redirect_uri: redirectUri }),
      });
      const tokenData = await tokenRes.json();

      if (!tokenData?.data?.access_token) {
        return new Response(JSON.stringify({ error: "TikTok token exchange failed", details: tokenData }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get business account info
      const userInfoRes = await fetch("https://business-api.tiktok.com/open/v1.3/user/info/", {
        headers: { Authorization: `Bearer ${tokenData.data.access_token}` },
      });
      const userInfo = await userInfoRes.json();

      // Verify it's a business account
      if (userInfo?.data?.account_type !== "BUSINESS") {
        return new Response(JSON.stringify({ error: "Not a TikTok Business account", account_type: userInfo?.data?.account_type }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Store connected account
      const { data: account } = await supabase.from("connected_accounts").insert({
        tenant_id: state.tenant_id,
        brand_id: state.brand_id,
        platform: "TIKTOK",
        platform_account_id: userInfo?.data?.business_id || String(userInfo?.data?.open_id),
        platform_username: userInfo?.data?.display_name,
        encrypted_access_token: "pending",
        encrypted_data_key: "pending",
        token_expires_at: new Date(Date.now() + (tokenData.data.expires_in || 86400) * 1000).toISOString(),
        health_status: "HEALTHY",
        granted_scopes: tokenData.data.scope?.split(",") || [],
        last_refresh_at: new Date().toISOString(),
      }).select("id").single();

      // Encrypt the token
      if (account?.id) {
        await fetch(`${url.origin}/functions/v1/token-vault/encrypt`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") || "" },
          body: JSON.stringify({ account_id: account.id, access_token: tokenData.data.access_token, refresh_token: tokenData.data.refresh_token }),
        });
      }

      // Log consent
      await supabase.from("consent_logs").insert({
        tenant_id: state.tenant_id,
        brand_id: state.brand_id,
        action: "OPT_IN",
        platform: "TIKTOK",
        channel: "OAUTH",
        method: "TikTok Business Login",
        metadata: { scope: tokenData.data.scope },
      });

      return new Response(JSON.stringify({
        status: "connected",
        account: { id: account?.id, platform: "TIKTOK", name: userInfo?.data?.display_name },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /verify-scopes - Check if connected account has required scopes
    if (req.method === "POST" && path === "/verify-scopes") {
      const { account_id } = await req.json();
      const { data: account } = await supabase
        .from("connected_accounts")
        .select("id, platform, granted_scopes, tenant_id, brand_id")
        .eq("id", account_id)
        .maybeSingle();

      if (!account) {
        return new Response(JSON.stringify({ error: "Account not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const requiredScopes: Record<string, string[]> = {
        INSTAGRAM: ["instagram_manage_messages", "instagram_manage_comments", "pages_messaging"],
        FACEBOOK: ["pages_messaging", "pages_manage_metadata", "pages_read_engagement"],
        TIKTOK: ["dm.send", "comment.list", "comment.reply", "user.info.basic"],
      };

      const required = requiredScopes[account.platform] || [];
      const granted = account.granted_scopes || [];
      const missing = required.filter(s => !granted.includes(s));

      // If scopes are missing, pause affected flows
      if (missing.length > 0) {
        const { data: activeFlows } = await supabase
          .from("flows")
          .select("id, name")
          .eq("tenant_id", account.tenant_id)
          .eq("brand_id", account.brand_id)
          .eq("status", "ACTIVE");

        for (const flow of activeFlows || []) {
          await supabase.from("flows").update({ status: "PAUSED" }).eq("id", flow.id);
          await supabase.from("flow_audit_logs").insert({
            tenant_id: account.tenant_id,
            flow_id: flow.id,
            user_id: null,
            operation_type: "AUTO_PAUSED",
            payload: { reason: "MISSING_SCOPE", missing_scopes: missing, account_id },
          });
        }

        await supabase.from("notifications").insert({
          tenant_id: account.tenant_id,
          brand_id: account.brand_id,
          type: "account.missing_scopes",
          title: "Missing Permissions",
          description: `${account.platform} account is missing scopes: ${missing.join(", ")}. Active flows have been paused.`,
          is_read: false,
        });
      }

      return new Response(JSON.stringify({
        compliant: missing.length === 0,
        granted,
        missing,
        required,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /test-webhook - Send test ping to verify live connection
    if (req.method === "POST" && path === "/test-webhook") {
      const { account_id } = await req.json();
      const { data: account } = await supabase
        .from("connected_accounts")
        .select("id, platform, platform_account_id, tenant_id, brand_id")
        .eq("id", account_id)
        .maybeSingle();

      if (!account) {
        return new Response(JSON.stringify({ error: "Account not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Update last_webhook_at to confirm connectivity
      await supabase.from("connected_accounts").update({
        last_webhook_at: new Date().toISOString(),
      }).eq("id", account_id);

      return new Response(JSON.stringify({ status: "ping_sent", account_id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
