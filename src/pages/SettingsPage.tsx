import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Settings, Users, CreditCard, Bell, Puzzle,
  Brain, Shield, Code2, Check, Globe, Lock,
  Palette, DollarSign, Zap, Mail, Smartphone,
  Monitor, ChevronRight, Image, Clock, AlertCircle, X
} from 'lucide-react';
import { Button, Card, Input, Select, Toggle, Badge } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { TeamMember } from '../types';

const SETTINGS_NAV = [
  { to: '/settings', label: 'General', icon: Settings, exact: true, desc: 'Brand & account' },
  { to: '/settings/team', label: 'Team & Roles', icon: Users, desc: 'Members & permissions' },
  { to: '/settings/billing', label: 'Billing & Plan', icon: CreditCard, desc: 'Subscription & usage' },
  { to: '/settings/notifications', label: 'Notifications', icon: Bell, desc: 'Alert preferences' },
  { to: '/settings/integrations', label: 'Integrations', icon: Puzzle, desc: 'Connect apps' },
  { to: '/settings/ai', label: 'AI & Knowledge', icon: Brain, desc: 'Persona & budget' },
  { to: '/settings/gdpr', label: 'GDPR & Compliance', icon: Shield, desc: 'Data privacy' },
  { to: '/settings/api', label: 'API & Webhooks', icon: Code2, desc: 'Developer tools' },
];

function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400 animate-in fade-in">
      <Check className="w-3 h-3" /> Saved
    </span>
  );
}

export function SettingsLayout() {
  const location = useLocation();

  return (
    <div className="flex h-full">
      <div className="w-56 border-r border-[#1E2130] bg-[#111318] flex-shrink-0 py-4 px-3 overflow-y-auto">
        <div className="flex items-center gap-2 px-3 mb-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <Settings className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-bold text-[#F0F2FF] uppercase tracking-wider">Settings</span>
        </div>
        <div className="space-y-0.5">
          {SETTINGS_NAV.map(item => {
            const isActive = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to) && item.to !== '/settings';
            const exactActive = item.exact && location.pathname === '/settings';
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-100 group ${
                  exactActive || isActive
                    ? 'bg-blue-500/10 text-[#F0F2FF]'
                    : 'text-[#8B90A7] hover:bg-[#1A1C24] hover:text-[#F0F2FF]'
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-xs block">{item.label}</span>
                  {!(exactActive || isActive) && (
                    <span className="text-[10px] text-[#4B5068] group-hover:text-[#8B90A7] transition-colors block">{item.desc}</span>
                  )}
                </div>
              </NavLink>
            );
          })}
        </div>
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
  const [logoUrl, setLogoUrl] = useState((brand as any)?.logo_url || '');
  const [savingBrand, setSavingBrand] = useState(false);
  const [savedBrand, setSavedBrand] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [savedPassword, setSavedPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

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
    await supabase.from('brands').update({ name: brandName, timezone, logo_url: logoUrl || null }).eq('id', brand.id);
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
        <p className="text-xs text-[#8B90A7]">Manage your brand identity and account security</p>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-[#F0F2FF]">Brand Identity</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img src={logoUrl} alt="Brand logo" className="w-16 h-16 rounded-xl object-cover border border-[#2A2E42] flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0 shadow-lg shadow-blue-500/20">
                {brandName.charAt(0) || 'B'}
              </div>
            )}
            <div className="flex-1">
              <Input label="Logo URL" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" leftIcon={<Image className="w-3.5 h-3.5" />} />
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
              { value: 'America/Chicago', label: 'Central Time (CT)' },
              { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
              { value: 'Europe/London', label: 'British Time (GMT)' },
              { value: 'Europe/Berlin', label: 'Central European Time (CET)' },
              { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
              { value: 'Asia/Shanghai', label: 'China Standard Time (CST)' },
              { value: 'Australia/Sydney', label: 'Australian Eastern Time (AEST)' },
            ]}
          />
        </div>
        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-[#1E2130]">
          <Button variant="primary" loading={savingBrand} onClick={saveBrand}>Save changes</Button>
          <SavedBadge show={savedBrand} />
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-red-400" />
          <h3 className="text-sm font-semibold text-[#F0F2FF]">Security</h3>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Current password" type="password" placeholder="••••••••" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
            <Input label="New password" type="password" placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
          {passwordError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{passwordError}</p>}
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" loading={savingPassword} onClick={savePassword} disabled={!newPassword}>Change password</Button>
            <SavedBadge show={savedPassword} />
          </div>
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0A0B0F] border border-[#1E2130]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <Shield className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#F0F2FF]">Two-factor authentication</p>
                <p className="text-[10px] text-[#4B5068]">Add an extra layer of security to your account</p>
              </div>
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
    admin: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
    manager: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    agent: 'text-green-400 bg-green-400/10 border-green-400/20',
    readonly: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
  };

  useEffect(() => { if (tenant) fetchMembers(); }, [tenant?.id]);

  async function fetchMembers() {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase.from('team_members').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: true });
    setMembers(data || []);
    setLoading(false);
  }

  async function inviteMember() {
    if (!tenant || !inviteEmail.trim()) return;
    setInviting(true);
    await supabase.from('team_members').insert({ tenant_id: tenant.id, email: inviteEmail.trim(), role: inviteRole, status: 'invited', skills: [] });
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
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-[#F0F2FF]">Team Members</h3>
            <Badge variant="default" className="ml-1">{members.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <SavedBadge show={savedInvite} />
            <Button variant="primary" size="sm" onClick={() => setShowInviteForm(v => !v)}>
              {showInviteForm ? 'Cancel' : <><Users className="w-3.5 h-3.5 mr-1" /> Invite member</>}
            </Button>
          </div>
        </div>

        {showInviteForm && (
          <div className="mb-4 p-4 rounded-xl bg-[#0A0B0F] border border-blue-500/20 space-y-3">
            <p className="text-xs font-medium text-blue-400 mb-1">Invite a new team member</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Email address" type="email" placeholder="teammate@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
              <Select label="Role" value={inviteRole} onChange={e => setInviteRole(e.target.value as TeamMember['role'])}
                options={[
                  { value: 'admin', label: 'Admin — Full access' },
                  { value: 'manager', label: 'Manager — Flows & broadcasts' },
                  { value: 'agent', label: 'Agent — Inbox only' },
                  { value: 'readonly', label: 'Read-only — View only' },
                ]}
              />
            </div>
            <Button variant="primary" size="sm" loading={inviting} onClick={inviteMember} disabled={!inviteEmail.trim()}>
              Send invite
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-xs text-[#4B5068] py-8 text-center">Loading members...</p>
        ) : members.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-8 h-8 text-[#2A2E42] mx-auto mb-2" />
            <p className="text-xs text-[#4B5068]">No team members yet. Invite someone to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1E2130]">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-400/20 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                  {(m.display_name || m.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#F0F2FF]">{m.display_name || 'Invite pending'}</p>
                  <p className="text-[10px] text-[#4B5068]">{m.email}</p>
                </div>
                <select
                  value={m.role}
                  onChange={e => changeRole(m.id, e.target.value as TeamMember['role'])}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border bg-transparent cursor-pointer appearance-none ${roleColors[m.role]}`}
                >
                  <option value="admin" className="bg-[#1A1C24]">admin</option>
                  <option value="manager" className="bg-[#1A1C24]">manager</option>
                  <option value="agent" className="bg-[#1A1C24]">agent</option>
                  <option value="readonly" className="bg-[#1A1C24]">readonly</option>
                </select>
                <Badge variant={m.status === 'active' ? 'success' : 'default'}>{m.status}</Badge>
                <button className="text-[10px] text-[#4B5068] hover:text-red-400 transition-colors ml-2" onClick={() => removeMember(m.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
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

  const [contactCount, setContactCount] = useState<number>(0);
  const [accountCount, setAccountCount] = useState<number>(0);
  const [aiMessageCount, setAiMessageCount] = useState<number>(0);

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

  const planLimits: Record<string, { accounts: number | null; contacts: number | null; flows: number | null; ai: string }> = {
    FREE: { accounts: 1, contacts: 500, flows: 5, ai: 'TIER_1 only' },
    PRO: { accounts: 3, contacts: 10000, flows: 50, ai: 'TIER_1 + TIER_2' },
    LEGEND: { accounts: null, contacts: null, flows: null, ai: 'All models + custom' },
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
          { plan: 'FREE', price: '$0', period: '/mo', features: ['1 connected account', '500 contacts', '5 flows max', 'TIER_1 AI only', 'Basic analytics'] },
          { plan: 'PRO', price: '$79', period: '/mo', features: ['3 connected accounts', '10K contacts', '50 flows', 'All node types', 'AI Step + TIER_2', 'Ghost A/B testing'], popular: true },
          { plan: 'LEGEND', price: '$299', period: '/mo', features: ['Unlimited accounts', 'Unlimited contacts', 'Unlimited flows', 'Custom Code Block', 'Full AI + function calls', 'TikTok Shop', 'Priority support'] },
        ].map(p => (
          <div key={p.plan} className={`p-5 rounded-xl border relative transition-all ${
            plan === p.plan ? 'border-blue-500/40 bg-blue-500/5 shadow-lg shadow-blue-500/5 ring-1 ring-blue-500/20' : 'border-[#2A2E42] bg-[#1A1C24] hover:border-[#3A3E52]'
          } ${(p as any).popular ? 'ring-1 ring-blue-500/30' : ''}`}>
            {(p as any).popular && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold shadow-md shadow-blue-500/20">
                Most popular
              </span>
            )}
            <p className="text-[10px] font-bold text-[#8B90A7] uppercase tracking-widest mb-1">{p.plan}</p>
            <div className="flex items-baseline gap-0.5 mb-4">
              <span className="text-3xl font-bold text-[#F0F2FF]">{p.price}</span>
              <span className="text-xs text-[#4B5068]">{p.period}</span>
            </div>
            <ul className="space-y-2 mb-5">
              {p.features.map(f => (
                <li key={f} className="text-xs text-[#8B90A7] flex items-center gap-2">
                  <Check className="w-3 h-3 text-green-400 flex-shrink-0" />{f}
                </li>
              ))}
            </ul>
            {plan === p.plan
              ? <Button variant="secondary" size="sm" className="w-full" disabled>Current plan</Button>
              : <Button variant="primary" size="sm" className="w-full" loading={savingPlan === p.plan} onClick={() => changePlan(p.plan)}>
                  {['LEGEND'].includes(plan) || (plan === 'PRO' && p.plan === 'FREE') ? `Downgrade` : `Upgrade`}
                </Button>
            }
          </div>
        ))}
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-[#F0F2FF]">Usage This Month</h3>
        </div>
        <div className="space-y-4">
          {[
            { label: 'Connected accounts', used: accountCount, max: limits.accounts, icon: <Globe className="w-3.5 h-3.5 text-blue-400" /> },
            { label: 'Contacts', used: contactCount, max: limits.contacts, icon: <Users className="w-3.5 h-3.5 text-green-400" /> },
            { label: 'AI messages', used: aiMessageCount, max: null, icon: <Zap className="w-3.5 h-3.5 text-amber-400" /> },
          ].map(item => (
            <div key={item.label}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-1.5">
                  {item.icon}
                  <span className="text-[#8B90A7]">{item.label}</span>
                </div>
                <span className="text-[#F0F2FF] font-medium">
                  {item.used.toLocaleString()}{item.max ? ` / ${item.max.toLocaleString()}` : ' (unlimited)'}
                </span>
              </div>
              {item.max && item.max > 0 && (
                <div className="h-2 bg-[#0A0B0F] rounded-full border border-[#1E2130] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (item.used / item.max) > 0.9 ? 'bg-red-400' : (item.used / item.max) > 0.7 ? 'bg-amber-400' : 'bg-blue-400'
                    }`}
                    style={{ width: `${Math.min(100, (item.used / item.max) * 100)}%` }}
                  />
                </div>
              )}
              {item.max && item.max > 0 && (
                <p className="text-[10px] text-[#4B5068] mt-1">
                  {item.max - item.used > 0 ? `${(item.max - item.used).toLocaleString()} remaining` : 'Limit reached — upgrade to increase'}
                </p>
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
    if (typeof raw === 'string' && raw) { try { return JSON.parse(raw); } catch { return raw.split(',').map((s: string) => s.trim()).filter(Boolean); } }
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

  useEffect(() => {
    if (!brand) return;
    const b = brand as any;
    setPersonaName(b.persona_name || 'Aria');
    setPersonaTone(b.persona_tone || 'Friendly');
    setPersonaLanguage(b.persona_language || 'en');
    const raw = b.persona_forbidden_topics;
    if (Array.isArray(raw)) setForbiddenTopics(raw);
    else if (typeof raw === 'string' && raw) { try { setForbiddenTopics(JSON.parse(raw)); } catch { setForbiddenTopics(raw.split(',').map((s: string) => s.trim()).filter(Boolean)); } }
    if (b.ai_monthly_budget_usd != null) setBudgetCap(b.ai_monthly_budget_usd);
    if (b.ai_budget_alert_pct != null) setAlertThreshold(b.ai_budget_alert_pct);
    if (b.ai_tier1_model) setTier1Model(b.ai_tier1_model);
    if (b.ai_tier2_model) setTier2Model(b.ai_tier2_model);
  }, [brand?.id]);

  function addTopic() {
    const t = newTopic.trim();
    if (t && !forbiddenTopics.includes(t)) setForbiddenTopics(prev => [...prev, t]);
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
    const { error } = await supabase.from('brands').update({
      persona_name: personaName,
      persona_tone: personaTone,
      persona_language: personaLanguage,
      persona_forbidden_topics: forbiddenTopics,
      ai_monthly_budget_usd: budgetCap,
      ai_budget_alert_pct: alertThreshold,
      ai_tier1_model: tier1Model,
      ai_tier2_model: tier2Model,
    }).eq('id', brand.id);
    setSaving(false);
    if (error) setSaveError(error.message);
    else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#F0F2FF] mb-0.5">AI & Knowledge</h2>
        <p className="text-xs text-[#8B90A7]">Configure your AI persona, budget, and model selection</p>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-teal-400" />
          <h3 className="text-sm font-semibold text-[#F0F2FF]">Brand Persona</h3>
        </div>
        <div className="space-y-4">
          <Input label="Persona name" placeholder="Aria" value={personaName} onChange={e => setPersonaName(e.target.value)} />
          <div>
            <label className="text-xs font-medium text-[#8B90A7] block mb-2">Tone</label>
            <div className="flex gap-2">
              {['Friendly', 'Professional', 'Witty', 'Empathetic'].map(t => (
                <button
                  key={t}
                  onClick={() => setPersonaTone(t)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    personaTone === t ? 'border-teal-500/40 bg-teal-500/10 text-teal-400' : 'border-[#2A2E42] text-[#8B90A7] hover:text-[#F0F2FF] hover:border-[#3A3E52]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <Select label="Language" value={personaLanguage} onChange={e => setPersonaLanguage(e.target.value)}
            options={[
              { value: 'en', label: 'English' },
              { value: 'es', label: 'Spanish' },
              { value: 'fr', label: 'French' },
              { value: 'de', label: 'German' },
              { value: 'pt', label: 'Portuguese' },
              { value: 'ja', label: 'Japanese' },
            ]}
          />
          <div>
            <label className="text-xs font-medium text-[#8B90A7] block mb-1.5">Forbidden topics</label>
            <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-[#0A0B0F] border border-[#1E2130] min-h-[44px]">
              {forbiddenTopics.length === 0 && <span className="text-[10px] text-[#4B5068]">No forbidden topics set</span>}
              {forbiddenTopics.map(t => (
                <button key={t} onClick={() => removeTopic(t)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 text-[10px] font-medium hover:bg-red-500/25 transition-colors border border-red-500/20">
                  {t} <X className="w-2.5 h-2.5" />
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input type="text" value={newTopic} onChange={e => setNewTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTopic()}
                placeholder="Add a topic and press Enter" className="flex-1 text-xs bg-[#0A0B0F] border border-[#1E2130] rounded-lg px-3 py-2 text-[#F0F2FF] placeholder:text-[#4B5068] focus:outline-none focus:border-blue-500/50" />
              <Button variant="secondary" size="sm" onClick={addTopic}>Add</Button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-[#F0F2FF]">AI Budget</h3>
        </div>
        <div className="space-y-4">
          <Input label="Monthly budget cap (USD)" type="number" value={budgetCap} onChange={e => setBudgetCap(Number(e.target.value))} />
          <div>
            <label className="text-xs font-medium text-[#8B90A7] block mb-1.5">Alert threshold</label>
            <div className="flex items-center gap-3">
              <input type="range" min="50" max="95" value={alertThreshold} onChange={e => setAlertThreshold(Number(e.target.value))}
                className="flex-1 accent-blue-500" />
              <span className="text-sm font-bold text-[#F0F2FF] w-12 text-right">{alertThreshold}%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tier 1 model (fast)" value={tier1Model} onChange={e => setTier1Model(e.target.value)}
              options={[{ value: 'gpt-4o-mini', label: 'GPT-4o mini' }, { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' }]} />
            <Select label="Tier 2 model (smart)" value={tier2Model} onChange={e => setTier2Model(e.target.value)}
              options={[{ value: 'gpt-4o', label: 'GPT-4o' }, { value: 'claude-sonnet', label: 'Claude Sonnet' }]} />
          </div>
        </div>
      </Card>

      {saveError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{saveError}</p>}
      <div className="flex items-center gap-3">
        <Button variant="primary" loading={saving} onClick={saveAISettings}>Save AI Settings</Button>
        <SavedBadge show={saved} />
      </div>
    </div>
  );
}

const NOTIF_TYPES = [
  { key: 'token_broken', label: 'Token broken', desc: 'When a connected account token breaks', icon: <Globe className="w-3.5 h-3.5 text-red-400" /> },
  { key: 'circuit_breaker', label: 'Circuit breaker tripped', desc: 'When a circuit breaker opens for an account', icon: <Zap className="w-3.5 h-3.5 text-amber-400" /> },
  { key: 'priority_red', label: 'Priority Red', desc: 'When a conversation needs human attention', icon: <AlertCircle className="w-3.5 h-3.5 text-red-400" /> },
  { key: 'dlq_large', label: 'DLQ > 100 messages', desc: 'When the dead letter queue is getting large', icon: <Shield className="w-3.5 h-3.5 text-amber-400" /> },
  { key: 'token_expiring', label: 'Token expiring', desc: '72h before a token expires', icon: <Clock className="w-3.5 h-3.5 text-amber-400" /> },
  { key: 'daily_summary', label: 'Daily summary', desc: 'Daily digest of key metrics', icon: <Mail className="w-3.5 h-3.5 text-blue-400" /> },
];

type NotifPrefs = Record<string, { inApp: boolean; email: boolean; push: boolean }>;

const STORAGE_KEY = 'flowpulse_notif_prefs';

function defaultPrefs(): NotifPrefs {
  return Object.fromEntries(NOTIF_TYPES.map(n => [n.key, { inApp: true, email: true, push: false }]));
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
      const next = { ...prev, [key]: { ...prev[key], [channel]: !prev[key][channel] } };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#F0F2FF] mb-0.5">Notifications</h2>
        <p className="text-xs text-[#8B90A7]">Choose how you'd like to be notified about important events</p>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-[#F0F2FF]">Alert Channels</h3>
        </div>

        {/* Header */}
        <div className="grid grid-cols-[1fr_56px_56px_56px] gap-3 mb-3 px-1">
          <span className="text-[10px] font-bold text-[#4B5068] uppercase tracking-wider">Notification</span>
          <span className="text-[10px] font-bold text-[#4B5068] uppercase tracking-wider text-center"><Monitor className="w-3 h-3 mx-auto" /></span>
          <span className="text-[10px] font-bold text-[#4B5068] uppercase tracking-wider text-center"><Mail className="w-3 h-3 mx-auto" /></span>
          <span className="text-[10px] font-bold text-[#4B5068] uppercase tracking-wider text-center"><Smartphone className="w-3 h-3 mx-auto" /></span>
        </div>

        <div className="divide-y divide-[#1E2130]">
          {NOTIF_TYPES.map(n => (
            <div key={n.key} className="grid grid-cols-[1fr_56px_56px_56px] gap-3 items-center py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#0A0B0F] border border-[#1E2130] flex items-center justify-center flex-shrink-0">
                  {n.icon}
                </div>
                <div>
                  <p className="text-xs font-medium text-[#F0F2FF]">{n.label}</p>
                  <p className="text-[10px] text-[#4B5068]">{n.desc}</p>
                </div>
              </div>
              <div className="flex justify-center"><Toggle checked={prefs[n.key]?.inApp ?? true} onChange={() => toggle(n.key, 'inApp')} size="sm" /></div>
              <div className="flex justify-center"><Toggle checked={prefs[n.key]?.email ?? true} onChange={() => toggle(n.key, 'email')} size="sm" /></div>
              <div className="flex justify-center"><Toggle checked={prefs[n.key]?.push ?? false} onChange={() => toggle(n.key, 'push')} size="sm" /></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
