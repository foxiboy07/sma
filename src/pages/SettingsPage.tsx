import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Settings, Users, CreditCard, Bell, Puzzle,
  Brain, Shield, Code2, Flag, ChevronRight
} from 'lucide-react';
import { Button, Card, Input, Select, Toggle, Badge } from '../components/ui';
import { useAuth } from '../hooks/useAuth';

const SETTINGS_NAV = [
  { to: '/settings', label: 'General', icon: Settings, exact: true },
  { to: '/settings/team', label: 'Team & Roles', icon: Users },
  { to: '/settings/billing', label: 'Billing & Plan', icon: CreditCard },
  { to: '/settings/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings/integrations', label: 'Integrations', icon: Puzzle },
  { to: '/settings/ai', label: 'AI & Knowledge', icon: Brain },
  { to: '/settings/gdpr', label: 'GDPR & Compliance', icon: Shield },
  { to: '/settings/api', label: 'API & Webhooks', icon: Code2 },
];

export function SettingsLayout() {
  const location = useLocation();

  return (
    <div className="flex h-full">
      <div className="w-52 border-r border-[#1E2130] bg-[#111318] flex-shrink-0 p-3">
        <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-widest px-3 mb-2">Settings</p>
        {SETTINGS_NAV.map(item => {
          const isActive = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to) && item.to !== '/settings';
          const exactActive = item.exact && location.pathname === '/settings';
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${exactActive || isActive ? 'bg-blue-500/10 text-[#F0F2FF]' : 'text-[#8B90A7] hover:bg-[#1A1C24] hover:text-[#F0F2FF]'}`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </div>
    </div>
  );
}

export function GeneralSettings() {
  const { tenant, brand } = useAuth();
  const [brandName, setBrandName] = useState(brand?.name || '');
  const [timezone, setTimezone] = useState(brand?.timezone || 'UTC');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#F0F2FF] mb-0.5">General</h2>
        <p className="text-xs text-[#8B90A7]">Manage your brand and account settings</p>
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-[#F0F2FF] mb-4">Brand</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
              {brandName.charAt(0) || 'B'}
            </div>
            <div>
              <Button variant="secondary" size="sm">Upload logo</Button>
              <p className="text-[10px] text-[#4B5068] mt-1">PNG, JPG up to 2MB</p>
            </div>
          </div>
          <Input label="Brand name" value={brandName} onChange={e => setBrandName(e.target.value)} />
          <Select
            label="Timezone"
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            options={[
              { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
              { value: 'America/New_York', label: 'Eastern Time (ET)' },
              { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
              { value: 'Europe/London', label: 'British Time (GMT)' },
              { value: 'Europe/Berlin', label: 'Central European Time (CET)' },
              { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
            ]}
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-[#F0F2FF] mb-4">Security</h3>
        <div className="space-y-4">
          <Input label="Current password" type="password" placeholder="••••••••" />
          <Input label="New password" type="password" placeholder="••••••••" />
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#111318] border border-[#1E2130]">
            <div>
              <p className="text-sm font-medium text-[#F0F2FF]">Two-factor authentication</p>
              <p className="text-xs text-[#8B90A7] mt-0.5">Add an extra layer of security</p>
            </div>
            <Toggle checked={false} onChange={() => {}} />
          </div>
        </div>
      </Card>

      <Button variant="primary" loading={saving} onClick={save}>Save changes</Button>
    </div>
  );
}

export function TeamSettings() {
  const TEAM = [
    { name: 'Sarah Chen', email: 'sarah@brand.com', role: 'admin', status: 'active', lastActive: '2m ago' },
    { name: 'Marcus Li', email: 'marcus@brand.com', role: 'agent', status: 'active', lastActive: '1h ago' },
    { name: 'Invite pending', email: 'design@brand.com', role: 'readonly', status: 'invited', lastActive: '—' },
  ];

  const roleColors = { admin: 'text-purple-400 bg-purple-400/10 border-purple-400/20', manager: 'text-blue-400 bg-blue-400/10 border-blue-400/20', agent: 'text-green-400 bg-green-400/10 border-green-400/20', readonly: 'text-gray-400 bg-gray-400/10 border-gray-400/20' };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#F0F2FF] mb-0.5">Team & Roles</h2>
        <p className="text-xs text-[#8B90A7]">Manage team members and their permissions</p>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#F0F2FF]">Team Members</h3>
          <Button variant="primary" size="sm">Invite member</Button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1E2130]">
              {['Member', 'Role', 'Status', 'Last Active', ''].map(h => (
                <th key={h} className="pb-2 text-left text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TEAM.map((m, i) => (
              <tr key={i} className="border-b border-[#1E2130] last:border-0">
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">
                      {m.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#F0F2FF]">{m.name}</p>
                      <p className="text-[10px] text-[#4B5068]">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${roleColors[m.role as keyof typeof roleColors]}`}>{m.role}</span>
                </td>
                <td className="py-3">
                  <Badge variant={m.status === 'active' ? 'success' : 'default'}>{m.status}</Badge>
                </td>
                <td className="py-3 text-xs text-[#8B90A7]">{m.lastActive}</td>
                <td className="py-3">
                  <button className="text-xs text-[#4B5068] hover:text-red-400 transition-colors">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function BillingSettings() {
  const { tenant } = useAuth();
  const plan = tenant?.plan || 'FREE';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#F0F2FF] mb-0.5">Billing & Plan</h2>
        <p className="text-xs text-[#8B90A7]">Manage your subscription and billing information</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { plan: 'FREE', price: '$0/mo', features: ['1 connected account', '500 contacts', 'Basic flows', '5 flows max'] },
          { plan: 'PRO', price: '$79/mo', features: ['3 connected accounts', '10K contacts', 'All node types', 'AI Step', 'Multiplayer (2 users)'], popular: true },
          { plan: 'LEGEND', price: '$299/mo', features: ['Unlimited accounts', 'Unlimited contacts', 'Custom Code Block', 'Full AI + function calling', 'Ghost A/B', 'TikTok Shop'] },
        ].map(p => (
          <div key={p.plan} className={`p-5 rounded-xl border relative ${plan === p.plan ? 'border-blue-500/40 bg-blue-500/5' : 'border-[#2A2E42] bg-[#1A1C24]'} ${(p as any).popular ? 'ring-1 ring-blue-500/30' : ''}`}>
            {(p as any).popular && <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold">Most popular</span>}
            <p className="text-xs font-semibold text-[#8B90A7] uppercase tracking-wider mb-1">{p.plan}</p>
            <p className="text-2xl font-bold text-[#F0F2FF] mb-3">{p.price}</p>
            <ul className="space-y-1.5 mb-4">
              {p.features.map(f => (
                <li key={f} className="text-xs text-[#8B90A7] flex items-center gap-1.5">
                  <span className="text-green-400 font-bold">✓</span>{f}
                </li>
              ))}
            </ul>
            {plan === p.plan
              ? <Button variant="secondary" size="sm" className="w-full" disabled>Current plan</Button>
              : <Button variant="primary" size="sm" className="w-full">Upgrade to {p.plan}</Button>
            }
          </div>
        ))}
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-[#F0F2FF] mb-4">Usage This Month</h3>
        <div className="space-y-3">
          {[
            { label: 'Connected accounts', used: 2, max: plan === 'FREE' ? 1 : plan === 'PRO' ? 3 : null },
            { label: 'Contacts', used: 3421, max: plan === 'FREE' ? 500 : plan === 'PRO' ? 10000 : null },
            { label: 'AI messages', used: 1204, max: null },
          ].map(item => (
            <div key={item.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#8B90A7]">{item.label}</span>
                <span className="text-[#F0F2FF] font-medium">{item.used.toLocaleString()}{item.max ? ` / ${item.max.toLocaleString()}` : ' (unlimited)'}</span>
              </div>
              {item.max && (
                <div className="h-1.5 bg-[#222530] rounded-full">
                  <div className={`h-full rounded-full ${(item.used / item.max) > 0.9 ? 'bg-red-400' : (item.used / item.max) > 0.7 ? 'bg-amber-400' : 'bg-blue-400'}`}
                    style={{ width: `${Math.min(100, (item.used / item.max) * 100)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function AISettings() {
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#F0F2FF] mb-0.5">AI & Knowledge</h2>
        <p className="text-xs text-[#8B90A7]">Configure your AI persona and budget settings</p>
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-[#F0F2FF] mb-4">Brand Persona</h3>
        <div className="space-y-4">
          <Input label="Persona name" placeholder="Aria" defaultValue="Aria" />
          <div>
            <label className="text-xs font-medium text-[#8B90A7] block mb-2">Tone</label>
            <div className="flex gap-2">
              {['Friendly', 'Professional', 'Witty'].map(t => (
                <button key={t} className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-colors ${t === 'Friendly' ? 'border-blue-500/40 bg-blue-500/10 text-blue-400' : 'border-[#2A2E42] text-[#8B90A7] hover:text-[#F0F2FF]'}`}>{t}</button>
              ))}
            </div>
          </div>
          <Select label="Language" options={[{ value: 'en', label: 'English' }, { value: 'es', label: 'Spanish' }, { value: 'fr', label: 'French' }]} />
          <div>
            <label className="text-xs font-medium text-[#8B90A7] block mb-1">Forbidden topics</label>
            <div className="flex flex-wrap gap-1 p-2 rounded-lg bg-[#111318] border border-[#2A2E42] min-h-[40px]">
              {['Politics', 'Competitors'].map(t => (
                <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">{t} ×</span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-[#F0F2FF] mb-4">AI Budget</h3>
        <div className="space-y-4">
          <Input label="Monthly budget cap (USD)" type="number" defaultValue="200" />
          <div>
            <label className="text-xs font-medium text-[#8B90A7] block mb-1">Alert threshold</label>
            <div className="flex items-center gap-3">
              <input type="range" min="50" max="95" defaultValue="80" className="flex-1" />
              <span className="text-sm font-medium text-[#F0F2FF] w-10">80%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tier 1 model" options={[{ value: 'gpt-4o-mini', label: 'GPT-4o mini' }, { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' }]} />
            <Select label="Tier 2 model" options={[{ value: 'gpt-4o', label: 'GPT-4o' }, { value: 'claude-sonnet', label: 'Claude Sonnet' }]} />
          </div>
        </div>
      </Card>

      <Button variant="primary">Save AI Settings</Button>
    </div>
  );
}

export function NotificationsSettings() {
  const NOTIF_TYPES = [
    { label: 'Token broken', desc: 'When a connected account token breaks' },
    { label: 'Circuit breaker tripped', desc: 'When a circuit breaker opens for an account' },
    { label: 'Priority Red', desc: 'When a conversation needs human attention' },
    { label: 'DLQ > 100 messages', desc: 'When the dead letter queue is getting large' },
    { label: 'Token expiring', desc: '72h before a token expires' },
    { label: 'Daily summary', desc: 'Daily digest of key metrics' },
  ];

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#F0F2FF] mb-0.5">Notifications</h2>
        <p className="text-xs text-[#8B90A7]">Choose how you'd like to be notified</p>
      </div>

      <Card>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 mb-3 px-1">
          <span className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">Notification</span>
          <span className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">In-app</span>
          <span className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">Email</span>
          <span className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">Push</span>
        </div>
        <div className="space-y-0">
          {NOTIF_TYPES.map(n => (
            <div key={n.label} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center py-3 border-t border-[#1E2130]">
              <div>
                <p className="text-xs font-medium text-[#F0F2FF]">{n.label}</p>
                <p className="text-[10px] text-[#4B5068]">{n.desc}</p>
              </div>
              <Toggle checked={true} onChange={() => {}} size="sm" />
              <Toggle checked={true} onChange={() => {}} size="sm" />
              <Toggle checked={false} onChange={() => {}} size="sm" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
