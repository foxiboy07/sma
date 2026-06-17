import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Settings, Users, CreditCard, Bell, Puzzle,
  Brain, Shield, Code2, Check, Globe, Lock,
  Palette, DollarSign, Zap, Mail, Smartphone,
  Monitor, ChevronRight, Image, Clock, AlertCircle, X,
  Trash2, Download, Send, RefreshCw, Star, Crown,
  Rocket, ArrowUp, MessageSquare, Volume2, VolumeX,
  ChevronDown, Info, RotateCcw, User,
} from 'lucide-react';
import { Button, Card, Input, Select, Toggle, Badge, Modal, Skeleton } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { brandsApi, settingsApi } from '../lib/api';
import { TeamMember } from '../types';

// ─── Nav ────────────────────────────────────────────────────────────────────

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

// ─── Shared helpers ──────────────────────────────────────────────────────────

function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400 animate-in fade-in">
      <Check className="w-3 h-3" /> Saved
    </span>
  );
}

/** Thin divider between card sections */
function SectionDivider() {
  return <div className="border-t border-[#1E2130] my-5" />;
}

/** Breadcrumb bar shown at the top of each settings page */
function Breadcrumb({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-5 text-xs text-[#4B5068]">
      <Settings className="w-3 h-3" />
      <ChevronRight className="w-3 h-3" />
      <span className="text-[#8B90A7] font-medium">{label}</span>
      <span className="text-[#2A2E42]">—</span>
      <span>{desc}</span>
    </div>
  );
}

/** Floating "back to top" button */
function BackToTopButton({ containerRef }: { containerRef: React.RefObject<HTMLDivElement> }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setVisible(el.scrollTop > 300);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [containerRef]);

  if (!visible) return null;
  return (
    <button
      onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-6 z-40 w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center transition-all duration-200 hover:scale-110"
      title="Back to top"
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  );
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export function SettingsLayout() {
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex h-full">
      {/* ── Sidebar nav (desktop) / horizontal tabs (mobile) ── */}
      <div className="
        /* mobile: horizontal scrollable tab bar */
        flex-shrink-0
        md:w-56 md:border-r md:border-[#1E2130] md:bg-[#111318] md:py-4 md:px-3 md:overflow-y-auto md:flex-col
        /* mobile overrides */
        w-full border-b border-[#1E2130] bg-[#111318] overflow-x-auto
        flex flex-row md:flex items-start
      ">
        {/* Title — hide on mobile */}
        <div className="hidden md:flex items-center gap-2 px-3 mb-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <Settings className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-bold text-[#F0F2FF] uppercase tracking-wider">Settings</span>
        </div>

        {/* Nav items */}
        <div className="flex flex-row md:flex-col gap-0.5 md:space-y-0.5 px-2 md:px-0 py-2 md:py-0 w-max md:w-auto">
          {SETTINGS_NAV.map(item => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to) && item.to !== '/settings';
            const exactActive = item.exact && location.pathname === '/settings';
            const active = exactActive || isActive;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-100 group whitespace-nowrap
                  ${active ? 'bg-blue-500/10 text-[#F0F2FF]' : 'text-[#8B90A7] hover:bg-[#1A1C24] hover:text-[#F0F2FF]'}`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-xs block">{item.label}</span>
                  {!active && (
                    <span className="hidden md:block text-[10px] text-[#4B5068] group-hover:text-[#8B90A7] transition-colors">
                      {item.desc}
                    </span>
                  )}
                </div>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* ── Main content ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8">
        <Outlet />
        <BackToTopButton containerRef={scrollRef as React.RefObject<HTMLDivElement>} />
      </div>
    </div>
  );
}

// ─── General ─────────────────────────────────────────────────────────────────

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

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

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
    await brandsApi.update(brand.id, { name: brandName, timezone, logoUrl: logoUrl || null });
    setSavingBrand(false);
    setSavedBrand(true);
    setTimeout(() => setSavedBrand(false), 3000);
  }

  async function savePassword() {
    if (!newPassword) return;
    setSavingPassword(true);
    setSavedPassword(false);
    setPasswordError('');
    // Password update is handled server-side; stub until endpoint is wired
    setSavingPassword(false);
    if (false) {
      setPasswordError('');
    } else {
      setSavedPassword(true);
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setSavedPassword(false), 3000);
    }
  }

  function exportAllData() {
    const payload = {
      exported_at: new Date().toISOString(),
      brand: {
        id: brand?.id,
        name: brand?.name,
        timezone: brand?.timezone,
        logo_url: (brand as any)?.logo_url,
        persona_name: (brand as any)?.persona_name,
        persona_tone: (brand as any)?.persona_tone,
        persona_language: (brand as any)?.persona_language,
      },
      tenant: {
        id: tenant?.id,
        name: tenant?.name,
        plan: tenant?.plan,
        created_at: (tenant as any)?.created_at,
      },
      notification_prefs: (() => {
        try { return JSON.parse(localStorage.getItem('flowpulse_notif_prefs') || '{}'); } catch { return {}; }
      })(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowpulse-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canConfirmDelete = deleteConfirmText === 'DELETE';

  return (
    <div className="max-w-lg space-y-6">
      <Breadcrumb label="General" desc="Brand identity & account security" />
      <div>
        <h2 className="text-lg font-bold text-[#F0F2FF] mb-0.5">General</h2>
        <p className="text-xs text-[#8B90A7]">Manage your brand identity and account security</p>
      </div>

      {/* Brand Identity */}
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
            value={timezone as string}
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

      {/* Security */}
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

          <SectionDivider />

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

      {/* Danger Zone */}
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
        </div>
        <p className="text-xs text-[#8B90A7]">These actions are irreversible. Please proceed with caution.</p>

        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0A0B0F] border border-red-500/15">
          <div>
            <p className="text-xs font-medium text-[#F0F2FF]">Export all data</p>
            <p className="text-[10px] text-[#4B5068]">Download a JSON copy of your account and brand data</p>
          </div>
          <Button variant="secondary" size="sm" onClick={exportAllData}>
            <Download className="w-3.5 h-3.5 mr-1" /> Export
          </Button>
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0A0B0F] border border-red-500/15">
          <div>
            <p className="text-xs font-medium text-red-400">Delete account</p>
            <p className="text-[10px] text-[#4B5068]">Permanently delete your brand and all associated data</p>
          </div>
          <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
          </Button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
        title="Delete Account"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}>Cancel</Button>
            <Button variant="danger" size="sm" disabled={!canConfirmDelete}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Permanently delete
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-[#F0F2FF] leading-relaxed">
              This will permanently delete your brand <strong className="text-red-400">{brandName}</strong>, all contacts, flows, conversations, and connected accounts. This action <strong>cannot be undone</strong>.
            </div>
          </div>
          <div>
            <label className="text-xs text-[#8B90A7] block mb-1.5">
              Type <strong className="text-red-400">DELETE</strong> to confirm
            </label>
            <Input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className={deleteConfirmText === 'DELETE' ? 'border-red-500' : ''}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Team ─────────────────────────────────────────────────────────────────────

/** Expanded member row — shows avatar URL field and skills inline */
function MemberRow({
  member,
  onChangeRole,
  onRemove,
  onResendInvite,
  onUpdateMeta,
}: {
  member: TeamMember;
  onChangeRole: (id: string, role: TeamMember['role']) => void;
  onRemove: (id: string) => void;
  onResendInvite: (id: string) => void;
  onUpdateMeta: (id: string, patch: Partial<TeamMember>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(member.avatar_url || '');
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>(member.skills || []);
  const [saving, setSaving] = useState(false);

  const roleColors: Record<string, string> = {
    admin: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
    manager: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    agent: 'text-green-400 bg-green-400/10 border-green-400/20',
    readonly: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
  };

  function addSkill() {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) setSkills(prev => [...prev, s]);
    setSkillInput('');
  }

  async function saveMeta() {
    setSaving(true);
    await settingsApi.team.updateMeta(member.id, { avatar_url: avatarUrl || null, skills });
    onUpdateMeta(member.id, { avatar_url: avatarUrl || undefined, skills });
    setSaving(false);
  }

  const avatar = avatarUrl || member.avatar_url;

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        {avatar ? (
          <img src={avatar} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-[#2A2E42]" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-400/20 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
            {(member.display_name || member.email).charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[#F0F2FF]">{member.display_name || 'Invite pending'}</p>
          <p className="text-[10px] text-[#4B5068]">{member.email}</p>
          {/* Skills badges */}
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {skills.map(s => (
                <span key={s} className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[9px] font-medium border border-blue-500/20">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        <select
          value={member.role}
          onChange={e => onChangeRole(member.id, e.target.value as TeamMember['role'])}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border bg-transparent cursor-pointer appearance-none ${roleColors[member.role]}`}
        >
          <option value="admin" className="bg-[#1A1C24]">admin</option>
          <option value="manager" className="bg-[#1A1C24]">manager</option>
          <option value="agent" className="bg-[#1A1C24]">agent</option>
          <option value="readonly" className="bg-[#1A1C24]">readonly</option>
        </select>

        <Badge variant={member.status === 'active' ? 'success' : 'default'}>{member.status}</Badge>

        {member.status === 'invited' && (
          <button
            className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
            onClick={() => onResendInvite(member.id)}
            title="Resend invite email"
          >
            <Send className="w-3 h-3" />
          </button>
        )}

        <button
          className="text-[10px] text-[#4B5068] hover:text-[#F0F2FF] transition-colors"
          onClick={() => setExpanded(v => !v)}
          title="Expand"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>

        <button className="text-[10px] text-[#4B5068] hover:text-red-400 transition-colors" onClick={() => onRemove(member.id)}>
          Remove
        </button>
      </div>

      {/* Expandable detail */}
      {expanded && (
        <div className="mt-3 ml-12 space-y-3 p-3.5 rounded-xl bg-[#0A0B0F] border border-[#1E2130]">
          <Input
            label="Avatar URL"
            value={avatarUrl}
            onChange={e => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.png"
            leftIcon={<User className="w-3.5 h-3.5" />}
          />

          <div>
            <label className="text-xs font-medium text-[#8B90A7] block mb-1.5">Skills</label>
            <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg bg-[#111318] border border-[#1E2130] min-h-[36px] mb-2">
              {skills.length === 0 && <span className="text-[10px] text-[#4B5068]">No skills added</span>}
              {skills.map(s => (
                <button
                  key={s}
                  onClick={() => setSkills(prev => prev.filter(x => x !== s))}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-medium border border-blue-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors"
                >
                  {s} <X className="w-2.5 h-2.5" />
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSkill()}
                placeholder="e.g. Sales, Support, Spanish…"
                className="flex-1 text-xs bg-[#0A0B0F] border border-[#1E2130] rounded-lg px-3 py-2 text-[#F0F2FF] placeholder:text-[#4B5068] focus:outline-none focus:border-blue-500/50"
              />
              <Button variant="secondary" size="sm" onClick={addSkill}>Add</Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="primary" size="sm" loading={saving} onClick={saveMeta}>Save member</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Better loading skeleton for team members */
function TeamSkeleton() {
  return (
    <div className="divide-y divide-[#1E2130]">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="w-9 h-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-2.5 w-40 rounded" />
          </div>
          <Skeleton className="h-6 w-16 rounded-lg" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
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
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => { if (tenant) fetchMembers(); }, [tenant?.id]);

  async function fetchMembers() {
    if (!tenant) return;
    setLoading(true);
    const data = await settingsApi.team.list(tenant.id);
    setMembers(data || []);
    setLoading(false);
  }

  async function inviteMember() {
    if (!tenant || !inviteEmail.trim()) return;
    setInviting(true);
    await settingsApi.team.invite(tenant.id, inviteEmail.trim(), inviteRole);
    setInviteEmail('');
    setInviteRole('agent');
    setShowInviteForm(false);
    setInviting(false);
    setSavedInvite(true);
    setTimeout(() => setSavedInvite(false), 3000);
    await fetchMembers();
  }

  async function removeMember(id: string) {
    await settingsApi.team.remove(tenant!.id, id);
    setMembers(prev => prev.filter(m => m.id !== id));
  }

  async function changeRole(id: string, role: TeamMember['role']) {
    // Role updates will be supported in a future API iteration
    setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m));
  }

  async function resendInvite(id: string) {
    setResendingId(id);
    // Simulate resend — in production call your invite edge function
    await new Promise(r => setTimeout(r, 800));
    setResendingId(null);
  }

  function updateMeta(id: string, patch: Partial<TeamMember>) {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Breadcrumb label="Team & Roles" desc="Members & permissions" />
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
            {resendingId && <span className="text-[10px] text-blue-400 animate-pulse">Sending invite…</span>}
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
          <TeamSkeleton />
        ) : members.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-8 h-8 text-[#2A2E42] mx-auto mb-2" />
            <p className="text-xs text-[#4B5068]">No team members yet. Invite someone to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1E2130]">
            {members.map(m => (
              <MemberRow
                key={m.id}
                member={m}
                onChangeRole={changeRole}
                onRemove={removeMember}
                onResendInvite={resendInvite}
                onUpdateMeta={updateMeta}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Billing ──────────────────────────────────────────────────────────────────

const PLAN_ICONS: Record<string, React.ReactNode> = {
  FREE: <Star className="w-5 h-5 text-gray-400" />,
  PRO: <Rocket className="w-5 h-5 text-blue-400" />,
  LEGEND: <Crown className="w-5 h-5 text-amber-400" />,
};

/** Derive current period start (1st of current month) and end */
function useBillingPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return { start: fmt(start), end: fmt(end), nextInvoice: fmt(next) };
}

export function BillingSettings() {
  const { tenant } = useAuth();
  const [plan, setPlan] = useState(tenant?.plan || 'FREE');
  const [savingPlan, setSavingPlan] = useState<string | null>(null);
  const [savedPlan, setSavedPlan] = useState(false);

  const [contactCount, setContactCount] = useState<number>(0);
  const [accountCount, setAccountCount] = useState<number>(0);
  const [aiMessageCount, setAiMessageCount] = useState<number>(0);

  const planSectionRef = useRef<HTMLDivElement>(null);
  const { start, end, nextInvoice } = useBillingPeriod();

  useEffect(() => {
    if (!tenant) return;
    setPlan(tenant.plan);
    fetchUsage();
  }, [tenant?.id]);

  async function fetchUsage() {
    // Usage counts will be populated from the dashboard API in a future iteration
    setContactCount(0);
    setAccountCount(0);
    setAiMessageCount(0);
  }

  async function changePlan(newPlan: string) {
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
      <Breadcrumb label="Billing & Plan" desc="Subscription & usage" />
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#F0F2FF] mb-0.5">Billing & Plan</h2>
          <p className="text-xs text-[#8B90A7]">Manage your subscription and billing information</p>
        </div>
        <SavedBadge show={savedPlan} />
      </div>

      {/* Current period / next invoice */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-[#F0F2FF]">Billing Period</h3>
          <button
            onClick={() => planSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="ml-auto text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            Compare plans <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Period start', value: start },
            { label: 'Period end', value: end },
            { label: 'Next invoice', value: nextInvoice },
          ].map(item => (
            <div key={item.label} className="p-3 rounded-lg bg-[#0A0B0F] border border-[#1E2130]">
              <p className="text-[10px] text-[#4B5068] mb-1">{item.label}</p>
              <p className="text-xs font-semibold text-[#F0F2FF]">{item.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Plan cards */}
      <div ref={planSectionRef} className="grid grid-cols-3 gap-4">
        {([
          {
            plan: 'FREE',
            price: '$0',
            period: '/mo',
            color: 'from-gray-500/10 to-gray-500/5',
            borderActive: 'border-gray-400/40',
            accentText: 'text-gray-400',
            features: ['1 connected account', '500 contacts', '5 flows max', 'TIER_1 AI only', 'Basic analytics'],
          },
          {
            plan: 'PRO',
            price: '$79',
            period: '/mo',
            color: 'from-blue-500/10 to-cyan-500/5',
            borderActive: 'border-blue-500/50',
            accentText: 'text-blue-400',
            features: ['3 connected accounts', '10K contacts', '50 flows', 'All node types', 'AI Step + TIER_2', 'Ghost A/B testing'],
            popular: true,
          },
          {
            plan: 'LEGEND',
            price: '$299',
            period: '/mo',
            color: 'from-amber-500/10 to-amber-400/5',
            borderActive: 'border-amber-400/50',
            accentText: 'text-amber-400',
            features: ['Unlimited accounts', 'Unlimited contacts', 'Unlimited flows', 'Custom Code Block', 'Full AI + function calls', 'TikTok Shop', 'Priority support'],
          },
        ] as const).map(p => {
          const isCurrentPlan = plan === p.plan;
          return (
            <div
              key={p.plan}
              className={`p-5 rounded-xl border relative transition-all ${
                isCurrentPlan
                  ? `${p.borderActive} bg-gradient-to-b ${p.color} shadow-lg ring-1 ring-blue-500/10`
                  : 'border-[#2A2E42] bg-[#1A1C24] hover:border-[#3A3E52]'
              }`}
            >
              {(p as any).popular && !isCurrentPlan && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold shadow-md shadow-blue-500/20">
                  Most popular
                </span>
              )}
              {isCurrentPlan && (
                <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1A1C24] border ${p.borderActive} ${p.accentText}`}>
                  Current plan
                </span>
              )}

              {/* Icon + name */}
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  p.plan === 'FREE' ? 'bg-gray-500/15' : p.plan === 'PRO' ? 'bg-blue-500/15' : 'bg-amber-500/15'
                }`}>
                  {PLAN_ICONS[p.plan]}
                </div>
                <p className={`text-xs font-bold uppercase tracking-widest ${p.accentText}`}>{p.plan}</p>
              </div>

              <div className="flex items-baseline gap-0.5 mb-4">
                <span className="text-3xl font-bold text-[#F0F2FF]">{p.price}</span>
                <span className="text-xs text-[#4B5068]">{p.period}</span>
              </div>
              <ul className="space-y-2 mb-5">
                {p.features.map(f => (
                  <li key={f} className="text-xs text-[#8B90A7] flex items-center gap-2">
                    <Check className={`w-3 h-3 flex-shrink-0 ${p.accentText}`} />{f}
                  </li>
                ))}
              </ul>
              {isCurrentPlan
                ? <Button variant="secondary" size="sm" className="w-full" disabled>Active</Button>
                : <Button variant="primary" size="sm" className="w-full" loading={savingPlan === p.plan} onClick={() => changePlan(p.plan)}>
                    {(['LEGEND'].includes(plan) || (plan === 'PRO' && p.plan === 'FREE')) ? 'Downgrade' : 'Upgrade'}
                  </Button>
              }
            </div>
          );
        })}
      </div>

      {/* Usage */}
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

// ─── AI Settings ──────────────────────────────────────────────────────────────

const AI_DEFAULTS = {
  personaName: 'Aria',
  personaTone: 'Friendly',
  personaLanguage: 'en',
  forbiddenTopics: ['Politics', 'Competitors'],
  budgetCap: 200,
  alertThreshold: 80,
  tier1Model: 'gpt-4o-mini',
  tier2Model: 'gpt-4o',
};

/** Simulated AI chat preview */
function PersonaTestChat({ personaName, tone }: { personaName: string; tone: string }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: `Hi there! I'm ${personaName || 'Aria'}. How can I help you today?` },
  ]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const toneResponses: Record<string, string[]> = {
    Friendly: ["That's a great question! Let me help you with that.", "Absolutely! I'd love to assist.", "Sure thing! Here's what I know…"],
    Professional: ["Thank you for your inquiry. Allow me to address that.", "Certainly. Here is the relevant information.", "I can assist you with that matter."],
    Witty: ["Ooh, good one! Let me think... 🤔", "Ha! Well, as it turns out…", "Great minds think alike — here's the deal:"],
    Empathetic: ["I completely understand. Let me help.", "That makes total sense — I'm here for you.", "Of course, I hear you. Here's what we can do:"],
  };

  function sendMessage() {
    const text = input.trim();
    if (!text) return;
    const responses = toneResponses[tone] || toneResponses['Friendly'];
    const aiReply = responses[Math.floor(Math.random() * responses.length)];
    setMessages(prev => [
      ...prev,
      { role: 'user', text },
      { role: 'ai', text: aiReply },
    ]);
    setInput('');
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  return (
    <div className="rounded-xl bg-[#0A0B0F] border border-[#1E2130] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1E2130] bg-[#111318]">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-[9px] font-bold text-white">
          {(personaName || 'A').charAt(0)}
        </div>
        <span className="text-xs font-medium text-[#F0F2FF]">{personaName || 'Aria'}</span>
        <Badge variant="success" className="ml-auto text-[9px] py-0">Live preview</Badge>
      </div>

      <div className="h-40 overflow-y-auto p-3 space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs ${
              m.role === 'user'
                ? 'bg-blue-500 text-white rounded-br-sm'
                : 'bg-[#1A1C24] text-[#F0F2FF] rounded-bl-sm border border-[#2A2E42]'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 p-3 border-t border-[#1E2130]">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Type a test message…"
          className="flex-1 text-xs bg-[#1A1C24] border border-[#2A2E42] rounded-lg px-3 py-2 text-[#F0F2FF] placeholder:text-[#4B5068] focus:outline-none focus:border-blue-500/50"
        />
        <Button variant="primary" size="sm" onClick={sendMessage} disabled={!input.trim()}>
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function AISettings() {
  const { brand } = useAuth();

  const [personaName, setPersonaName] = useState((brand as any)?.persona_name || AI_DEFAULTS.personaName);
  const [personaTone, setPersonaTone] = useState((brand as any)?.persona_tone || AI_DEFAULTS.personaTone);
  const [personaLanguage, setPersonaLanguage] = useState((brand as any)?.persona_language || AI_DEFAULTS.personaLanguage);
  const [forbiddenTopics, setForbiddenTopics] = useState<string[]>(() => {
    const raw = (brand as any)?.persona_forbidden_topics;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw) { try { return JSON.parse(raw); } catch { return raw.split(',').map((s: string) => s.trim()).filter(Boolean); } }
    return AI_DEFAULTS.forbiddenTopics;
  });
  const [newTopic, setNewTopic] = useState('');

  const [budgetCap, setBudgetCap] = useState<number>((brand as any)?.ai_monthly_budget_usd ?? AI_DEFAULTS.budgetCap);
  const [alertThreshold, setAlertThreshold] = useState<number>((brand as any)?.ai_budget_alert_pct ?? AI_DEFAULTS.alertThreshold);
  const [tier1Model, setTier1Model] = useState((brand as any)?.ai_tier1_model || AI_DEFAULTS.tier1Model);
  const [tier2Model, setTier2Model] = useState((brand as any)?.ai_tier2_model || AI_DEFAULTS.tier2Model);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    if (!brand) return;
    const b = brand as any;
    setPersonaName(b.persona_name || AI_DEFAULTS.personaName);
    setPersonaTone(b.persona_tone || AI_DEFAULTS.personaTone);
    setPersonaLanguage(b.persona_language || AI_DEFAULTS.personaLanguage);
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

  function resetToDefaults() {
    setPersonaName(AI_DEFAULTS.personaName);
    setPersonaTone(AI_DEFAULTS.personaTone);
    setPersonaLanguage(AI_DEFAULTS.personaLanguage);
    setForbiddenTopics([...AI_DEFAULTS.forbiddenTopics]);
    setBudgetCap(AI_DEFAULTS.budgetCap);
    setAlertThreshold(AI_DEFAULTS.alertThreshold);
    setTier1Model(AI_DEFAULTS.tier1Model);
    setTier2Model(AI_DEFAULTS.tier2Model);
    setShowResetModal(false);
  }

  async function saveAISettings() {
    if (!brand) return;
    setSaving(true);
    setSaved(false);
    setSaveError('');
    try {
      await brandsApi.update(brand.id, {
        personaName,
        personaTone,
        personaLanguage,
        forbiddenTopics,
        aiMonthlyCapUsd: budgetCap,
        // Note: alertThreshold may need to be stored differently or in a separate setting
        aiTier1Model: tier1Model,
        aiTier2Model: tier2Model,
      });
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      setSaving(false);
      setSaveError(error instanceof Error ? error.message : 'Failed to save settings');
    }
  }

  const LANGUAGE_LABELS: Record<string, string> = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', ja: 'Japanese' };

  return (
    <div className="max-w-lg space-y-6">
      <Breadcrumb label="AI & Knowledge" desc="Persona & budget" />
      <div>
        <h2 className="text-lg font-bold text-[#F0F2FF] mb-0.5">AI & Knowledge</h2>
        <p className="text-xs text-[#8B90A7]">Configure your AI persona, budget, and model selection</p>
      </div>

      {/* Persona card */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-semibold text-[#F0F2FF]">Brand Persona</h3>
          </div>
          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-1 text-[10px] text-[#8B90A7] hover:text-[#F0F2FF] transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Reset to defaults
          </button>
        </div>
        <div className="space-y-4">
          <Input label="Persona name" placeholder="Aria" value={personaName} onChange={e => setPersonaName(e.target.value)} />
          <div>
            <label className="text-xs font-medium text-[#8B90A7] block mb-2">Tone</label>
            <div className="flex gap-2">
              {(['Friendly', 'Professional', 'Witty', 'Empathetic'] as const).map(t => (
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

      {/* Persona Preview card */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-[#F0F2FF]">Persona Preview</h3>
        </div>
        <div className="flex gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500/30 to-cyan-400/20 flex items-center justify-center text-2xl font-bold text-teal-400 flex-shrink-0 border border-teal-500/20">
            {(personaName || 'A').charAt(0)}
          </div>
          <div className="flex-1 space-y-1.5">
            <p className="text-sm font-semibold text-[#F0F2FF]">{personaName || 'Aria'}</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-400 text-[10px] border border-teal-500/20">{personaTone}</span>
              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] border border-blue-500/20">{LANGUAGE_LABELS[personaLanguage] || personaLanguage}</span>
              {forbiddenTopics.slice(0, 2).map(t => (
                <span key={t} className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 text-[10px] border border-red-500/20">no: {t}</span>
              ))}
              {forbiddenTopics.length > 2 && (
                <span className="px-2 py-0.5 rounded-md bg-[#0A0B0F] text-[#4B5068] text-[10px] border border-[#1E2130]">+{forbiddenTopics.length - 2} more</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Test Persona */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-[#F0F2FF]">Test Persona</h3>
          <span className="text-[10px] text-[#4B5068] ml-1">Chat with your AI to preview tone & personality</span>
        </div>
        <PersonaTestChat personaName={personaName} tone={personaTone} />
      </Card>

      {/* Budget */}
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

      {/* Reset confirmation modal */}
      <Modal
        open={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset AI Settings to Defaults"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowResetModal(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={resetToDefaults}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#8B90A7]">
          This will restore all AI persona and budget settings to their factory defaults. Your saved values in Supabase won't change until you click <strong className="text-[#F0F2FF]">Save AI Settings</strong>.
        </p>
      </Modal>
    </div>
  );
}

// ─── Notifications ────────────────────────────────────────────────────────────

const NOTIF_TYPES = [
  { key: 'token_broken', label: 'Token broken', desc: 'When a connected account token breaks', icon: <Globe className="w-3.5 h-3.5 text-red-400" /> },
  { key: 'circuit_breaker', label: 'Circuit breaker tripped', desc: 'When a circuit breaker opens for an account', icon: <Zap className="w-3.5 h-3.5 text-amber-400" /> },
  { key: 'priority_red', label: 'Priority Red', desc: 'When a conversation needs human attention', icon: <AlertCircle className="w-3.5 h-3.5 text-red-400" /> },
  { key: 'dlq_large', label: 'DLQ > 100 messages', desc: 'When the dead letter queue is getting large', icon: <Shield className="w-3.5 h-3.5 text-amber-400" /> },
  { key: 'token_expiring', label: 'Token expiring', desc: '72h before a token expires', icon: <Clock className="w-3.5 h-3.5 text-amber-400" /> },
  { key: 'daily_summary', label: 'Daily summary', desc: 'Daily digest of key metrics', icon: <Mail className="w-3.5 h-3.5 text-blue-400" /> },
];

type NotifPrefs = Record<string, { inApp: boolean; email: boolean; push: boolean }>;

interface GlobalNotifPrefs {
  emailDigest: 'none' | 'daily' | 'weekly';
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  soundEnabled: boolean;
}

const STORAGE_KEY = 'flowpulse_notif_prefs';
const GLOBAL_STORAGE_KEY = 'flowpulse_notif_global';

function defaultPrefs(): NotifPrefs {
  return Object.fromEntries(NOTIF_TYPES.map(n => [n.key, { inApp: true, email: true, push: false }]));
}

function defaultGlobalPrefs(): GlobalNotifPrefs {
  return {
    emailDigest: 'daily',
    quietHoursEnabled: false,
    quietStart: '22:00',
    quietEnd: '08:00',
    soundEnabled: true,
  };
}

function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultPrefs(), ...JSON.parse(raw) };
  } catch {}
  return defaultPrefs();
}

function loadGlobalPrefs(): GlobalNotifPrefs {
  try {
    const raw = localStorage.getItem(GLOBAL_STORAGE_KEY);
    if (raw) return { ...defaultGlobalPrefs(), ...JSON.parse(raw) };
  } catch {}
  return defaultGlobalPrefs();
}

export function NotificationsSettings() {
  const [prefs, setPrefs] = useState<NotifPrefs>(loadPrefs);
  const [global, setGlobal] = useState<GlobalNotifPrefs>(loadGlobalPrefs);
  const [savedGlobal, setSavedGlobal] = useState(false);

  function toggle(key: string, channel: 'inApp' | 'email' | 'push') {
    setPrefs(prev => {
      const next = { ...prev, [key]: { ...prev[key], [channel]: !prev[key][channel] } };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function patchGlobal<K extends keyof GlobalNotifPrefs>(key: K, value: GlobalNotifPrefs[K]) {
    setGlobal(prev => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    setSavedGlobal(true);
    setTimeout(() => setSavedGlobal(false), 2000);
  }

  return (
    <div className="max-w-lg space-y-6">
      <Breadcrumb label="Notifications" desc="Alert preferences" />
      <div>
        <h2 className="text-lg font-bold text-[#F0F2FF] mb-0.5">Notifications</h2>
        <p className="text-xs text-[#8B90A7]">Choose how you'd like to be notified about important events</p>
      </div>

      {/* Global preferences */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-[#F0F2FF]">Global Preferences</h3>
          </div>
          <SavedBadge show={savedGlobal} />
        </div>

        <div className="space-y-4">
          {/* Email Digest */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#F0F2FF]">Email Digest</p>
              <p className="text-[10px] text-[#4B5068]">Receive a summary of activity by email</p>
            </div>
            <div className="flex gap-1">
              {(['none', 'daily', 'weekly'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => patchGlobal('emailDigest', opt)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border capitalize transition-all ${
                    global.emailDigest === opt
                      ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
                      : 'border-[#2A2E42] text-[#8B90A7] hover:text-[#F0F2FF]'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <SectionDivider />

          {/* Sound toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0A0B0F] border border-[#1E2130]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                {global.soundEnabled
                  ? <Volume2 className="w-4 h-4 text-blue-400" />
                  : <VolumeX className="w-4 h-4 text-[#4B5068]" />}
              </div>
              <div>
                <p className="text-xs font-medium text-[#F0F2FF]">In-app notification sound</p>
                <p className="text-[10px] text-[#4B5068]">Play a sound when notifications arrive</p>
              </div>
            </div>
            <Toggle checked={global.soundEnabled} onChange={v => patchGlobal('soundEnabled', v)} />
          </div>

          {/* Quiet hours */}
          <div className="p-3.5 rounded-xl bg-[#0A0B0F] border border-[#1E2130] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[#F0F2FF]">Quiet Hours</p>
                  <p className="text-[10px] text-[#4B5068]">Suppress non-critical notifications during these hours</p>
                </div>
              </div>
              <Toggle checked={global.quietHoursEnabled} onChange={v => patchGlobal('quietHoursEnabled', v)} />
            </div>

            {global.quietHoursEnabled && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] font-medium text-[#8B90A7] block mb-1">Start time</label>
                  <input
                    type="time"
                    value={global.quietStart}
                    onChange={e => patchGlobal('quietStart', e.target.value)}
                    className="h-9 w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-[#F0F2FF] px-3 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-[#8B90A7] block mb-1">End time</label>
                  <input
                    type="time"
                    value={global.quietEnd}
                    onChange={e => patchGlobal('quietEnd', e.target.value)}
                    className="h-9 w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-[#F0F2FF] px-3 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Per-event alert channels */}
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
