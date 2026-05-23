const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getAuthHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'apikey': SUPABASE_ANON_KEY,
  };
}

async function apiCall(service: string, path: string, options: RequestInit = {}): Promise<any> {
  const url = `${SUPABASE_URL}/functions/v1/${service}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

// ---- Webhook Ingressor ----
export const webhookApi = {
  metaVerify: (mode: string, token: string, challenge: string) =>
    apiCall('webhook-ingressor', `/meta?hub.mode=${mode}&hub.verify_token=${token}&hub.challenge=${challenge}`),
};

// ---- Token Vault ----
export const tokenVaultApi = {
  encrypt: (accountId: string, accessToken: string, refreshToken?: string) =>
    apiCall('token-vault', '/encrypt', { method: 'POST', body: JSON.stringify({ account_id: accountId, access_token: accessToken, refresh_token: refreshToken }) }),
  decrypt: (accountId: string, callingService: string) =>
    apiCall('token-vault', '/decrypt', { method: 'POST', body: JSON.stringify({ account_id: accountId, calling_service: callingService }) }),
  refresh: () =>
    apiCall('token-vault', '/refresh', { method: 'POST' }),
  health: (accountId: string) =>
    apiCall('token-vault', `/health?account_id=${accountId}`),
  forceRefresh: (accountId: string) =>
    apiCall('token-vault', '/force-refresh', { method: 'POST', body: JSON.stringify({ account_id: accountId }) }),
};

// ---- OAuth Onboarding ----
export const oauthApi = {
  metaAuthorizeUrl: (tenantId: string, brandId: string) =>
    apiCall('oauth-onboarding', `/meta/authorize?tenant_id=${tenantId}&brand_id=${brandId}`),
  tiktokAuthorizeUrl: (tenantId: string, brandId: string) =>
    apiCall('oauth-onboarding', `/tiktok/authorize?tenant_id=${tenantId}&brand_id=${brandId}`),
  verifyScopes: (accountId: string) =>
    apiCall('oauth-onboarding', '/verify-scopes', { method: 'POST', body: JSON.stringify({ account_id: accountId }) }),
  testWebhook: (accountId: string) =>
    apiCall('oauth-onboarding', '/test-webhook', { method: 'POST', body: JSON.stringify({ account_id: accountId }) }),
};

// ---- Flow Engine ----
export const flowEngineApi = {
  execute: (sessionId: string) =>
    apiCall('flow-engine', '/execute', { method: 'POST', body: JSON.stringify({ session_id: sessionId }) }),
  advance: (sessionId: string, edgeCondition?: string) =>
    apiCall('flow-engine', '/advance', { method: 'POST', body: JSON.stringify({ session_id: sessionId, edge_condition: edgeCondition }) }),
  validate: (flowId: string) =>
    apiCall('flow-engine', '/validate', { method: 'POST', body: JSON.stringify({ flow_id: flowId }) }),
  sessions: (contactId: string) =>
    apiCall('flow-engine', `/sessions?contact_id=${contactId}`),
  checkWindow: (contactId: string, platform: string, brandId: string, hasMessageTag?: boolean) =>
    apiCall('flow-engine', '/check-window', { method: 'POST', body: JSON.stringify({ contact_id: contactId, platform, brand_id: brandId, has_message_tag: hasMessageTag }) }),
};

// ---- AI Layer ----
export const aiApi = {
  classify: (messageText: string, conversationId: string, contactId: string, tenantId: string, brandId: string) =>
    apiCall('ai-layer', '/classify', { method: 'POST', body: JSON.stringify({ message_text: messageText, conversation_id: conversationId, contact_id: contactId, tenant_id: tenantId, brand_id: brandId }) }),
  generate: (messageText: string, conversationId: string, contactId: string, tenantId: string, brandId: string, flowId?: string, tier?: string) =>
    apiCall('ai-layer', '/generate', { method: 'POST', body: JSON.stringify({ message_text: messageText, conversation_id: conversationId, contact_id: contactId, tenant_id: tenantId, brand_id: brandId, flow_id: flowId, tier }) }),
  functionCall: (functionName: string, input: any, tenantId: string, brandId: string, contactId?: string, conversationId?: string) =>
    apiCall('ai-layer', '/function-call', { method: 'POST', body: JSON.stringify({ function_name: functionName, input, tenant_id: tenantId, brand_id: brandId, contact_id: contactId, conversation_id: conversationId }) }),
  budget: (tenantId: string, brandId: string) =>
    apiCall('ai-layer', `/budget?tenant_id=${tenantId}&brand_id=${brandId}`),
};

// ---- Circuit Breaker ----
export const circuitBreakerApi = {
  check: (accountId: string) =>
    apiCall('circuit-breaker', '/check', { method: 'POST', body: JSON.stringify({ account_id: accountId }) }),
  reportSuccess: (accountId: string) =>
    apiCall('circuit-breaker', '/report-success', { method: 'POST', body: JSON.stringify({ account_id: accountId }) }),
  reportFailure: (accountId: string, errorCode: string, errorDetail?: string) =>
    apiCall('circuit-breaker', '/report-failure', { method: 'POST', body: JSON.stringify({ account_id: accountId, error_code: errorCode, error_detail: errorDetail }) }),
  status: (tenantId: string) =>
    apiCall('circuit-breaker', `/status?tenant_id=${tenantId}`),
};

// ---- Attribution ----
export const attributionApi = {
  createShortLink: (tenantId: string, brandId: string, destinationUrl: string, contactId?: string, flowId?: string, customDomain?: string) =>
    apiCall('attribution', '/short-link', { method: 'POST', body: JSON.stringify({ tenant_id: tenantId, brand_id: brandId, destination_url: destinationUrl, contact_id: contactId, flow_id: flowId, custom_domain: customDomain }) }),
  fireCapi: (tenantId: string, brandId: string, contactId: string, eventName: string, value?: number, currency?: string, email?: string, phone?: string, identityToken?: string) =>
    apiCall('attribution', '/capi', { method: 'POST', body: JSON.stringify({ tenant_id: tenantId, brand_id: brandId, contact_id: contactId, event_name: eventName, value, currency, email, phone, identity_token: identityToken }) }),
  analytics: (tenantId: string, brandId?: string, days?: number) =>
    apiCall('attribution', `/analytics?tenant_id=${tenantId}${brandId ? `&brand_id=${brandId}` : ''}${days ? `&days=${days}` : ''}`),
  bioClick: (tenantId: string, brandId: string, contactId?: string) =>
    apiCall('attribution', '/bio-click', { method: 'POST', body: JSON.stringify({ tenant_id: tenantId, brand_id: brandId, contact_id: contactId }) }),
};

// ---- DLQ Replay ----
export const dlqApi = {
  messages: (tenantId: string, status?: string, platform?: string, limit?: number) =>
    apiCall('dlq-replay', `/messages?tenant_id=${tenantId}${status ? `&status=${status}` : ''}${platform ? `&platform=${platform}` : ''}${limit ? `&limit=${limit}` : ''}`),
  replay: (messageId: string) =>
    apiCall('dlq-replay', `/replay/${messageId}`, { method: 'POST' }),
  batchReplay: (tenantId: string, fromDate?: string, toDate?: string, errorCode?: string) =>
    apiCall('dlq-replay', '/batch-replay', { method: 'POST', body: JSON.stringify({ tenant_id: tenantId, from_date: fromDate, to_date: toDate, error_code: errorCode }) }),
  dismiss: (messageId: string) =>
    apiCall('dlq-replay', `/dismiss/${messageId}`, { method: 'POST' }),
  stats: (tenantId: string) =>
    apiCall('dlq-replay', `/stats?tenant_id=${tenantId}`),
};

// ---- GDPR Compliance ----
export const gdprApi = {
  exportContact: (contactId: string, tenantId: string, brandId: string) =>
    apiCall('gdpr-compliance', '/export', { method: 'POST', body: JSON.stringify({ contact_id: contactId, tenant_id: tenantId, brand_id: brandId }) }),
  eraseContact: (contactId: string, tenantId: string, brandId: string) =>
    apiCall('gdpr-compliance', '/erase', { method: 'POST', body: JSON.stringify({ contact_id: contactId, tenant_id: tenantId, brand_id: brandId }) }),
  logConsent: (tenantId: string, brandId: string, action: string, platform?: string, channel?: string, contactId?: string, contactName?: string, method?: string) =>
    apiCall('gdpr-compliance', '/consent', { method: 'POST', body: JSON.stringify({ tenant_id: tenantId, brand_id: brandId, contact_id: contactId, contact_name: contactName, action, platform, channel, method }) }),
  consentLogs: (tenantId: string, contactId?: string) =>
    apiCall('gdpr-compliance', `/consent-logs?tenant_id=${tenantId}${contactId ? `&contact_id=${contactId}` : ''}`),
  complianceStatus: (tenantId: string) =>
    apiCall('gdpr-compliance', `/compliance-status?tenant_id=${tenantId}`),
};

// ---- Knowledge Base ----
export const kbApi = {
  upload: (tenantId: string, brandId: string, name: string, sourceType: string, content: string, sourceUrl?: string, strictness?: string) =>
    apiCall('knowledge-base', '/upload', { method: 'POST', body: JSON.stringify({ tenant_id: tenantId, brand_id: brandId, name, source_type: sourceType, content, source_url: sourceUrl, strictness }) }),
  search: (brandId: string, query: string, matchThreshold?: number, matchCount?: number, strictness?: string) =>
    apiCall('knowledge-base', '/search', { method: 'POST', body: JSON.stringify({ brand_id: brandId, query, match_threshold: matchThreshold, match_count: matchCount, strictness }) }),
  test: (brandId: string, question: string) =>
    apiCall('knowledge-base', '/test', { method: 'POST', body: JSON.stringify({ brand_id: brandId, question }) }),
  documents: (tenantId: string, brandId?: string) =>
    apiCall('knowledge-base', `/documents?tenant_id=${tenantId}${brandId ? `&brand_id=${brandId}` : ''}`),
  deleteDocument: (docId: string) =>
    apiCall('knowledge-base', `/documents/${docId}`, { method: 'DELETE' }),
};

// ---- Loyalty Scoring ----
export const loyaltyApi = {
  compute: (contactId: string, tenantId: string, brandId: string) =>
    apiCall('loyalty-scoring', '/compute', { method: 'POST', body: JSON.stringify({ contact_id: contactId, tenant_id: tenantId, brand_id: brandId }) }),
  batchCompute: (tenantId: string, brandId: string) =>
    apiCall('loyalty-scoring', '/batch-compute', { method: 'POST', body: JSON.stringify({ tenant_id: tenantId, brand_id: brandId }) }),
  identityMatch: (tenantId: string, brandId: string, contactId: string) =>
    apiCall('loyalty-scoring', '/identity-match', { method: 'POST', body: JSON.stringify({ tenant_id: tenantId, brand_id: brandId, contact_id: contactId }) }),
  merge: (primaryId: string, secondaryId: string, tenantId: string, brandId: string) =>
    apiCall('loyalty-scoring', '/merge', { method: 'POST', body: JSON.stringify({ primary_id: primaryId, secondary_id: secondaryId, tenant_id: tenantId, brand_id: brandId }) }),
  warmHello: (contactId: string, tenantId: string, brandId: string) =>
    apiCall('loyalty-scoring', '/warm-hello', { method: 'POST', body: JSON.stringify({ contact_id: contactId, tenant_id: tenantId, brand_id: brandId }) }),
};

// ---- Broadcast Engine ----
export const broadcastApi = {
  create: (tenantId: string, brandId: string, name: string, platform?: string, messageContent?: string, messageTag?: string, segmentFilters?: any, scheduledAt?: string) =>
    apiCall('broadcast-engine', '/create', { method: 'POST', body: JSON.stringify({ tenant_id: tenantId, brand_id: brandId, name, platform, message_content: messageContent, message_tag: messageTag, segment_filters: segmentFilters, scheduled_at: scheduledAt }) }),
  send: (broadcastId: string) =>
    apiCall('broadcast-engine', `/send/${broadcastId}`, { method: 'POST' }),
  list: (tenantId: string, brandId?: string) =>
    apiCall('broadcast-engine', `/list?tenant_id=${tenantId}${brandId ? `&brand_id=${brandId}` : ''}`),
  cancel: (broadcastId: string) =>
    apiCall('broadcast-engine', `/cancel/${broadcastId}`, { method: 'POST' }),
};

// ---- API Gateway ----
export const apiGateway = {
  createKey: (tenantId: string, name: string, permissions?: string[]) =>
    apiCall('api-gateway', '/keys', { method: 'POST', body: JSON.stringify({ tenant_id: tenantId, name, permissions }) }),
  listKeys: (tenantId: string) =>
    apiCall('api-gateway', `/keys?tenant_id=${tenantId}`),
  revokeKey: (keyId: string) =>
    apiCall('api-gateway', `/keys/${keyId}`, { method: 'DELETE' }),
  getContacts: (apiKey: string, page?: number, limit?: number) =>
    fetch(`${SUPABASE_URL}/functions/v1/api-gateway/contacts?page=${page || 1}&limit=${limit || 50}`, { headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' } }).then(r => r.json()),
  getFlows: (apiKey: string) =>
    fetch(`${SUPABASE_URL}/functions/v1/api-gateway/flows`, { headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' } }).then(r => r.json()),
  triggerFlow: (apiKey: string, flowId: string, contactId: string) =>
    fetch(`${SUPABASE_URL}/functions/v1/api-gateway/flows/${flowId}/trigger`, { method: 'POST', headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: contactId }) }).then(r => r.json()),
  getAnalytics: (apiKey: string, days?: number) =>
    fetch(`${SUPABASE_URL}/functions/v1/api-gateway/analytics/overview?days=${days || 30}`, { headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' } }).then(r => r.json()),
  getRateLimits: (apiKey: string) =>
    fetch(`${SUPABASE_URL}/functions/v1/api-gateway/rate-limits`, { headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' } }).then(r => r.json()),
};

// ---- Real-time Events ----
export const realtimeApi = {
  emit: (tenantId: string, brandId: string, eventType: string, title: string, description?: string, userId?: string, actionUrl?: string, metadata?: any) =>
    apiCall('realtime-events', '/emit', { method: 'POST', body: JSON.stringify({ tenant_id: tenantId, brand_id: brandId, user_id: userId, event_type: eventType, title, description, action_url: actionUrl, metadata }) }),
  notifications: (tenantId: string, userId?: string, unreadOnly?: boolean) =>
    apiCall('realtime-events', `/notifications?tenant_id=${tenantId}${userId ? `&user_id=${userId}` : ''}${unreadOnly ? `&unread_only=true` : ''}`),
  markRead: (notifId: string) =>
    apiCall('realtime-events', `/notifications/${notifId}/read`, { method: 'POST' }),
  markAllRead: (tenantId: string, userId?: string) =>
    apiCall('realtime-events', '/notifications/mark-all-read', { method: 'POST', body: JSON.stringify({ tenant_id: tenantId, user_id: userId }) }),
  unreadCount: (tenantId: string, userId?: string) =>
    apiCall('realtime-events', `/unread-count?tenant_id=${tenantId}${userId ? `&user_id=${userId}` : ''}`),
  eventTypes: () =>
    apiCall('realtime-events', '/event-types'),
};
