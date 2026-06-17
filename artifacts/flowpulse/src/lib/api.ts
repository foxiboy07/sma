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

// ─── UNIFIED REST API (Section 5 contract) ─────────────────

let cachedSessionToken: string | null = null;

export function setApiSessionToken(token: string | null) {
  cachedSessionToken = token;
}

async function restApi(path: string, options: RequestInit = {}): Promise<any> {
  const token = cachedSessionToken;
  const url = `${SUPABASE_URL}/functions/v1/api/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'apikey': SUPABASE_ANON_KEY,
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const errMsg = body?.error || body?.code || `API error: ${res.status}`;
    const err: any = new Error(errMsg);
    err.code = body?.code;
    err.status = res.status;
    err.retryable = body?.retryable;
    throw err;
  }
  return body?.data ?? body;
}

// ─── BRANDS API (Section 5.1) ──────────────────────────────

export const brandsApi = {
  list: () => restApi('brands'),
  get: (id: string) => restApi(`brands/${id}`),
  create: (data: { name: string; timezone?: string; logoUrl?: string }) =>
    restApi('brands', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    restApi(`brands/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// ─── CONNECTED ACCOUNTS API (Section 5.2) ─────────────────

export const connectedAccountsApi = {
  list: (brandId: string) => restApi(`brands/${brandId}/connected-accounts`),
  forceRefresh: (id: string) => restApi(`connected-accounts/${id}/force-refresh`, { method: 'POST' }),
  reAuthenticate: (id: string) => restApi(`connected-accounts/${id}/re-authenticate`, { method: 'POST' }),
  delete: (id: string) => restApi(`connected-accounts/${id}`, { method: 'DELETE' }),
};

// ─── FLOWS API (Section 5.3) ──────────────────────────────

export const flowsApi = {
  list: (brandId: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return restApi(`brands/${brandId}/flows${qs}`);
  },
  get: (id: string) => restApi(`flows/${id}`),
  create: (brandId: string, data: { name: string; triggerType?: string; templateId?: string }) =>
    restApi(`brands/${brandId}/flows`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    restApi(`flows/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  saveNodes: (id: string, nodes: any[], edges: any[]) =>
    restApi(`flows/${id}/nodes`, { method: 'PUT', body: JSON.stringify({ nodes, edges }) }),
  publish: (id: string) => restApi(`flows/${id}/publish`, { method: 'POST' }),
  pause: (id: string) => restApi(`flows/${id}/pause`, { method: 'POST' }),
  duplicate: (id: string) => restApi(`flows/${id}/duplicate`, { method: 'POST' }),
  archive: (id: string) => restApi(`flows/${id}`, { method: 'DELETE' }),
  validate: (id: string) => restApi(`flows/${id}/validate`, { method: 'POST' }),
};

// ─── INBOX API (Section 5.4) ──────────────────────────────

export const inboxApi = {
  conversations: (brandId: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return restApi(`brands/${brandId}/conversations${qs}`);
  },
  conversation: (id: string) => restApi(`conversations/${id}`),
  messages: (conversationId: string, before?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (before) params.set('before', before);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString() ? '?' + params.toString() : '';
    return restApi(`conversations/${conversationId}${qs}`);
  },
  sendMessage: (conversationId: string, content: string, messageType?: string) =>
    restApi(`conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, messageType: messageType || 'TEXT' }),
    }),
  updateConversation: (id: string, data: { status?: string; assignedAgentId?: string; priorityRed?: boolean }) =>
    restApi(`conversations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  aiSuggest: (conversationId: string, context?: string) =>
    restApi(`conversations/${conversationId}/ai-suggest`, {
      method: 'POST',
      body: JSON.stringify({ context }),
    }),
};

// ─── CONTACTS API (Section 5.5) ───────────────────────────

export const contactsApi = {
  list: (brandId: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return restApi(`brands/${brandId}/contacts${qs}`);
  },
  get: (id: string) => restApi(`contacts/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    restApi(`contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addTags: (id: string, tags: string[]) =>
    restApi(`contacts/${id}/tags`, { method: 'POST', body: JSON.stringify({ tags }) }),
  removeTags: (id: string, tags: string[]) =>
    restApi(`contacts/${id}/tags`, { method: 'DELETE', body: JSON.stringify({ tags }) }),
  merge: (contactAId: string, contactBId: string, keepId: string) =>
    restApi('contacts/merge', { method: 'POST', body: JSON.stringify({ contactAId, contactBId, keepId }) }),
  identityMatches: (brandId: string) => restApi(`brands/${brandId}/identity-matches`),
  dismissMatch: (id: string) => restApi(`identity-matches/${id}/dismiss`, { method: 'POST' }),
  mergeMatch: (id: string, keepId: string) =>
    restApi(`identity-matches/${id}/merge`, { method: 'POST', body: JSON.stringify({ keepId }) }),
  gdprExport: (id: string) => restApi(`contacts/${id}/export`),
  gdprDelete: (id: string) =>
    restApi(`contacts/${id}/data`, { method: 'DELETE', body: JSON.stringify({ confirmation: 'DELETE' }) }),
};

// ─── BROADCASTS API (Section 5.6) ─────────────────────────

export const broadcastsApi = {
  list: (brandId: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return restApi(`brands/${brandId}/broadcasts${qs}`);
  },
  create: (brandId: string, data: Record<string, unknown>) =>
    restApi(`brands/${brandId}/broadcasts`, { method: 'POST', body: JSON.stringify(data) }),
  estimateReach: (id: string, audienceFilters: any[]) =>
    restApi(`broadcasts/${id}/estimate-reach`, { method: 'POST', body: JSON.stringify({ audienceFilters }) }),
  delete: (id: string) => restApi(`broadcasts/${id}`, { method: 'DELETE' }),
};

// ─── ANALYTICS API (Section 5.7) ──────────────────────────

export const analyticsApi = {
  overview: (brandId: string, period?: string, platform?: string) => {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    if (platform) params.set('platform', platform);
    return restApi(`brands/${brandId}/analytics/overview?${params.toString()}`);
  },
  flows: (brandId: string, period?: string) => {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    return restApi(`brands/${brandId}/analytics/flows?${params.toString()}`);
  },
  ai: (brandId: string, period?: string) => {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    return restApi(`brands/${brandId}/analytics/ai?${params.toString()}`);
  },
  attribution: (brandId: string, period?: string) => {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    return restApi(`brands/${brandId}/analytics/attribution?${params.toString()}`);
  },
  ghostAb: (brandId: string, period?: string) => {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    return restApi(`brands/${brandId}/analytics/ghost-ab?${params.toString()}`);
  },
};

// ─── DASHBOARD API (Section 5.8) ──────────────────────────

export const dashboardApi = {
  get: (brandId: string) => restApi(`brands/${brandId}/dashboard`),
};

// ─── KNOWLEDGE BASE API (Section 5.9) ─────────────────────

export const knowledgeBaseApi = {
  list: (brandId: string) => restApi(`brands/${brandId}/knowledge-base`),
  get: (id: string) => restApi(`knowledge-base/${id}`),
  delete: (id: string) => restApi(`knowledge-base/${id}`, { method: 'DELETE' }),
};

// ─── SHORT LINKS API (Section 5.10) ───────────────────────

export const shortLinksApi = {
  list: (brandId: string) => restApi(`brands/${brandId}/short-links`),
  create: (brandId: string, data: { destinationUrl: string; contactId?: string; flowId?: string; customSlug?: string }) =>
    restApi(`brands/${brandId}/short-links`, { method: 'POST', body: JSON.stringify(data) }),
};

// ─── DLQ API (Section 5.11) ───────────────────────────────

export const dlqApi = {
  list: (brandId: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return restApi(`brands/${brandId}/dlq${qs}`);
  },
  replay: (id: string) => restApi(`dlq/${id}/replay`, { method: 'POST' }),
  dismiss: (id: string) => restApi(`dlq/${id}/dismiss`, { method: 'POST' }),
  batchReplay: (brandId: string, messageIds?: string[]) =>
    restApi(`brands/${brandId}/dlq/batch-replay`, { method: 'POST', body: JSON.stringify({ messageIds }) }),
};

// ─── TOKEN HEALTH API (Section 5.12) ──────────────────────

export const healthApi = {
  get: (brandId: string) => restApi(`brands/${brandId}/health`),
};

// ─── SETTINGS API (Section 5.13) ──────────────────────────

export const settingsApi = {
  team: {
    list: (tenantId: string) => restApi(`tenants/${tenantId}/users`),
    invite: (tenantId: string, email: string, role: string) =>
      restApi(`tenants/${tenantId}/invites`, { method: 'POST', body: JSON.stringify({ email, role }) }),
    remove: (tenantId: string, userId: string) =>
      restApi(`tenants/${tenantId}/users/${userId}`, { method: 'DELETE' }),
  },
  billing: {
    get: (tenantId: string) => restApi(`tenants/${tenantId}/billing`),
  },
  apiKeys: {
    list: (tenantId: string) => restApi(`tenants/${tenantId}/api-keys`),
    create: (tenantId: string, name: string, scopes?: string[]) =>
      restApi(`tenants/${tenantId}/api-keys`, { method: 'POST', body: JSON.stringify({ name, scopes }) }),
    revoke: (tenantId: string, keyId: string) =>
      restApi(`tenants/${tenantId}/api-keys/${keyId}`, { method: 'DELETE' }),
  },
};

// ─── LEGACY EDGE FUNCTION APIs (internal services) ─────────

export const webhookApi = {
  metaVerify: (mode: string, token: string, challenge: string) =>
    apiCall('webhook-ingressor', `/meta?hub.mode=${mode}&hub.verify_token=${token}&hub.challenge=${challenge}`),
};

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
