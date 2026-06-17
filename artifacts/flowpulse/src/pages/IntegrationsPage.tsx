import React, { useState } from 'react';
import {
  CheckCircle2, AlertCircle, ExternalLink, Copy, RefreshCw,
  X, Eye, EyeOff, Wifi, WifiOff, ChevronRight, Key, Zap,
  ShoppingCart, Calendar, CreditCard, Link2, GitMerge
} from 'lucide-react';
import { Button, Card, Badge, Modal, Input } from '../components/ui';

interface Integration {
  id: string;
  name: string;
  category: string;
  desc: string;
  connected: boolean;
  logoColor: string;
  logoIcon: React.ElementType;
  lastSync: string | null;
  lastSyncTs: number | null;
  features: string[];
  setupSteps: string[];
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  webhookUrl?: string;
  docsUrl: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'E-commerce',
    desc: 'Sync orders, products, and customer data for real-time cart abandonment and purchase tracking.',
    connected: true,
    logoColor: '#96BF48',
    logoIcon: ShoppingCart,
    lastSync: '5 minutes ago',
    lastSyncTs: Date.now() - 5 * 60 * 1000,
    features: [
      'Order status lookup in flows',
      'Product catalog sync',
      'Customer data enrichment',
      'Cart abandonment webhooks',
      'Purchase attribution tracking',
    ],
    setupSteps: [
      'Go to Shopify Admin → Apps → Private Apps',
      'Create a new private app with read access to Orders, Products, Customers',
      'Copy the API key and paste it below',
      'Add the webhook URL to your Shopify store settings',
    ],
    apiKeyLabel: 'Shopify API Key',
    apiKeyPlaceholder: 'shpat_xxxxxxxxxxxxxxxxxxxx',
    webhookUrl: 'https://api.flowpulse.io/webhooks/shopify',
    docsUrl: 'https://docs.shopify.com/api',
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    category: 'E-commerce',
    desc: 'Connect your WooCommerce store to trigger flows on purchases, refunds, and cart events.',
    connected: false,
    logoColor: '#7F54B3',
    logoIcon: ShoppingCart,
    lastSync: null,
    lastSyncTs: null,
    features: [
      'Purchase event triggers',
      'Product lookup in flows',
      'Customer order history',
      'Abandoned cart detection',
    ],
    setupSteps: [
      'Install the WooCommerce REST API plugin',
      'Go to WooCommerce → Settings → Advanced → REST API',
      'Create a new API key with Read/Write permissions',
      'Copy the Consumer Key and Consumer Secret below',
    ],
    apiKeyLabel: 'Consumer Key',
    apiKeyPlaceholder: 'ck_xxxxxxxxxxxxxxxxxxxx',
    webhookUrl: 'https://api.flowpulse.io/webhooks/woocommerce',
    docsUrl: 'https://woocommerce.github.io/woocommerce-rest-api-docs/',
  },
  {
    id: 'calendly',
    name: 'Calendly',
    category: 'Scheduling',
    desc: 'Let AI flows book, reschedule, and confirm appointments by checking real-time calendar availability.',
    connected: false,
    logoColor: '#00A2FF',
    logoIcon: Calendar,
    lastSync: null,
    lastSyncTs: null,
    features: [
      'Check available time slots',
      'Book appointments in flows',
      'Send booking confirmations',
      'Reschedule and cancellation handling',
      'Calendar event triggers',
    ],
    setupSteps: [
      'Log in to Calendly and go to Integrations → API & Webhooks',
      'Generate a Personal Access Token',
      'Copy the token below',
      'Select which event types to expose to FlowPulse',
    ],
    apiKeyLabel: 'Personal Access Token',
    apiKeyPlaceholder: 'eyJraWQiOiIxY...',
    docsUrl: 'https://developer.calendly.com/',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'Payments',
    desc: 'Process payments, check subscription status, and trigger flows based on payment events.',
    connected: false,
    logoColor: '#635BFF',
    logoIcon: CreditCard,
    lastSync: null,
    lastSyncTs: null,
    features: [
      'Payment intent processing',
      'Subscription status checks',
      'Invoice and payment events',
      'Customer billing portal links',
      'Refund and dispute triggers',
    ],
    setupSteps: [
      'Go to Stripe Dashboard → Developers → API Keys',
      'Copy your Restricted Key (create one with Customers read, Charges read)',
      'Paste the key below',
      'Add the webhook endpoint in Stripe → Webhooks',
    ],
    apiKeyLabel: 'Stripe Restricted Key',
    apiKeyPlaceholder: 'rk_live_xxxxxxxxxxxxxxxxxxxx',
    webhookUrl: 'https://api.flowpulse.io/webhooks/stripe',
    docsUrl: 'https://stripe.com/docs/api',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    category: 'Automation',
    desc: 'Connect FlowPulse to 5,000+ apps. Trigger flows from any Zapier event or send data outbound.',
    connected: false,
    logoColor: '#FF4A00',
    logoIcon: Zap,
    lastSync: null,
    lastSyncTs: null,
    features: [
      'Inbound: trigger flows from any Zap',
      'Outbound: send flow events to Zaps',
      '5,000+ app connections',
      'Multi-step Zap support',
      'Filter and format data',
    ],
    setupSteps: [
      'Go to Zapier and create a new Zap',
      'Choose "Webhooks by Zapier" as the trigger',
      'Copy your Zapier webhook URL',
      'Paste it in FlowPulse when setting up an Outbound Webhook node',
      'For inbound triggers, use the FlowPulse webhook URL below in your Zap action',
    ],
    apiKeyLabel: 'Zapier Webhook URL',
    apiKeyPlaceholder: 'https://hooks.zapier.com/hooks/catch/...',
    webhookUrl: 'https://api.flowpulse.io/webhooks/zapier',
    docsUrl: 'https://zapier.com/apps/webhook/integrations',
  },
  {
    id: 'make',
    name: 'Make',
    category: 'Automation',
    desc: 'Build advanced automation scenarios with Make (formerly Integromat). Full bidirectional support.',
    connected: false,
    logoColor: '#7B68EE',
    logoIcon: GitMerge,
    lastSync: null,
    lastSyncTs: null,
    features: [
      'Advanced scenario building',
      'Data transformation in transit',
      'Conditional branching logic',
      'Error handling & retry',
      'Real-time and scheduled triggers',
    ],
    setupSteps: [
      'Log in to Make and create a new scenario',
      'Add a Webhooks module as the trigger',
      'Copy the custom webhook URL',
      'Paste it in FlowPulse as an Outbound Webhook destination',
      'For inbound triggers, use the FlowPulse webhook URL in your Make HTTP module',
    ],
    apiKeyLabel: 'Make Webhook URL',
    apiKeyPlaceholder: 'https://hook.eu1.make.com/...',
    webhookUrl: 'https://api.flowpulse.io/webhooks/make',
    docsUrl: 'https://www.make.com/en/help/tools/webhooks',
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  'E-commerce': 'bg-green-500/10 text-green-400 border-green-500/20',
  'Scheduling': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Payments': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Automation': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

export function IntegrationsPage() {
  const [integrations, setIntegrations] = useState(INTEGRATIONS);
  const [modalIntegration, setModalIntegration] = useState<Integration | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const connectedCount = integrations.filter(i => i.connected).length;

  async function handleConnect() {
    if (!modalIntegration || !apiKey.trim()) return;
    setConnecting(true);
    setConnectError(null);
    try {
      // Simulate API validation (in production, call your backend)
      await new Promise(r => setTimeout(r, 1400));
      if (apiKey.length < 8) throw new Error('API key appears to be invalid. Please check and try again.');
      setIntegrations(prev => prev.map(i =>
        i.id === modalIntegration.id
          ? { ...i, connected: true, lastSync: 'Just now', lastSyncTs: Date.now() }
          : i
      ));
      setModalIntegration(null);
      setApiKey('');
    } catch (err: any) {
      setConnectError(err?.message || 'Connection failed. Check your API key and try again.');
    } finally {
      setConnecting(false);
    }
  }

  async function handleSync(id: string) {
    setSyncing(id);
    await new Promise(r => setTimeout(r, 1800));
    setIntegrations(prev => prev.map(i =>
      i.id === id ? { ...i, lastSync: 'Just now', lastSyncTs: Date.now() } : i
    ));
    setSyncing(null);
  }

  function handleDisconnect(id: string) {
    setIntegrations(prev => prev.map(i =>
      i.id === id ? { ...i, connected: false, lastSync: null, lastSyncTs: null } : i
    ));
    setDisconnectConfirm(null);
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function openConnect(integration: Integration) {
    setModalIntegration(integration);
    setApiKey('');
    setShowApiKey(false);
    setConnectError(null);
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#F0F2FF]">Integrations</h1>
          <p className="text-xs text-[#8B90A7] mt-0.5">
            {connectedCount} of {integrations.length} connected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
            connectedCount > 0
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-[#1A1C24] border-[#2A2E42] text-[#8B90A7]'
          }`}>
            {connectedCount > 0 ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {connectedCount > 0 ? `${connectedCount} active` : 'None connected'}
          </div>
        </div>
      </div>

      {/* Integration grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {integrations.map(integration => {
          const Icon = integration.logoIcon;
          const isSyncing = syncing === integration.id;

          return (
            <div
              key={integration.id}
              className={`bg-[#111318] border rounded-2xl p-5 transition-all duration-200 flex flex-col ${
                integration.connected
                  ? 'border-green-500/20 hover:border-green-500/30'
                  : 'border-[#1E2130] hover:border-[#2A2E42]'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: integration.logoColor + '22' }}
                  >
                    <Icon className="w-5 h-5" style={{ color: integration.logoColor }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#F0F2FF]">{integration.name}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[integration.category] || 'bg-[#1A1C24] text-[#8B90A7] border-[#2A2E42]'}`}>
                        {integration.category}
                      </span>
                    </div>
                    {integration.connected ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[11px] text-green-400 font-medium">Connected</span>
                        {integration.lastSync && (
                          <span className="text-[11px] text-[#4B5068]">· Synced {integration.lastSync}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#4B5068]">Not connected</span>
                    )}
                  </div>
                </div>
                <a
                  href={integration.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#4B5068] hover:text-[#8B90A7] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Description */}
              <p className="text-xs text-[#8B90A7] leading-relaxed mb-4">{integration.desc}</p>

              {/* Features */}
              <div className="space-y-1.5 mb-5 flex-1">
                {integration.features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${integration.connected ? 'bg-green-400' : 'bg-[#2A2E42]'}`} />
                    <span className={integration.connected ? 'text-[#C0C4D8]' : 'text-[#4B5068]'}>{f}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-auto">
                {integration.connected ? (
                  <>
                    <button
                      onClick={() => handleSync(integration.id)}
                      disabled={isSyncing}
                      className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#8B90A7] hover:text-[#F0F2FF] hover:bg-[#222530] transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                    <button
                      onClick={() => setDisconnectConfirm(integration.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 hover:bg-red-500/20 transition-all"
                    >
                      <WifiOff className="w-3.5 h-3.5" />
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => openConnect(integration)}
                    className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg bg-blue-500 text-xs text-white font-medium hover:bg-blue-600 active:scale-[0.98] transition-all"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Connect {integration.name}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* API Keys section */}
      <div className="bg-[#111318] border border-[#1E2130] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-[#4B5068]" />
          <h3 className="text-sm font-semibold text-[#F0F2FF]">FlowPulse API Keys</h3>
          <Badge variant="info" className="ml-auto">Production</Badge>
        </div>
        <p className="text-xs text-[#8B90A7] mb-4">Use these keys when external services need to call FlowPulse.</p>
        <div className="space-y-3">
          {[
            { label: 'Production API Key', value: 'fp_live_••••••••••••••••••••••••••••••••', copyValue: 'fp_live_example_key_here' },
            { label: 'Webhook Signing Secret', value: 'whsec_••••••••••••••••••••••••••••', copyValue: 'whsec_example_secret_here' },
          ].map(key => (
            <div key={key.label} className="flex items-center justify-between p-3 rounded-xl bg-[#0A0B0F] border border-[#1E2130]">
              <div>
                <p className="text-xs font-medium text-[#F0F2FF]">{key.label}</p>
                <p className="text-[11px] font-mono text-[#4B5068] mt-0.5">{key.value}</p>
              </div>
              <button
                onClick={() => copyText(key.copyValue, key.label)}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors ml-4"
              >
                {copied === key.label ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === key.label ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
        <Button variant="primary" size="sm" className="mt-4">
          <Key className="w-3.5 h-3.5" /> Generate New Key
        </Button>
      </div>

      {/* Connect Modal */}
      {modalIntegration && (
        <Modal
          open={!!modalIntegration}
          onClose={() => { setModalIntegration(null); setApiKey(''); setConnectError(null); }}
          title={`Connect ${modalIntegration.name}`}
          maxWidth="max-w-lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => { setModalIntegration(null); setApiKey(''); }}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleConnect}
                disabled={!apiKey.trim() || connecting}
                loading={connecting}
              >
                {connecting ? 'Connecting...' : `Connect ${modalIntegration.name}`}
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            {/* Setup steps */}
            <div>
              <p className="text-xs font-semibold text-[#4B5068] uppercase tracking-wider mb-3">Setup Instructions</p>
              <div className="space-y-2">
                {modalIntegration.setupSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-500/15 border border-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-xs text-[#8B90A7] leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Webhook URL if applicable */}
            {modalIntegration.webhookUrl && (
              <div>
                <p className="text-xs font-semibold text-[#4B5068] uppercase tracking-wider mb-2">Webhook URL</p>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#0A0B0F] border border-[#1E2130]">
                  <span className="text-xs font-mono text-[#8B90A7] flex-1 truncate">{modalIntegration.webhookUrl}</span>
                  <button
                    onClick={() => copyText(modalIntegration.webhookUrl!, 'webhook')}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 flex-shrink-0"
                  >
                    {copied === 'webhook' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {/* API Key input */}
            <div>
              <label className="block text-xs font-medium text-[#8B90A7] mb-1.5">{modalIntegration.apiKeyLabel}</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={modalIntegration.apiKeyPlaceholder}
                  className="w-full h-9 px-3 pr-10 rounded-lg bg-[#0A0B0F] border border-[#1E2130] text-sm text-[#F0F2FF] placeholder:text-[#4B5068] focus:outline-none focus:border-blue-500 transition-colors font-mono"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5068] hover:text-[#8B90A7]"
                >
                  {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-[#4B5068] mt-1">Your key is encrypted at rest and never exposed in logs.</p>
            </div>

            {/* Error */}
            {connectError && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{connectError}</span>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Disconnect Confirmation */}
      {disconnectConfirm && (
        <Modal
          open={!!disconnectConfirm}
          onClose={() => setDisconnectConfirm(null)}
          title="Disconnect Integration"
          maxWidth="max-w-sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDisconnectConfirm(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => handleDisconnect(disconnectConfirm)}>
                Yes, Disconnect
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-[#8B90A7]">
              Disconnecting will stop all data syncs and may break flows that depend on this integration. This action can be reversed by reconnecting.
            </p>
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Active flows using this integration will fall back to manual handling.</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
