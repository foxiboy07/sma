import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, ExternalLink, Copy } from 'lucide-react';
import { Button, Card, Badge, Toggle } from '../components/ui';

const INTEGRATIONS = [
  { id: 'shopify', name: 'Shopify', desc: 'Sync orders, products, and customer data', connected: true, logoColor: '#96BF48', lastSync: '5m ago', features: ['Order status lookup', 'Product inventory', 'Customer data sync', 'Purchase attribution'] },
  { id: 'calendly', name: 'Calendly', desc: 'Book appointments via AI flow', connected: false, logoColor: '#00A2FF', lastSync: null, features: ['Book appointments', 'Check availability', 'Send reminders'] },
  { id: 'stripe', name: 'Stripe', desc: 'Process payments and manage subscriptions', connected: false, logoColor: '#635BFF', lastSync: null, features: ['Payment processing', 'Subscription management', 'Purchase events'] },
  { id: 'zapier', name: 'Zapier', desc: 'Connect with 5000+ apps via webhooks', connected: false, logoColor: '#FF4A00', lastSync: null, features: ['Custom workflows', 'Multi-step Zaps', 'Event triggers'] },
  { id: 'make', name: 'Make (Integromat)', desc: 'Advanced automation scenarios', connected: false, logoColor: '#7B68EE', lastSync: null, features: ['Complex scenarios', 'Data transformation', 'Conditional flows'] },
];

export function IntegrationsPage() {
  const [integrations, setIntegrations] = useState(INTEGRATIONS);

  function toggle(id: string) {
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, connected: !i.connected } : i));
  }

  return (
    <div className="p-6 max-w-[1400px]">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#F0F2FF]">Integrations</h1>
        <p className="text-xs text-[#8B90A7] mt-0.5">Connect your external tools and services</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map(integration => (
          <Card key={integration.id}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: integration.logoColor }}>
                  {integration.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#F0F2FF]">{integration.name}</p>
                  {integration.connected
                    ? <span className="flex items-center gap-1 text-[10px] text-green-400"><CheckCircle2 className="w-3 h-3" /> Connected · {integration.lastSync}</span>
                    : <span className="text-[10px] text-[#4B5068]">Not connected</span>
                  }
                </div>
              </div>
            </div>
            <p className="text-xs text-[#8B90A7] mb-3">{integration.desc}</p>
            <div className="space-y-1 mb-4">
              {integration.features.map(f => (
                <div key={f} className="flex items-center gap-1.5 text-xs text-[#8B90A7]">
                  <span className={`w-1 h-1 rounded-full ${integration.connected ? 'bg-green-400' : 'bg-[#4B5068]'}`} />
                  {f}
                </div>
              ))}
            </div>
            <Button
              variant={integration.connected ? 'secondary' : 'primary'}
              size="sm"
              className="w-full"
              onClick={() => toggle(integration.id)}
            >
              {integration.connected ? 'Disconnect' : 'Connect'}
            </Button>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <h3 className="text-sm font-semibold text-[#F0F2FF] mb-3">API Keys</h3>
        <div className="flex items-center justify-between p-3 rounded-lg bg-[#111318] border border-[#1E2130] mb-3">
          <div>
            <p className="text-xs font-medium text-[#F0F2FF]">Production API Key</p>
            <p className="text-[10px] font-mono text-[#4B5068]">fp_live_••••••••••••••••••••••••••••••••</p>
          </div>
          <div className="flex gap-2">
            <button className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
          </div>
        </div>
        <Button variant="primary" size="sm">Generate New API Key</Button>
      </Card>
    </div>
  );
}
