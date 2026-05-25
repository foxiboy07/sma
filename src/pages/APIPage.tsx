import React, { useState, useEffect } from 'react';
import {
  Code2, Plus, Copy, Trash2, Eye, EyeOff, RefreshCw, Webhook,
  CheckCircle2, AlertCircle, Clock, Globe, Zap, Shield,
  ChevronDown, ChevronUp, Check, Play
} from 'lucide-react';
import { Button, Card, Badge, Input, Modal, Select, Toggle } from '../components/ui';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { apiGateway, oauthApi } from '../lib/api';

const ALL_EVENTS = [
  { group: 'Contacts', events: ['contact.created', 'contact.updated', 'contact.tier_upgraded', 'contact.opted_out'] },
  { group: 'Conversations', events: ['conversation.started', 'conversation.message_received', 'conversation.human_handoff', 'conversation.resolved'] },
  { group: 'Flows', events: ['flow.started', 'flow.completed', 'flow.node_executed', 'flow.error'] },
  { group: 'Attribution', events: ['attribution.click', 'attribution.purchase', 'attribution.conversion'] },
  { group: 'AI', events: ['ai.response_generated', 'ai.budget_threshold', 'ai.escalation'] },
];

const PERMISSION_SCOPES = [
  { id: 'flows:read', label: 'Flows: Read', desc: 'List and read flow configurations' },
  { id: 'flows:write', label: 'Flows: Write', desc: 'Create, update, and delete flows' },
  { id: 'contacts:read', label: 'Contacts: Read', desc: 'List and search contacts' },
  { id: 'contacts:write', label: 'Contacts: Write', desc: 'Create and update contacts, add tags' },
  { id: 'broadcasts:write', label: 'Broadcasts: Write', desc: 'Create and send broadcasts' },
  { id: 'analytics:read', label: 'Analytics: Read', desc: 'Access flow and AI analytics' },
  { id: 'inbox:read', label: 'Inbox: Read', desc: 'Read conversation messages' },
  { id: 'admin', label: 'Admin', desc: 'Full account access (use with caution)', danger: true },
];

export function APIPage() {
  const { tenant } = useAuth();
  const [keys, setKeys] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;
    setKeysLoading(true);
    apiGateway.listKeys(tenant.id)
      .then((data: any[]) => {
        if (cancelled) return;
        const mapped = (data || []).map((k: any) => ({
          id: k.id,
          name: k.name,
          key: k.key || k.api_key || '',
          lastUsed: k.last_used || k.lastUsed || new Date().toISOString(),
          created: k.created_at || k.created || new Date().toISOString(),
          permissions: k.permissions || [],
          requests: k.request_count || k.requests || 0,
          status: k.revoked_at ? 'revoked' : (k.status || 'active'),
        }));
        setKeys(mapped);
      })
      .catch(() => {
        if (!cancelled) setKeys([]);
      })
      .finally(() => {
        if (!cancelled) setKeysLoading(false);
      });
    return () => { cancelled = true; };
  }, [tenant?.id]);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedWh, setExpandedWh] = useState<string | null>(null);
  const [newKeyModal, setNewKeyModal] = useState(false);
  const [newWebhookModal, setNewWebhookModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>(['flows:read', 'contacts:read']);
  const [whName, setWhName] = useState('');
  const [whUrl, setWhUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [testingWh, setTestingWh] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'keys' | 'webhooks' | 'docs'>('keys');

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function maskKey(key: string) {
    return key.substring(0, 10) + '••••••••••••••••••••••••' + key.slice(-4);
  }

  function togglePerm(id: string) {
    setSelectedPerms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  function toggleEvent(ev: string) {
    setSelectedEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  }

  async function createKey() {
    if (!tenant?.id) return;
    try {
      const data = await apiGateway.createKey(tenant.id, newKeyName || 'New Key', selectedPerms);
      const newKey = {
        id: data.id,
        name: data.name || newKeyName || 'New Key',
        key: data.key || data.api_key || '',
        lastUsed: data.last_used || data.lastUsed || new Date().toISOString(),
        created: data.created_at || data.created || new Date().toISOString(),
        permissions: data.permissions || selectedPerms,
        requests: data.request_count || data.requests || 0,
        status: data.revoked_at ? 'revoked' : (data.status || 'active'),
      };
      setKeys(prev => [...prev, newKey]);
      setNewKeyName('');
      setSelectedPerms(['flows:read', 'contacts:read']);
      setNewKeyModal(false);
    } catch (err) {
      console.error('Failed to create API key:', err);
    }
  }

  function createWebhook() {
    const newWh = {
      id: String(Date.now()),
      name: whName || 'New Webhook',
      url: whUrl,
      events: selectedEvents,
      status: 'active',
      lastDelivery: new Date().toISOString(),
      successRate: 100,
      secretKey: 'whsec_' + Math.random().toString(36).slice(2, 30),
    };
    setWebhooks(prev => [...prev, newWh]);
    setWhName('');
    setWhUrl('');
    setSelectedEvents([]);
    setNewWebhookModal(false);
  }

  async function testWebhook(id: string) {
    setTestingWh(id);
    try {
      await oauthApi.testWebhook(id);
    } catch (err) {
      console.error('Webhook test failed:', err);
    }
    setTestingWh(null);
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#F0F2FF] mb-0.5">API & Webhooks</h2>
        <p className="text-xs text-[#8B90A7]">Manage API keys, configure outbound webhooks, and explore the REST API</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#111318] rounded-xl border border-[#1E2130] w-fit overflow-x-auto">
        {[
          { id: 'keys', label: 'API Keys', icon: <Code2 className="w-3.5 h-3.5" /> },
          { id: 'webhooks', label: 'Webhooks', icon: <Webhook className="w-3.5 h-3.5" /> },
          { id: 'docs', label: 'API Reference', icon: <Globe className="w-3.5 h-3.5" /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[#1A1C24] text-[#F0F2FF] shadow-sm' : 'text-[#8B90A7] hover:text-[#F0F2FF]'}`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'keys' && (
        <>
          {/* API Keys */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[#F0F2FF]">API Keys</h3>
                <p className="text-xs text-[#8B90A7] mt-0.5">Keys grant programmatic access to the FlowPulse REST API</p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setNewKeyModal(true)}>
                <Plus className="w-3.5 h-3.5" /> New Key
              </Button>
            </div>
            <div className="space-y-3">
              {keys.map(k => (
                <div key={k.id} className="p-4 rounded-xl bg-[#0A0B0F] border border-[#1E2130]">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#F0F2FF]">{k.name}</p>
                        <Badge variant={k.status === 'active' ? 'success' : 'default'}>{k.status}</Badge>
                      </div>
                      <p className="text-[10px] text-[#4B5068] mt-0.5">Created {format(new Date(k.created), 'MMM d, yyyy')} · Last used {format(new Date(k.lastUsed), 'MMM d, HH:mm')} · {k.requests.toLocaleString()} requests</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await apiGateway.revokeKey(k.id);
                          setKeys(prev => prev.filter(key => key.id !== k.id));
                        } catch (err) {
                          console.error('Failed to revoke key:', err);
                        }
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded text-[#4B5068] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-[#111318] border border-[#1E2130]">
                    <code className="flex-1 text-[11px] font-mono text-[#8B90A7] truncate">
                      {revealedKey === k.id ? k.key : maskKey(k.key)}
                    </code>
                    <button
                      onClick={() => setRevealedKey(revealedKey === k.id ? null : k.id)}
                      className="w-6 h-6 flex items-center justify-center text-[#4B5068] hover:text-[#F0F2FF] transition-colors flex-shrink-0"
                    >
                      {revealedKey === k.id ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => copy(k.key, k.id)}
                      className="w-6 h-6 flex items-center justify-center text-[#4B5068] hover:text-[#F0F2FF] transition-colors flex-shrink-0"
                    >
                      {copiedId === k.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {k.permissions.map(p => (
                      <span key={p} className="px-2 py-0.5 rounded-full bg-[#1A1C24] border border-[#2A2E42] text-[10px] text-[#8B90A7]">{p}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Rate limits */}
          <Card>
            <h3 className="text-sm font-semibold text-[#F0F2FF] mb-3">Rate Limits</h3>
            <div className="space-y-2">
              {[
                { endpoint: 'GET /contacts', limit: '1,000 req/min', remaining: 847 },
                { endpoint: 'POST /flows/:id/trigger', limit: '500 req/min', remaining: 492 },
                { endpoint: 'POST /broadcasts', limit: '10 req/min', remaining: 8 },
                { endpoint: 'GET /analytics', limit: '100 req/min', remaining: 97 },
              ].map(r => (
                <div key={r.endpoint} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-[#1E2130] last:border-0 gap-2">
                  <code className="text-xs font-mono text-blue-400">{r.endpoint}</code>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#4B5068]">{r.limit}</span>
                    <div className="w-24 h-1.5 bg-[#222530] rounded-full">
                      <div className="h-full bg-green-400 rounded-full" style={{ width: `${(r.remaining / parseInt(r.limit)) * 100}%` }} />
                    </div>
                    <span className="text-xs text-green-400 w-16 text-right">{r.remaining} left</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {activeTab === 'webhooks' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#F0F2FF]">Outbound Webhooks</h3>
              <p className="text-xs text-[#8B90A7] mt-0.5">Receive real-time events from FlowPulse in your own systems</p>
            </div>
            <Button variant="primary" size="sm" onClick={() => setNewWebhookModal(true)}>
              <Plus className="w-3.5 h-3.5" /> Add Endpoint
            </Button>
          </div>
          <div className="space-y-3">
            {webhooks.map(wh => (
              <div key={wh.id} className="rounded-xl border border-[#1E2130] overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-[#0A0B0F] cursor-pointer hover:bg-[#111318] transition-colors"
                  onClick={() => setExpandedWh(expandedWh === wh.id ? null : wh.id)}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${wh.status === 'active' ? 'bg-green-400' : 'bg-[#4B5068]'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-[#F0F2FF]">{wh.name}</p>
                      <Badge variant={wh.status === 'active' ? 'success' : 'default'}>{wh.status}</Badge>
                    </div>
                    <p className="text-[11px] text-[#4B5068] truncate mt-0.5">{wh.url}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#8B90A7] flex-shrink-0">
                    <span className="text-green-400 font-semibold">{wh.successRate}%</span>
                    <span>{wh.events.length} events</span>
                    {expandedWh === wh.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {expandedWh === wh.id && (
                  <div className="px-4 py-4 border-t border-[#1E2130] space-y-4">
                    <div>
                      <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider mb-2">Subscribed Events</p>
                      <div className="flex flex-wrap gap-1.5">
                        {wh.events.map(ev => (
                          <span key={ev} className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-400">{ev}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider mb-2">Signing Secret</p>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-[#111318] border border-[#1E2130]">
                        <code className="flex-1 text-[11px] font-mono text-[#8B90A7] truncate">{wh.secretKey.substring(0, 16)}••••••••••••••••••••</code>
                        <button onClick={() => copy(wh.secretKey, 'wh-' + wh.id)} className="w-6 h-6 flex items-center justify-center text-[#4B5068] hover:text-[#F0F2FF]">
                          {copiedId === 'wh-' + wh.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={testingWh === wh.id}
                        onClick={() => testWebhook(wh.id)}
                      >
                        <Play className="w-3.5 h-3.5" /> Send Test Event
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setWebhooks(prev => prev.map(w => w.id === wh.id ? { ...w, status: w.status === 'active' ? 'paused' : 'active' } : w))}
                      >
                        {wh.status === 'active' ? 'Pause' : 'Resume'}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setWebhooks(prev => prev.filter(w => w.id !== wh.id))}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'docs' && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Globe className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#F0F2FF]">REST API v1</h3>
                <p className="text-xs text-[#8B90A7] mt-0.5">Base URL: <code className="text-blue-400 font-mono">https://api.flowpulse.io/v1</code></p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { method: 'GET', path: '/contacts', desc: 'List all contacts with pagination and filters' },
                { method: 'GET', path: '/contacts/:id', desc: 'Retrieve a single contact with full profile' },
                { method: 'POST', path: '/contacts', desc: 'Create or upsert a contact by platform ID' },
                { method: 'GET', path: '/flows', desc: 'List all flows with status and trigger info' },
                { method: 'POST', path: '/flows/:id/trigger', desc: 'Manually trigger a flow for a contact' },
                { method: 'GET', path: '/conversations', desc: 'List conversations with message preview' },
                { method: 'POST', path: '/broadcasts', desc: 'Create and schedule a broadcast campaign' },
                { method: 'GET', path: '/analytics/overview', desc: 'Get aggregated metrics for a date range' },
              ].map(endpoint => (
                <div key={endpoint.path} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl bg-[#0A0B0F] border border-[#1E2130]">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono flex-shrink-0 w-12 text-center ${endpoint.method === 'GET' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {endpoint.method}
                    </span>
                    <code className="text-xs font-mono text-[#F0F2FF]">{endpoint.path}</code>
                  </div>
                  <span className="text-xs text-[#8B90A7]">{endpoint.desc}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-[#F0F2FF] mb-3">Authentication</h3>
            <p className="text-xs text-[#8B90A7] mb-3">Include your API key in the Authorization header:</p>
            <div className="p-3 rounded-xl bg-[#0A0B0F] border border-[#1E2130]">
              <pre className="text-[11px] font-mono text-green-400 whitespace-pre-wrap">{`curl https://api.flowpulse.io/v1/contacts \\
  -H "Authorization: Bearer fp_live_k9x2m..." \\
  -H "Content-Type: application/json"`}</pre>
            </div>
          </Card>
        </div>
      )}

      {/* New Key Modal */}
      <Modal
        open={newKeyModal}
        onClose={() => setNewKeyModal(false)}
        title="Create API Key"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewKeyModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={createKey} disabled={!newKeyName}>
              <Plus className="w-3.5 h-3.5" /> Create Key
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Key name" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="e.g. Production, Zapier, Analytics" />
          <div>
            <label className="text-xs font-medium text-[#8B90A7] block mb-2">Permissions</label>
            <div className="space-y-2">
              {PERMISSION_SCOPES.map(scope => (
                <label key={scope.id} className="flex items-start gap-3 cursor-pointer">
                  <div
                    onClick={() => togglePerm(scope.id)}
                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${selectedPerms.includes(scope.id) ? 'bg-blue-500 border-blue-500' : 'border-[#2A2E42] bg-[#1A1C24]'} ${(scope as any).danger ? 'border-red-500/30' : ''}`}
                  >
                    {selectedPerms.includes(scope.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${(scope as any).danger ? 'text-red-400' : 'text-[#F0F2FF]'}`}>{scope.label}</p>
                    <p className="text-[11px] text-[#4B5068]">{scope.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* New Webhook Modal */}
      <Modal
        open={newWebhookModal}
        onClose={() => setNewWebhookModal(false)}
        title="Add Webhook Endpoint"
        maxWidth="max-w-xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewWebhookModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={createWebhook} disabled={!whName || !whUrl || selectedEvents.length === 0}>
              <Plus className="w-3.5 h-3.5" /> Create Endpoint
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Endpoint name" value={whName} onChange={e => setWhName(e.target.value)} placeholder="e.g. Shopify Sync" />
          <Input label="URL" value={whUrl} onChange={e => setWhUrl(e.target.value)} placeholder="https://your-server.com/webhook" />
          <div>
            <label className="text-xs font-medium text-[#8B90A7] block mb-2">Subscribe to events ({selectedEvents.length} selected)</label>
            <div className="max-h-48 overflow-y-auto space-y-3 pr-1">
              {ALL_EVENTS.map(group => (
                <div key={group.group}>
                  <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider mb-1.5">{group.group}</p>
                  <div className="space-y-1">
                    {group.events.map(ev => (
                      <label key={ev} className="flex items-center gap-2 cursor-pointer group">
                        <div
                          onClick={() => toggleEvent(ev)}
                          className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${selectedEvents.includes(ev) ? 'bg-blue-500 border-blue-500' : 'border-[#2A2E42] bg-[#1A1C24] group-hover:border-blue-500/50'}`}
                        >
                          {selectedEvents.includes(ev) && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <code className="text-xs font-mono text-[#8B90A7] group-hover:text-[#F0F2FF] transition-colors">{ev}</code>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
