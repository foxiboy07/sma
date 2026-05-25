import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Settings, Users, CreditCard, Bell, Puzzle,
  Brain, Shield, Code2,
} from 'lucide-react';
import { Button, Card, Input, Select, Toggle, Badge } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { TeamMember } from '../types';

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

// Small inline "Saved!" confirmation component
function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-xs font-medium text-green-400">Saved!</span>;
}

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

  // Brand section
  const [brandName, setBrandName] = useState(brand?.name || '');
  const [timezone, setTimezone] = useState(brand?.timezone || 'UTC');
  const [logoUrl, setLogoUrl] = useState((brand as any)?.logo_url || '');
  const [savingBrand, setSavingBrand] = useState(false);
  const [savedBrand, setSavedBrand] = useState(false);

  // Password section
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [savedPassword, setSavedPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // 2FA
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  // Sync state when brand loads
  useEffect(() => {
    if (brand) {
      setBrandName(brand.name || '');
      setTimezone(brand.timezone || 'UTC');
      setLogoUrl((brand as any).logo_url || '');
    }
  }, [brand?.id]);

  async function saveBrand() {
    if (!brand) return;
    setSavingBrand(true);
    setSavedBrand(false);
    await supabase
      .from('brands')
      .update({ name: brandName, timezone, logo_url: logoUrl || null })
      .eq('id', brand.id);
    setSavingBrand(false);
    setSavedBrand(true);
    setTimeout(() => setSavedBrand(false), 3000);
  }

  async function savePassword() {
    if (!newPassword) return;
    setSavingPassword(true);
    setSavedPassword(false);
    setPasswordError('');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      setPasswordError(error.message);
    } else {
      setSavedPassword(true);
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setSavedPassword(false), 3000);
    }
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
            {logoUrl ? (
              <img src={logoUrl} alt="Brand logo" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
                {brandName.charAt(0) || 'B'}
              </div>
            )}
            <div className="flex-1">
              <Input
                label="Logo URL"
                value={logoUrl}
                onChange={e => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
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
        <div className="flex items-center gap-3 mt-4">
          <Button variant="primary" loading={savingBrand} onClick={saveBrand}>Save changes</Button>
          <SavedBadge show={savedBrand} />
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-[#F0F2FF] mb-4">Security</h3>
        <div className="space-y-4">
          <Input
            label="Current password"
            type="password"
            placeholder="••••••••"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
          />
          <Input
            label="New password"
            type="password"
            placeholder="••••••••"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />
          {passwordError && (
            <p className="text-xs text-red-400">{passwordError}</p>
          )}
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              loading={savingPassword}
              onClick={savePassword}
              disabled={!newPassword}
            >
              Change password
            </Button>
            <SavedBadge show={savedPassword} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#111318] border border-[#1E2130]">
            <div>
              <p className="text-sm font-medium text-[#F0F2FF]">Two-factor authentication</p>
              <p className="text-xs text-[#8B90A7] mt-0.5">Add an extra layer of security</p>
            </div>
            <Toggle checked={twoFAEnabled} onChange={v => setTwoFAEnabled(v)} />
          </div>
        </div>
      </Card>
    </div>
  );
}

export function TeamSettings() {
  const { tenant } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamMember['role']>('agent');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [savedInvite, setSavedInvite] = useState(false);

  const roleColors = {
    admin: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    manager: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    agent: 'text-green-400 bg-green-400/10 border-green-400/20',
    readonly: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
  };

  useEffect(() => {
    if (!tenant) return;
    fetchMembers();
  }, [tenant?.id]);

  async function fetchMembers() {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: true });
    setMembers(data || []);
    setLoading(false);
  }

  async function inviteMember() {
    if (!tenant || !inviteEmail.trim()) return;
    setInviting(true);
    await supabase.from('team_members').insert({
      tenant_id: tenant.id,
      email: inviteEmail.trim(),
      role: inviteRole,
      status: 'invited',
      skills: [],
    });
    setInviteEmail('');
    setInviteRole('agent');
    setShowInviteForm(false);
    setInviting(false);
    setSavedInvite(true);
    setTimeout(() => setSavedInvite(false), 3000);
    await fetchMembers();
  }

  async function removeMember(id: string) {
    await supabase.from('team_members').delete().eq('id', id);
    setMembers(prev => prev.filter(m => m.id !== id));
  }

  async function changeRole(id: string, role: TeamMember['role']) {
    await supabase.from('team_members').update({ role }).eq('id', id);
    setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m));
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#F0F2FF] mb-0.5">Team & Roles</h2>
        <p className="text-xs text-[#8B90A7]">Manage team members and their permissions</p>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#F0F2FF]">Team Members</h3>
          <div className="flex items-center gap-2">
            <SavedBadge show={savedInvite} />
            <Button variant="primary" size="sm" onClick={() => setShowInviteForm(v => !v)}>
              {showInviteForm ? 'Cancel' : 'Invite member'}
            </Button>
          </div>
        </div>

        {showInviteForm && (
          <div className="mb-4 p-4 rounded-xl bg-[#111318] border border-[#2A2E42] space-y-3">
            <Input
              label="Email address"
              type="email"
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />
            <Select
              label="Role"
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as TeamMember['role'])}
              options={[
                { value: 'admin', label: 'Admin' },
                { value: 'manager', label: 'Manager' },
                { value: 'agent', label: 'Agent' },
                { value: 'readonly', label: 'Read-only' },
              ]}
            />
            <Button
              variant="primary"
              size="sm"
              loading={inviting}
              onClick={inviteMember}
              disabled={!inviteEmail.trim()}
            >
              Send invite
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-xs text-[#4B5068] py-4 text-center">Loading members...</p>
        ) : members.length === 0 ? (
          <p className="text-xs text-[#4B5068] py-4 text-center">No team members yet. Invite someone to get started.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1E2130]">
                {['Member', 'Role', 'Status', 'Last Active', ''].map(h => (
                  <th key={h} className="pb-2 text-left text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className="border-b border-[#1E2130] last:border-0">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">
                        {(m.display_name || m.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[#F0F2FF]">{m.display_name || 'Invite pending'}</p>
                        <p className="text-[10px] text-[#4B5068]">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <select
                      value={m.role}
                      onChange={e => changeRole(m.id, e.target.value as TeamMember['role'])}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium border bg-transparent cursor-pointer ${roleColors[m.role]}`}
                    >
                      <option value="admin">admin</option>
                      <option value="manager">manager</option>
                      <option value="agent">agent</option>
                      <option value="readonly">readonly</option>
                    </select>
                  </td>
                  <td className="py-3">
                    <Badge variant={m.status === 'active' ? 'success' : 'default'}>{m.status}</Badge>
                  </td>
                  <td className="py-3 text-xs text-[#8B90A7]">
                    {m.last_active_at ? new Date(m.last_active_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3">
                    <button
                      className="text-xs text-[#4B5068] hover:text-red-400 transition-colors"
                      onClick={() => removeMember(m.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

export function BillingSettings() {
  const { tenant } = useAuth();
  const [plan, setPlan] = useState(tenant?.plan || 'FREE');
  const [savingPlan, setSavingPlan] = useState<string | null>(null);
  const [savedPlan, setSavedPlan] = useState(false);

  // Usage stats from Supabase
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [accountCount, setAccountCount] = useState<number | null>(null);
  const [aiMessageCount, setAiMessageCount] = useState<number | null>(null);

  useEffect(() => {
    if (!tenant) return;
    setPlan(tenant.plan);
    fetchUsage();
  }, [tenant?.id]);

  async function fetchUsage() {
    if (!tenant) return;
    const [contacts, accounts, aiMessages] = await Promise.all([
      supabase.from('unified_contacts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
      supabase.from('connected_accounts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('is_ai_generated', true),
    ]);
    setContactCount(contacts.count ?? 0);
    setAccountCount(accounts.count ?? 0);
    setAiMessageCount(aiMessages.count ?? 0);
  }

  async function changePlan(newPlan: string) {
    if (!tenant) return;
    setSavingPlan(newPlan);
    await supabase.from('tenants').update({ plan: newPlan }).eq('id', tenant.id);
    setPlan(newPlan as any);
    setSavingPlan(null);
    setSavedPlan(true);
    setTimeout(() => setSavedPlan(false), 3000);
  }

  const planLimits: Record<string, { accounts: number | null; contacts: number | null }> = {
    FREE: { accounts: 1, contacts: 500 },
    PRO: { accounts: 3, contacts: 10000 },
    LEGEND: { accounts: null, contacts: null },
  };
  const limits = planLimits[plan] || planLimits.FREE;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#F0F2FF] mb-0.5">Billing & Plan</h2>
          <p className="text-xs text-[#8B90A7]">Manage your subscription and billing information</p>
        </div>
        <SavedBadge show={savedPlan} />
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
              : <Button variant="primary" size="sm" className="w-full" loading={savingPlan === p.plan} onClick={() => changePlan(p.plan)}>
                  {plan === 'LEGEND' || (plan === 'PRO' && p.plan === 'FREE') ? `Downgrade to ${p.plan}` : `Upgrade to ${p.plan}`}
                </Button>
            }
          </div>
        ))}
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-[#F0F2FF] mb-4">Usage This Month</h3>
        <div className="space-y-3">
          {[
            { label: 'Connected accounts', used: accountCount ?? 0, max: limits.accounts },
            { label: 'Contacts', used: contactCount ?? 0, max: limits.contacts },
            { label: 'AI messages', used: aiMessageCount ?? 0, max: null },
          ].map(item => (
            <div key={item.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#8B90A7]">{item.label}</span>
                <span className="text-[#F0F2FF] font-medium">
                  {item.used.toLocaleString()}{item.max ? ` / ${item.max.toLocaleString()}` : ' (unlimited)'}
                </span>
              </div>
              {item.max && (
                <div className="h-1.5 bg-[#222530] rounded-full">
                  <div
                    className={`h-full rounded-full ${(item.used / item.max) > 0.9 ? 'bg-red-400' : (item.used / item.max) > 0.7 ? 'bg-amber-400' : 'bg-blue-400'}`}
                    style={{ width: `${Math.min(100, (item.used / item.max) * 100)}%` }}
                  />
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
  const { brand } = useAuth();

  const [personaName, setPersonaName] = useState((brand as any)?.persona_name || 'Aria');
  const [personaTone, setPersonaTone] = useState((brand as any)?.persona_tone || 'Friendly');
  const [personaLanguage, setPersonaLanguage] = useState((brand as any)?.persona_language || 'en');
  const [forbiddenTopics, setForbiddenTopics] = useState<string[]>(() => {
    const raw = (brand as any)?.persona_forbidden_topics;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw) {
      try { return JSON.parse(raw); } catch { return raw.split(',').map((s: string) => s.trim()).filter(Boolean); }
    }
    return ['Politics', 'Competitors'];
  });
  const [newTopic, setNewTopic] = useState('');

  const [budgetCap, setBudgetCap] = useState<number>((brand as any)?.ai_monthly_budget_usd ?? 200);
  const [alertThreshold, setAlertThreshold] = useState<number>((brand as any)?.ai_budget_alert_pct ?? 80);
  const [tier1Model, setTier1Model] = useState((brand as any)?.ai_tier1_model || 'gpt-4o-mini');
  const [tier2Model, setTier2Model] = useState((brand as any)?.ai_tier2_model || 'gpt-4o');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Sync when brand loads
  useEffect(() => {
    if (!brand) return;
    const b = brand as any;
    setPersonaName(b.persona_name || 'Aria');
    setPersonaTone(b.persona_tone || 'Friendly');
    setPersonaLanguage(b.persona_language || 'en');
    const raw = b.persona_forbidden_topics;
    if (Array.isArray(raw)) setForbiddenTopics(raw);
    else if (typeof raw === 'string' && raw) {
      try { setForbiddenTopics(JSON.parse(raw)); } catch { setForbiddenTopics(raw.split(',').map((s: string) => s.trim()).filter(Boolean)); }
    }
    if (b.ai_monthly_budget_usd != null) setBudgetCap(b.ai_monthly_budget_usd);
    if (b.ai_budget_alert_pct != null) setAlertThreshold(b.ai_budget_alert_pct);
    if (b.ai_tier1_model) setTier1Model(b.ai_tier1_model);
    if (b.ai_tier2_model) setTier2Model(b.ai_tier2_model);
  }, [brand?.id]);

  function addTopic() {
    const t = newTopic.trim();
    if (t && !forbiddenTopics.includes(t)) {
      setForbiddenTopics(prev => [...prev, t]);
    }
    setNewTopic('');
  }

  function removeTopic(topic: string) {
    setForbiddenTopics(prev => prev.filter(t => t !== topic));
  }

  async function saveAISettings() {
    if (!brand) return;
    setSaving(true);
    setSaved(false);
    setSaveError('');
    const { error } = await supabase
      .from('brands')
      .update({
        persona_name: personaName,
        persona_tone: personaTone,
        persona_language: personaLanguage,
        persona_forbidden_topics: forbiddenTopics,
        ai_monthly_budget_usd: budgetCap,
        ai_budget_alert_pct: alertThreshold,
        ai_tier1_model: tier1Model,
        ai_tier2_model: tier2Model,
      })
      .eq('id', brand.id);
    setSaving(false);
    if (error) {
      setSaveError(error.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#F0F2FF] mb-0.5">AI & Knowledge</h2>
        <p className="text-xs text-[#8B90A7]">Configure your AI persona and budget settings</p>
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-[#F0F2FF] mb-4">Brand Persona</h3>
        <div className="space-y-4">
          <Input
            label="Persona name"
            placeholder="Aria"
            value={personaName}
            onChange={e => setPersonaName(e.target.value)}
          />
          <div>
            <label className="text-xs font-medium text-[#8B90A7] block mb-2">Tone</label>
            <div className="flex gap-2">
              {['Friendly', 'Professional', 'Witty'].map(t => (
                <button
                  key={t}
                  onClick={() => setPersonaTone(t)}
                  className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-colors ${personaTone === t ? 'border-blue-500/40 bg-blue-500/10 text-blue-400' : 'border-[#2A2E42] text-[#8B90A7] hover:text-[#F0F2FF]'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <Select
            label="Language"
            value={personaLanguage}
            onChange={e => setPersonaLanguage(e.target.value)}
            options={[
              { value: 'en', label: 'English' },
              { value: 'es', label: 'Spanish' },
              { value: 'fr', label: 'French' },
            ]}
          />
          <div>
            <label className="text-xs font-medium text-[#8B90A7] block mb-1">Forbidden topics</label>
            <div className="flex flex-wrap gap-1 p-2 rounded-lg bg-[#111318] border border-[#2A2E42] min-h-[40px]">
              {forbiddenTopics.map(t => (
                <button
                  key={t}
                  onClick={() => removeTopic(t)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition-colors"
                >
                  {t} ×
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newTopic}
                onChange={e => setNewTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTopic()}
                placeholder="Add a topic and press Enter"
                className="flex-1 text-xs bg-[#111318] border border-[#2A2E42] rounded-lg px-3 py-1.5 text-[#F0F2FF] placeholder:text-[#4B5068] focus:outline-none focus:border-blue-500/50"
              />
              <Button variant="secondary" size="sm" onClick={addTopic}>Add</Button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-[#F0F2FF] mb-4">AI Budget</h3>
        <div className="space-y-4">
          <Input
            label="Monthly budget cap (USD)"
            type="number"
            value={budgetCap}
            onChange={e => setBudgetCap(Number(e.target.value))}
          />
          <div>
            <label className="text-xs font-medium text-[#8B90A7] block mb-1">Alert threshold</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="50"
                max="95"
                value={alertThreshold}
                onChange={e => setAlertThreshold(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-medium text-[#F0F2FF] w-10">{alertThreshold}%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tier 1 model"
              value={tier1Model}
              onChange={e => setTier1Model(e.target.value)}
              options={[
                { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
                { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
              ]}
            />
            <Select
              label="Tier 2 model"
              value={tier2Model}
              onChange={e => setTier2Model(e.target.value)}
              options={[
                { value: 'gpt-4o', label: 'GPT-4o' },
                { value: 'claude-sonnet', label: 'Claude Sonnet' },
              ]}
            />
          </div>
        </div>
      </Card>

      {saveError && <p className="text-xs text-red-400">{saveError}</p>}
      <div className="flex items-center gap-3">
        <Button variant="primary" loading={saving} onClick={saveAISettings}>Save AI Settings</Button>
        <SavedBadge show={saved} />
      </div>
    </div>
  );
}

const NOTIF_TYPES = [
  { key: 'token_broken', label: 'Token broken', desc: 'When a connected account token breaks' },
  { key: 'circuit_breaker', label: 'Circuit breaker tripped', desc: 'When a circuit breaker opens for an account' },
  { key: 'priority_red', label: 'Priority Red', desc: 'When a conversation needs human attention' },
  { key: 'dlq_large', label: 'DLQ > 100 messages', desc: 'When the dead letter queue is getting large' },
  { key: 'token_expiring', label: 'Token expiring', desc: '72h before a token expires' },
  { key: 'daily_summary', label: 'Daily summary', desc: 'Daily digest of key metrics' },
];

type NotifPrefs = Record<string, { inApp: boolean; email: boolean; push: boolean }>;

const STORAGE_KEY = 'flowpulse_notif_prefs';

function defaultPrefs(): NotifPrefs {
  return Object.fromEntries(
    NOTIF_TYPES.map(n => [n.key, { inApp: true, email: true, push: false }])
  );
}

function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultPrefs(), ...JSON.parse(raw) };
  } catch {}
  return defaultPrefs();
}

export function NotificationsSettings() {
  const [prefs, setPrefs] = useState<NotifPrefs>(loadPrefs);

  function toggle(key: string, channel: 'inApp' | 'email' | 'push') {
    setPrefs(prev => {
      const next = {
        ...prev,
        [key]: { ...prev[key], [channel]: !prev[key][channel] },
      };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

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
            <div key={n.key} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center py-3 border-t border-[#1E2130]">
              <div>
                <p className="text-xs font-medium text-[#F0F2FF]">{n.label}</p>
                <p className="text-[10px] text-[#4B5068]">{n.desc}</p>
              </div>
              <Toggle checked={prefs[n.key]?.inApp ?? true} onChange={() => toggle(n.key, 'inApp')} size="sm" />
              <Toggle checked={prefs[n.key]?.email ?? true} onChange={() => toggle(n.key, 'email')} size="sm" />
              <Toggle checked={prefs[n.key]?.push ?? false} onChange={() => toggle(n.key, 'push')} size="sm" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
