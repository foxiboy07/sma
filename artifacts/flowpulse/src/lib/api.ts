const BASE_URL = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
const TOKEN_KEY = 'fp_token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setApiSessionToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function restApi(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const url = `${BASE_URL}/api/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const errMsg = body?.error ?? body?.code ?? `API error: ${res.status}`;
    const err: any = new Error(errMsg);
    err.code = body?.code;
    err.status = res.status;
    err.retryable = body?.retryable;
    throw err;
  }
  return body?.data ?? body;
}

// Stub for legacy edge-function calls — route to our Express backend where possible
async function apiCall(_service: string, path: string, options: RequestInit = {}): Promise<any> {
  return restApi(path.startsWith('/') ? path.slice(1) : path, options);
}

// ─── BRANDS API ────────────────────────────────────────────

export const brandsApi = {
  list: () => restApi('brands'),
  get: (id: string) => restApi(`brands/${id}`),
  create: (data: { name: string; timezone?: string; logoUrl?: string }) =>
    restApi('brands', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    restApi(`brands/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// ─── CONNECTED ACCOUNTS API ────────────────────────────────

export const connectedAccountsApi = {
  list: (brandId: string) => restApi(`brands/${brandId}/connected-accounts`),
  forceRefresh: (id: string) => restApi(`connected-accounts/${id}/force-refresh`, { method: 'POST' }),
  reAuthenticate: (id: string) => restApi(`connected-accounts/${id}/re-authenticate`, { method: 'POST' }),
  delete: (id: string) => restApi(`connected-accounts/${id}`, { method: 'DELETE' }),
};

// ─── FLOWS API ─────────────────────────────────────────────

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

// ─── INBOX API ─────────────────────────────────────────────

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
      body: JSON.stringify({ content, messageType: messageType ?? 'TEXT' }),
    }),
  updateConversation: (id: string, data: { status?: string; assignedAgentId?: string; priorityRed?: boolean }) =>
    restApi(`conversations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  aiSuggest: (conversationId: string, context?: string) =>
    restApi(`conversations/${conversationId}/ai-suggest`, {
      method: 'POST',
      body: JSON.stringify({ context }),
    }),
};

// ─── CONTACTS API ──────────────────────────────────────────

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

// ─── BROADCASTS API ────────────────────────────────────────

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

// ─── ANALYTICS API ─────────────────────────────────────────

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

// ─── DASHBOARD API ─────────────────────────────────────────

export const dashboardApi = {
  get: (brandId: string) => restApi(`brands/${brandId}/dashboard`),
};

// ─── KNOWLEDGE BASE API ────────────────────────────────────

export const knowledgeBaseApi = {
  list: (brandId: string) => restApi(`brands/${brandId}/knowledge-base`),
  get: (id: string) => restApi(`knowledge-base/${id}`),
  delete: (id: string) => restApi(`knowledge-base/${id}`, { method: 'DELETE' }),
};

// ─── SHORT LINKS API ───────────────────────────────────────

export const shortLinksApi = {
  list: (brandId: string) => restApi(`brands/${brandId}/short-links`),
  create: (brandId: string, data: { destinationUrl: string; contactId?: string; flowId?: string; customSlug?: string }) =>
    restApi(`brands/${brandId}/short-links`, { method: 'POST', body: JSON.stringify(data) }),
};

// ─── DLQ API ───────────────────────────────────────────────

export const dlqApi = {
  list: (brandId: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return restApi(`brands/${brandId}/dlq${qs}`);
  },
  messages: (brandId: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return restApi(`brands/${brandId}/dlq${qs}`);
  },
  replay: (id: string) => restApi(`dlq/${id}/replay`, { method: 'POST' }),
  dismiss: (id: string) => restApi(`dlq/${id}/dismiss`, { method: 'POST' }),
  batchReplay: (brandId: string, messageIds?: string[]) =>
    restApi(`brands/${brandId}/dlq/batch-replay`, { method: 'POST', body: JSON.stringify({ messageIds }) }),
};

// ─── TOKEN HEALTH API ──────────────────────────────────────

export const healthApi = {
  get: (brandId: string) => restApi(`brands/${brandId}/health`),
};

// ─── SETTINGS API ──────────────────────────────────────────

export const settingsApi = {
  team: {
    list: (tenantId: string) => restApi(`tenants/${tenantId}/users`),
    invite: (tenantId: string, email: string, role: string) =>
      restApi(`tenants/${tenantId}/invites`, { method: 'POST', body: JSON.stringify({ email, role }) }),
    remove: (tenantId: string, userId: string) =>
      restApi(`tenants/${tenantId}/users/${userId}`, { method: 'DELETE' }),
    updateMeta: (userId: string, data: { avatar_url?: string | null; skills?: string[] }) =>
      restApi(`users/${userId}/meta`, { method: 'PATCH', body: JSON.stringify(data) }),
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

// ─── LEGACY STUBS (redirect to Express backend) ────────────

export const webhookApi = {
  metaVerify: (mode: string, token: string, challenge: string) =>
    apiCall('webhook', `/webhook/meta?hub.mode=${mode}&hub.verify_token=${token}&hub.challenge=${challenge}`),
};

export const tokenVaultApi = {
  encrypt: (_a: string, _b: string) => Promise.resolve(null),
  decrypt: (_a: string, _b: string) => Promise.resolve(null),
  refresh: () => Promise.resolve(null),
  health: (_a: string) => Promise.resolve({ status: 'UNKNOWN' }),
  forceRefresh: (accountId: string) => restApi(`connected-accounts/${accountId}/force-refresh`, { method: 'POST' }),
};

export const oauthApi = {
  metaAuthorizeUrl: (_t: string, brandId: string) => Promise.resolve({ url: null }),
  tiktokAuthorizeUrl: (_t: string, brandId: string) => Promise.resolve({ url: null }),
  verifyScopes: (accountId: string) => restApi(`connected-accounts/${accountId}/re-authenticate`, { method: 'POST' }),
  testWebhook: (accountId: string) => restApi(`connected-accounts/${accountId}/force-refresh`, { method: 'POST' }),
};

export const flowEngineApi = {
  execute: (_s: string) => Promise.resolve(null),
  advance: (_s: string) => Promise.resolve(null),
  validate: (flowId: string) => restApi(`flows/${flowId}/validate`, { method: 'POST' }),
  sessions: (_c: string) => Promise.resolve([]),
  checkWindow: () => Promise.resolve({ allowed: true }),
};

export const aiApi = {
  classify: (_msg?: string, _conv?: string, _contact?: string, _tenant?: string, _brand?: string) =>
    Promise.resolve({ intent: 'UNKNOWN' }),
  generate: (_msg?: string, _conv?: string, _contact?: string, _tenant?: string, _brand?: string, _flow?: string, _tier?: string) =>
    Promise.resolve({ response: '', response_text: '', text: '', message: '' }),
  functionCall: (_fn?: string, _input?: any, _tenant?: string, _brand?: string, _contact?: string, _conv?: string) =>
    Promise.resolve(null),
  budget: (_tenant?: string, _brand?: string) => Promise.resolve({ used: 0, limit: 0 }),
};

export const circuitBreakerApi = {
  check: () => Promise.resolve({ state: 'CLOSED' }),
  reportSuccess: () => Promise.resolve(null),
  reportFailure: () => Promise.resolve(null),
  status: () => Promise.resolve([]),
};

export const attributionApi = {
  createShortLink: (tenantId: string, brandId: string, destinationUrl: string, contactId?: string, flowId?: string) =>
    restApi(`brands/${brandId}/short-links`, { method: 'POST', body: JSON.stringify({ destinationUrl, contactId, flowId }) }),
  fireCapi: () => Promise.resolve(null),
  analytics: (_tenantId?: string, _brandId?: string, _days?: number) =>
    Promise.resolve({ overview: {}, timeseries: [], funnel: [] } as any),
  bioClick: () => Promise.resolve(null),
};

export const gdprApi = {
  exportContact: (contactId: string, _tenantId?: string, _brandId?: string) =>
    restApi(`contacts/${contactId}/export`),
  eraseContact: (contactId: string, _tenantId?: string, _brandId?: string) =>
    restApi(`contacts/${contactId}/data`, { method: 'DELETE', body: JSON.stringify({ confirmation: 'DELETE' }) }),
  logConsent: (..._args: any[]) => Promise.resolve(null),
  consentLogs: (..._args: any[]) => Promise.resolve([]),
  complianceStatus: (..._args: any[]) => Promise.resolve({}),
};

export const kbApi = {
  upload: (tenantId: string, brandId: string, name: string, sourceType: string, content: string, sourceUrl?: string, strictness?: string) =>
    restApi(`brands/${brandId}/knowledge-base`, { method: 'POST', body: JSON.stringify({ name, sourceType, content, sourceUrl, strictness }) }),
  search: (..._args: any[]) => Promise.resolve([]),
  test: (_brandId?: string, _question?: string) => Promise.resolve({ answer: '', response: '', chunks: [] as any[], sources: [] as any[], tier: 'TIER_1', recommended_tier: 'TIER_1', cost: '$0.0003', action: 'answer' }),
  documents: (tenantId: string, brandId?: string) =>
    brandId ? restApi(`brands/${brandId}/knowledge-base`) : Promise.resolve([]),
  deleteDocument: (docId: string) => restApi(`knowledge-base/${docId}`, { method: 'DELETE' }),
};

export const loyaltyApi = {
  compute: (..._args: any[]) => Promise.resolve(null),
  batchCompute: (..._args: any[]) => Promise.resolve(null),
  identityMatch: (_tenantId?: string, _brandId?: string, _contactId?: string) => Promise.resolve(null),
  merge: (..._args: any[]) => Promise.resolve(null),
  warmHello: (..._args: any[]) => Promise.resolve(null),
};

export const broadcastApi = {
  create: (tenantId: string, brandId: string, name: string, platform?: string, messageContent?: string, messageTag?: string, segmentFilters?: any, scheduledAt?: string) =>
    restApi(`brands/${brandId}/broadcasts`, { method: 'POST', body: JSON.stringify({ name, platform, messageContent, messageTag, segmentFilters, scheduledAt }) }),
  send: (_b: string) => Promise.resolve(null),
  list: (_t: string, brandId?: string) =>
    brandId ? restApi(`brands/${brandId}/broadcasts`) : Promise.resolve([]),
  cancel: (_b: string) => Promise.resolve(null),
};

export const apiGateway = {
  createKey: (tenantId: string, name: string, permissions?: string[]) =>
    restApi(`tenants/${tenantId}/api-keys`, { method: 'POST', body: JSON.stringify({ name, scopes: permissions }) }),
  listKeys: (tenantId: string) => restApi(`tenants/${tenantId}/api-keys`),
  revokeKey: (keyId: string) => Promise.resolve(null),
  getContacts: () => Promise.resolve([]),
  getFlows: () => Promise.resolve([]),
  triggerFlow: () => Promise.resolve(null),
  getAnalytics: () => Promise.resolve({}),
  getRateLimits: () => Promise.resolve({}),
};

export const realtimeApi = {
  emit: () => Promise.resolve(null),
  notifications: () => Promise.resolve([]),
  markRead: () => Promise.resolve(null),
  markAllRead: () => Promise.resolve(null),
  unreadCount: () => Promise.resolve({ count: 0 }),
  eventTypes: () => Promise.resolve([]),
};
