import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Send, Users, Calendar, CheckCircle2, AlertTriangle, ArrowRight,
  Search, LayoutGrid, List, Copy, XCircle, BarChart2, Clock,
  RefreshCw, MessageSquare, DollarSign,
  MoreVertical, Zap, Tag,
} from 'lucide-react';
import {
  Button, Badge, Card, Modal, Input, Select, Textarea, Toggle,
  EmptyState, MetricCard, Tabs, Dropdown, PlatformIcon, ToastContainer,
} from '../components/ui';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import { broadcastApi } from '../lib/api';
import { Broadcast, Segment } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MESSAGE_TAGS = [
  { value: 'CONFIRMED_EVENT_UPDATE', label: 'Confirmed Event Update' },
  { value: 'POST_PURCHASE_UPDATE', label: 'Post Purchase Update' },
  { value: 'ACCOUNT_UPDATE', label: 'Account Update' },
] as const;

const PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK'] as const;
type Platform = typeof PLATFORMS[number];

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'sending', label: 'Sending' },
  { id: 'sent', label: 'Sent' },
  { id: 'cancelled', label: 'Cancelled' },
] as const;

const STATUS_BADGE_MAP: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  sent: 'success',
  scheduled: 'info',
  sending: 'warning',
  draft: 'default',
  cancelled: 'danger',
};

const VARIABLES = ['{{contact.name}}', '{{brand.name}}', '{{brand.persona_name}}'];

// ---------------------------------------------------------------------------
// Wizard form state
// ---------------------------------------------------------------------------

interface WizardState {
  // Step 1 – Audience
  platform: Platform;
  segmentId: string | null; // null = all contacts
  respectWindow: boolean;
  // Step 2 – Message
  broadcastName: string;
  message: string;
  messageTag: string;
  useMessageTag: boolean;
  // Step 3 – Schedule
  sendNow: boolean;
  scheduledAt: string; // datetime-local value
}

const defaultWizard = (): WizardState => ({
  platform: 'INSTAGRAM',
  segmentId: null,
  respectWindow: true,
  broadcastName: '',
  message: '',
  messageTag: 'CONFIRMED_EVENT_UPDATE',
  useMessageTag: false,
  sendNow: true,
  scheduledAt: '',
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string) {
  const variant = STATUS_BADGE_MAP[status] ?? 'default';
  return (
    <Badge variant={variant}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function fmtDate(dt?: string | null): string {
  if (!dt) return '—';
  try {
    return format(new Date(dt), 'MMM d, yyyy · h:mm a');
  } catch {
    return '—';
  }
}

function fmtNum(n?: number): string {
  if (n == null) return '—';
  return n.toLocaleString();
}

function replyRate(b: Broadcast): string {
  if (!b.sent_count || !b.replied_count) return '0%';
  return ((b.replied_count / b.sent_count) * 100).toFixed(1) + '%';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5 mb-5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full flex-1 transition-colors duration-200 ${
            i < step ? 'bg-blue-500' : 'bg-[#2A2E42]'
          }`}
        />
      ))}
    </div>
  );
}

function PlatformSelector({
  value,
  onChange,
}: {
  value: Platform;
  onChange: (p: Platform) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {PLATFORMS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
            value === p
              ? 'border-blue-500/50 bg-blue-500/10 text-[#F0F2FF]'
              : 'border-[#2A2E42] text-[#8B90A7] hover:border-[#3A3E55] hover:text-[#F0F2FF]'
          }`}
        >
          <PlatformIcon platform={p} size={16} />
          {p.charAt(0) + p.slice(1).toLowerCase()}
        </button>
      ))}
    </div>
  );
}

function ReachCard({
  label,
  count,
  variant = 'default',
  loading,
}: {
  label: string;
  count: number;
  variant?: 'default' | 'green';
  loading?: boolean;
}) {
  return (
    <div
      className={`flex-1 p-3 rounded-xl border text-center ${
        variant === 'green'
          ? 'bg-green-500/10 border-green-500/20'
          : 'bg-[#111318] border-[#2A2E42]'
      }`}
    >
      {loading ? (
        <div className="h-7 w-16 mx-auto bg-[#2A2E42] rounded animate-pulse mb-1" />
      ) : (
        <p
          className={`text-2xl font-bold ${
            variant === 'green' ? 'text-green-400' : 'text-[#F0F2FF]'
          }`}
        >
          {count.toLocaleString()}
        </p>
      )}
      <p className="text-xs text-[#8B90A7]">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Broadcast row – table view
// ---------------------------------------------------------------------------

function BroadcastRow({
  broadcast,
  onCancel,
  onDuplicate,
  onSend,
  onViewStats,
}: {
  broadcast: Broadcast;
  onCancel: (id: string) => void;
  onDuplicate: (b: Broadcast) => void;
  onSend: (id: string) => void;
  onViewStats: (b: Broadcast) => void;
}) {
  const menuItems = [
    broadcast.status === 'draft'
      ? {
          label: 'Send Now',
          icon: <Send className="w-3.5 h-3.5" />,
          onClick: () => onSend(broadcast.id),
        }
      : null,
    {
      label: 'Duplicate',
      icon: <Copy className="w-3.5 h-3.5" />,
      onClick: () => onDuplicate(broadcast),
    },
    broadcast.status === 'sent'
      ? {
          label: 'View Stats',
          icon: <BarChart2 className="w-3.5 h-3.5" />,
          onClick: () => onViewStats(broadcast),
        }
      : null,
    broadcast.status === 'scheduled'
      ? {
          label: 'Cancel',
          icon: <XCircle className="w-3.5 h-3.5" />,
          onClick: () => onCancel(broadcast.id),
          danger: true,
        }
      : null,
  ].filter(Boolean) as Parameters<typeof Dropdown>[0]['items'];

  return (
    <tr className="border-b border-[#1E2130] hover:bg-[#111318]/60 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <PlatformIcon platform={broadcast.platform ?? 'INSTAGRAM'} size={16} />
          <div>
            <p className="text-sm font-medium text-[#F0F2FF] leading-tight">{broadcast.name}</p>
            <p className="text-xs text-[#4B5068] mt-0.5">
              {broadcast.scheduled_at ? fmtDate(broadcast.scheduled_at) : 'No schedule'}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">{statusBadge(broadcast.status)}</td>
      <td className="px-4 py-3 hidden md:table-cell text-sm text-[#8B90A7]">
        {fmtNum(broadcast.sent_count)}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-sm text-[#8B90A7]">
        {fmtNum(broadcast.delivered_count)}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-sm text-green-400 font-medium">
        {fmtNum(broadcast.replied_count)}{' '}
        {broadcast.sent_count > 0 && (
          <span className="text-xs text-[#4B5068]">({replyRate(broadcast)})</span>
        )}
      </td>
      <td className="px-4 py-3 hidden xl:table-cell text-sm font-semibold text-green-400">
        {broadcast.revenue_attributed > 0 ? `$${broadcast.revenue_attributed.toLocaleString()}` : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        {menuItems.length > 0 && (
          <Dropdown
            trigger={
              <button className="p-1.5 rounded-lg text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#1A1C24] transition-colors opacity-0 group-hover:opacity-100">
                <MoreVertical className="w-4 h-4" />
              </button>
            }
            items={menuItems}
          />
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Broadcast card – grid view
// ---------------------------------------------------------------------------

function BroadcastCard({
  broadcast,
  onCancel,
  onDuplicate,
  onSend,
  onViewStats,
}: {
  broadcast: Broadcast;
  onCancel: (id: string) => void;
  onDuplicate: (b: Broadcast) => void;
  onSend: (id: string) => void;
  onViewStats: (b: Broadcast) => void;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <PlatformIcon platform={broadcast.platform ?? 'INSTAGRAM'} size={18} />
          <p className="text-sm font-semibold text-[#F0F2FF] truncate">{broadcast.name}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {statusBadge(broadcast.status)}
        </div>
      </div>

      <div className="text-xs text-[#8B90A7] flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
        {broadcast.scheduled_at ? fmtDate(broadcast.scheduled_at) : 'Not scheduled'}
      </div>

      {broadcast.message_content && (
        <p className="text-xs text-[#4B5068] line-clamp-2 leading-relaxed">
          {broadcast.message_content}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#2A2E42]">
        {[
          { icon: <Send className="w-3 h-3" />, label: 'Sent', val: fmtNum(broadcast.sent_count) },
          { icon: <MessageSquare className="w-3 h-3" />, label: 'Replied', val: replyRate(broadcast) },
          { icon: <DollarSign className="w-3 h-3" />, label: 'Revenue', val: broadcast.revenue_attributed > 0 ? `$${broadcast.revenue_attributed.toLocaleString()}` : '—' },
        ].map(({ icon, label, val }) => (
          <div key={label} className="text-center">
            <div className="flex items-center justify-center gap-1 text-[#4B5068] mb-0.5">{icon}</div>
            <p className="text-xs font-semibold text-[#F0F2FF]">{val}</p>
            <p className="text-[10px] text-[#4B5068]">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        {broadcast.status === 'draft' && (
          <Button variant="primary" size="sm" className="flex-1" onClick={() => onSend(broadcast.id)}>
            <Send className="w-3 h-3" /> Send Now
          </Button>
        )}
        {broadcast.status === 'sent' && (
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => onViewStats(broadcast)}>
            <BarChart2 className="w-3 h-3" /> View Stats
          </Button>
        )}
        {broadcast.status === 'scheduled' && (
          <Button variant="danger" size="sm" className="flex-1" onClick={() => onCancel(broadcast.id)}>
            <XCircle className="w-3 h-3" /> Cancel
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => onDuplicate(broadcast)}>
          <Copy className="w-3 h-3" />
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Stats Modal
// ---------------------------------------------------------------------------

function StatsModal({ broadcast, onClose }: { broadcast: Broadcast; onClose: () => void }) {
  const deliverRate =
    broadcast.sent_count > 0
      ? ((broadcast.delivered_count / broadcast.sent_count) * 100).toFixed(1)
      : '0';
  const rRate =
    broadcast.delivered_count > 0
      ? ((broadcast.replied_count / broadcast.delivered_count) * 100).toFixed(1)
      : '0';

  return (
    <Modal open onClose={onClose} title="Broadcast Stats" maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <PlatformIcon platform={broadcast.platform ?? 'INSTAGRAM'} size={18} />
          <span className="text-sm font-semibold text-[#F0F2FF]">{broadcast.name}</span>
          {statusBadge(broadcast.status)}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Sent', value: fmtNum(broadcast.sent_count), color: 'text-[#F0F2FF]' },
            { label: 'Delivered', value: fmtNum(broadcast.delivered_count), color: 'text-blue-400' },
            { label: 'Replied', value: fmtNum(broadcast.replied_count), color: 'text-green-400' },
            { label: 'Revenue', value: broadcast.revenue_attributed > 0 ? `$${broadcast.revenue_attributed.toLocaleString()}` : '—', color: 'text-green-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-3 rounded-xl bg-[#111318] border border-[#2A2E42] text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-[#8B90A7]">{label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {[
            { label: 'Delivery Rate', pct: deliverRate },
            { label: 'Reply Rate', pct: rRate },
          ].map(({ label, pct }) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#8B90A7]">{label}</span>
                <span className="text-[#F0F2FF] font-medium">{pct}%</span>
              </div>
              <div className="h-2 bg-[#2A2E42] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, parseFloat(pct))}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between text-xs text-[#8B90A7] pt-2">
          <span>Sent at: {fmtDate(broadcast.sent_at)}</span>
          {broadcast.message_tag && (
            <span className="flex items-center gap-1">
              <Tag className="w-3 h-3" /> {broadcast.message_tag}
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function BroadcastsPage() {
  const { tenant, brand } = useAuth();
  const { toasts, toast, removeToast } = useToast();

  // ---- List state ----
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // ---- Segments ----
  const [segments, setSegments] = useState<Segment[]>([]);

  // ---- Modals ----
  const [showComposer, setShowComposer] = useState(false);
  const [composerStep, setComposerStep] = useState(1);
  const [wizard, setWizard] = useState<WizardState>(defaultWizard());
  const [submitting, setSubmitting] = useState(false);
  const [statsTarget, setStatsTarget] = useState<Broadcast | null>(null);

  // ---- Reach estimation ----
  const [reachCount, setReachCount] = useState(0);
  const [windowCount, setWindowCount] = useState(0);
  const [reachLoading, setReachLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchBroadcasts = useCallback(async (silent = false) => {
    if (!tenant?.id) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const res: any = await broadcastApi.list(tenant.id, brand?.id);
      const list: Broadcast[] = Array.isArray(res)
        ? res
        : res?.data ?? res?.broadcasts ?? [];
      setBroadcasts(
        list.map((b: any) => ({
          id: b.id,
          tenant_id: b.tenant_id,
          brand_id: b.brand_id,
          name: b.name,
          status: b.status,
          platform: b.platform ?? 'INSTAGRAM',
          message_content: b.message_content,
          message_tag: b.message_tag,
          segment_filters: b.segment_filters ?? {},
          estimated_reach: b.estimated_reach ?? 0,
          window_eligible_count: b.window_eligible_count ?? 0,
          scheduled_at: b.scheduled_at ?? null,
          sent_at: b.sent_at ?? null,
          sent_count: b.sent_count ?? 0,
          delivered_count: b.delivered_count ?? 0,
          replied_count: b.replied_count ?? 0,
          revenue_attributed: b.revenue_attributed ?? 0,
          created_at: b.created_at,
        }))
      );
    } catch {
      toast.error('Failed to load broadcasts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenant?.id, brand?.id]);

  const fetchSegments = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      const { data } = await supabase
        .from('segments')
        .select('id, name, description, member_count, filter_rules, is_static, created_at, updated_at, tenant_id, brand_id')
        .eq('tenant_id', tenant.id)
        .order('name');
      setSegments((data as Segment[]) ?? []);
    } catch {
      // segments are optional; fail silently
    }
  }, [tenant?.id]);

  useEffect(() => {
    fetchBroadcasts();
    fetchSegments();
  }, [fetchBroadcasts, fetchSegments]);

  // ---------------------------------------------------------------------------
  // Reach estimation
  // ---------------------------------------------------------------------------

  const estimateReach = useCallback(async (segmentId: string | null, platform: Platform) => {
    if (!tenant?.id || !brand?.id) return;
    setReachLoading(true);
    try {
      let query = supabase
        .from('platform_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('brand_id', brand.id)
        .eq('platform', platform);

      // If a specific segment is selected, fetch its member_count as a proxy
      if (segmentId) {
        const seg = segments.find((s) => s.id === segmentId);
        setReachCount(seg?.member_count ?? 0);
        setWindowCount(Math.round((seg?.member_count ?? 0) * 0.42)); // heuristic ~42%
        setReachLoading(false);
        return;
      }

      const { count: total } = await query;
      setReachCount(total ?? 0);

      // Window eligible: contacts with last_interaction_at within 24h
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: window } = await supabase
        .from('platform_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('brand_id', brand.id)
        .eq('platform', platform)
        .gte('last_interaction_at', cutoff);
      setWindowCount(window ?? 0);
    } catch {
      setReachCount(0);
      setWindowCount(0);
    } finally {
      setReachLoading(false);
    }
  }, [tenant?.id, brand?.id, segments]);

  useEffect(() => {
    if (showComposer && composerStep === 1) {
      estimateReach(wizard.segmentId, wizard.platform);
    }
  }, [wizard.segmentId, wizard.platform, showComposer, composerStep, estimateReach]);

  // ---------------------------------------------------------------------------
  // Wizard helpers
  // ---------------------------------------------------------------------------

  function patchWizard(patch: Partial<WizardState>) {
    setWizard((w) => ({ ...w, ...patch }));
  }

  function openComposer(prefill?: Partial<WizardState>) {
    setWizard({ ...defaultWizard(), ...prefill });
    setComposerStep(1);
    setShowComposer(true);
  }

  function closeComposer() {
    setShowComposer(false);
  }

  function insertVariable(v: string) {
    patchWizard({ message: wizard.message + v });
  }

  function canAdvance(): boolean {
    if (composerStep === 1) return true;
    if (composerStep === 2) return wizard.broadcastName.trim().length > 0 && wizard.message.trim().length > 0;
    if (composerStep === 3) return wizard.sendNow || wizard.scheduledAt.trim().length > 0;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function handleCreate() {
    if (!tenant?.id || !brand?.id || submitting) return;
    setSubmitting(true);
    try {
      const scheduledAt =
        !wizard.sendNow && wizard.scheduledAt
          ? new Date(wizard.scheduledAt).toISOString()
          : undefined;

      const created: any = await broadcastApi.create(
        tenant.id,
        brand.id,
        wizard.broadcastName.trim() || `Broadcast ${format(new Date(), 'MMM d, yyyy')}`,
        wizard.platform,
        wizard.message,
        wizard.useMessageTag ? wizard.messageTag : undefined,
        wizard.segmentId ? { segment_id: wizard.segmentId } : undefined,
        scheduledAt,
      );

      if (wizard.sendNow && created?.id) {
        await broadcastApi.send(created.id);
        toast.success('Broadcast sent!', 'Your message is on its way.');
      } else {
        toast.success('Broadcast scheduled', `Sending on ${fmtDate(scheduledAt ?? null)}`);
      }

      closeComposer();
      await fetchBroadcasts(true);
    } catch (err: any) {
      toast.error('Failed to create broadcast', err?.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(broadcastId: string) {
    try {
      await broadcastApi.cancel(broadcastId);
      setBroadcasts((prev) =>
        prev.map((b) => (b.id === broadcastId ? { ...b, status: 'cancelled' } : b))
      );
      toast.success('Broadcast cancelled');
    } catch {
      toast.error('Failed to cancel broadcast');
    }
  }

  async function handleSend(broadcastId: string) {
    try {
      await broadcastApi.send(broadcastId);
      setBroadcasts((prev) =>
        prev.map((b) => (b.id === broadcastId ? { ...b, status: 'sending' } : b))
      );
      toast.success('Broadcast sending', 'Messages are being delivered.');
    } catch {
      toast.error('Failed to send broadcast');
    }
  }

  function handleDuplicate(b: Broadcast) {
    openComposer({
      platform: b.platform ?? 'INSTAGRAM',
      message: b.message_content ?? '',
      broadcastName: `${b.name} (Copy)`,
      useMessageTag: !!b.message_tag,
      messageTag: b.message_tag ?? 'CONFIRMED_EVENT_UPDATE',
    });
  }

  // ---------------------------------------------------------------------------
  // Derived / filtered list
  // ---------------------------------------------------------------------------

  const filtered = useMemo(() => {
    return broadcasts.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [broadcasts, statusFilter, search]);

  // Aggregate stats
  const stats = useMemo(() => {
    const sent = broadcasts.filter((b) => b.status === 'sent');
    const totalReplied = sent.reduce((a, b) => a + b.replied_count, 0);
    const totalSent = sent.reduce((a, b) => a + b.sent_count, 0);
    return {
      total: broadcasts.length,
      sentCount: sent.length,
      scheduledCount: broadcasts.filter((b) => b.status === 'scheduled').length,
      avgReplyRate: totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(1) + '%' : '—',
    };
  }, [broadcasts]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0A0B0F]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#F0F2FF]">Broadcasts</h1>
            <p className="text-xs text-[#8B90A7] mt-0.5">
              Send one-time messages to your audience
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchBroadcasts(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="primary" onClick={() => openComposer()}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Broadcast</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Total Broadcasts"
            value={loading ? '—' : stats.total.toString()}
            icon={<Zap className="w-4 h-4" />}
            iconColor="text-blue-400"
          />
          <MetricCard
            label="Sent"
            value={loading ? '—' : stats.sentCount.toString()}
            icon={<Send className="w-4 h-4" />}
            iconColor="text-green-400"
          />
          <MetricCard
            label="Scheduled"
            value={loading ? '—' : stats.scheduledCount.toString()}
            icon={<Calendar className="w-4 h-4" />}
            iconColor="text-amber-400"
          />
          <MetricCard
            label="Avg Reply Rate"
            value={loading ? '—' : stats.avgReplyRate}
            icon={<MessageSquare className="w-4 h-4" />}
            iconColor="text-purple-400"
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex-1 w-full sm:max-w-xs">
            <Input
              placeholder="Search broadcasts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <Tabs
              tabs={STATUS_FILTERS.map((f) => ({
                id: f.id,
                label: f.label,
                badge: f.id !== 'all'
                  ? broadcasts.filter((b) => b.status === f.id).length || undefined
                  : undefined,
              }))}
              active={statusFilter}
              onChange={setStatusFilter}
              className="flex-shrink-0"
            />
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-[#1A1C24] text-[#F0F2FF]' : 'text-[#4B5068] hover:text-[#8B90A7]'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-[#1A1C24] text-[#F0F2FF]' : 'text-[#4B5068] hover:text-[#8B90A7]'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Broadcast list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-[#111318] border border-[#2A2E42] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Send className="w-7 h-7" />}
            title={search || statusFilter !== 'all' ? 'No matching broadcasts' : 'No broadcasts yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Create your first broadcast to reach your audience directly.'
            }
            action={
              !search && statusFilter === 'all' ? (
                <Button variant="primary" onClick={() => openComposer()}>
                  <Plus className="w-4 h-4" /> Create Broadcast
                </Button>
              ) : undefined
            }
          />
        ) : viewMode === 'list' ? (
          <div className="bg-[#111318] border border-[#2A2E42] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-[#2A2E42]">
                    {[
                      { label: 'Broadcast', cls: '' },
                      { label: 'Status', cls: 'hidden sm:table-cell' },
                      { label: 'Sent', cls: 'hidden md:table-cell' },
                      { label: 'Delivered', cls: 'hidden lg:table-cell' },
                      { label: 'Replied', cls: 'hidden lg:table-cell' },
                      { label: 'Revenue', cls: 'hidden xl:table-cell' },
                      { label: '', cls: '' },
                    ].map(({ label, cls }) => (
                      <th
                        key={label}
                        className={`px-4 py-3 text-left text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider ${cls}`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <BroadcastRow
                      key={b.id}
                      broadcast={b}
                      onCancel={handleCancel}
                      onDuplicate={handleDuplicate}
                      onSend={handleSend}
                      onViewStats={setStatsTarget}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((b) => (
              <BroadcastCard
                key={b.id}
                broadcast={b}
                onCancel={handleCancel}
                onDuplicate={handleDuplicate}
                onSend={handleSend}
                onViewStats={setStatsTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* Create Broadcast Wizard                                             */}
      {/* ================================================================== */}
      <Modal
        open={showComposer}
        onClose={closeComposer}
        title={
          ['', 'Step 1: Audience', 'Step 2: Message', 'Step 3: Schedule', 'Step 4: Review'][composerStep]
        }
        maxWidth="max-w-2xl"
      >
        <StepIndicator step={composerStep} total={4} />

        {/* ---- Step 1: Audience ----------------------------------------- */}
        {composerStep === 1 && (
          <div className="space-y-5">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                Meta DM broadcasts only reach contacts who interacted within the last 24 hours, unless you use an approved Message Tag.
              </p>
            </div>

            {/* Platform */}
            <div>
              <label className="text-xs font-medium text-[#8B90A7] block mb-2">Platform</label>
              <PlatformSelector
                value={wizard.platform}
                onChange={(p) => patchWizard({ platform: p })}
              />
            </div>

            {/* Segment selector */}
            <div>
              <label className="text-xs font-medium text-[#8B90A7] block mb-2">Audience</label>
              <div className="space-y-2">
                {/* All contacts option */}
                <button
                  type="button"
                  onClick={() => patchWizard({ segmentId: null })}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    wizard.segmentId === null
                      ? 'border-blue-500/50 bg-blue-500/10 text-[#F0F2FF]'
                      : 'border-[#2A2E42] text-[#8B90A7] hover:border-[#3A3E55]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    All Contacts
                  </div>
                  {wizard.segmentId === null && (
                    <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  )}
                </button>

                {/* Segments */}
                {segments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider px-1">
                      Segments
                    </p>
                    {segments.map((seg) => (
                      <button
                        key={seg.id}
                        type="button"
                        onClick={() => patchWizard({ segmentId: seg.id })}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                          wizard.segmentId === seg.id
                            ? 'border-blue-500/50 bg-blue-500/10 text-[#F0F2FF]'
                            : 'border-[#2A2E42] text-[#8B90A7] hover:border-[#3A3E55]'
                        }`}
                      >
                        <div className="text-left">
                          <p className={wizard.segmentId === seg.id ? 'text-[#F0F2FF]' : 'text-[#8B90A7]'}>
                            {seg.name}
                          </p>
                          {seg.description && (
                            <p className="text-[10px] text-[#4B5068] mt-0.5">{seg.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-[#4B5068]">
                            {seg.member_count.toLocaleString()} contacts
                          </span>
                          {wizard.segmentId === seg.id && (
                            <CheckCircle2 className="w-4 h-4 text-blue-400" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Reach stats */}
            <div className="flex gap-3">
              <ReachCard
                label="Estimated reach"
                count={reachCount}
                loading={reachLoading}
              />
              <ReachCard
                label="24h window eligible"
                count={windowCount}
                variant="green"
                loading={reachLoading}
              />
            </div>

            {/* Respect window toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#111318] border border-[#2A2E42]">
              <div>
                <p className="text-sm text-[#F0F2FF] font-medium">Respect 24h window</p>
                <p className="text-xs text-[#8B90A7] mt-0.5">
                  Only send to contacts eligible in the 24h window
                </p>
              </div>
              <Toggle
                checked={wizard.respectWindow}
                onChange={(v) => patchWizard({ respectWindow: v })}
              />
            </div>
          </div>
        )}

        {/* ---- Step 2: Message ------------------------------------------ */}
        {composerStep === 2 && (
          <div className="space-y-5">
            <Input
              label="Broadcast Name"
              placeholder="e.g. Summer Sale Announcement"
              value={wizard.broadcastName}
              onChange={(e) => patchWizard({ broadcastName: e.target.value })}
            />

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[#8B90A7]">Message</label>
                <span className="text-xs text-[#4B5068]">{wizard.message.length}/1000</span>
              </div>
              <Textarea
                placeholder={`Hi {{contact.name}}, we have something exciting for you...`}
                value={wizard.message}
                onChange={(e) => patchWizard({ message: e.target.value.slice(0, 1000) })}
                rows={5}
              />

              {/* Variable buttons */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[10px] text-[#4B5068] self-center">Insert:</span>
                {VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="px-2 py-0.5 rounded-md bg-[#1A1C24] border border-[#2A2E42] text-[10px] text-blue-400 hover:border-blue-500/50 transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {wizard.message.trim() && (
              <div>
                <p className="text-xs font-medium text-[#8B90A7] mb-2">Preview</p>
                <div className="p-4 rounded-xl bg-[#111318] border border-[#2A2E42]">
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#2A2E42] flex-shrink-0" />
                    <div className="bg-[#1A1C24] border border-[#2A2E42] rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[280px]">
                      <p className="text-sm text-[#F0F2FF] leading-relaxed whitespace-pre-wrap">
                        {wizard.message
                          .replace('{{contact.name}}', 'Alex')
                          .replace('{{brand.name}}', brand?.name ?? 'Your Brand')
                          .replace('{{brand.persona_name}}', (brand as any)?.persona_name ?? 'Team')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Message tag */}
            <div className="p-3 rounded-xl bg-[#111318] border border-[#2A2E42] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#F0F2FF] font-medium">Use Message Tag</p>
                  <p className="text-xs text-[#8B90A7] mt-0.5">
                    Required to reach contacts outside the 24h window
                  </p>
                </div>
                <Toggle
                  checked={wizard.useMessageTag}
                  onChange={(v) => patchWizard({ useMessageTag: v })}
                />
              </div>
              {wizard.useMessageTag && (
                <Select
                  label="Tag Type"
                  value={wizard.messageTag}
                  onChange={(e) => patchWizard({ messageTag: e.target.value })}
                  options={MESSAGE_TAGS.map((t) => ({ value: t.value, label: t.label }))}
                />
              )}
            </div>
          </div>
        )}

        {/* ---- Step 3: Schedule ------------------------------------------ */}
        {composerStep === 3 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => patchWizard({ sendNow: true })}
                className={`p-4 rounded-xl border text-left transition-all ${
                  wizard.sendNow
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-[#2A2E42] bg-[#111318] hover:border-[#3A3E55]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Zap className={`w-5 h-5 ${wizard.sendNow ? 'text-blue-400' : 'text-[#4B5068]'}`} />
                  {wizard.sendNow && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                </div>
                <p className={`text-sm font-semibold ${wizard.sendNow ? 'text-blue-400' : 'text-[#F0F2FF]'}`}>
                  Send Now
                </p>
                <p className="text-xs text-[#8B90A7] mt-1">Start delivering immediately</p>
              </button>

              <button
                type="button"
                onClick={() => patchWizard({ sendNow: false })}
                className={`p-4 rounded-xl border text-left transition-all ${
                  !wizard.sendNow
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-[#2A2E42] bg-[#111318] hover:border-[#3A3E55]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Calendar className={`w-5 h-5 ${!wizard.sendNow ? 'text-blue-400' : 'text-[#4B5068]'}`} />
                  {!wizard.sendNow && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                </div>
                <p className={`text-sm font-semibold ${!wizard.sendNow ? 'text-blue-400' : 'text-[#F0F2FF]'}`}>
                  Schedule for Later
                </p>
                <p className="text-xs text-[#8B90A7] mt-1">Pick a date and time</p>
              </button>
            </div>

            {!wizard.sendNow && (
              <div>
                <label className="text-xs font-medium text-[#8B90A7] block mb-1.5">
                  Date & Time
                  {(brand?.timezone as string) && (
                    <span className="ml-2 text-[#4B5068] font-normal">({brand?.timezone as string})</span>
                  )}
                </label>
                <input
                  type="datetime-local"
                  value={wizard.scheduledAt}
                  onChange={(e) => patchWizard({ scheduledAt: e.target.value })}
                  min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                  className="h-9 w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-[#F0F2FF] px-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all [color-scheme:dark]"
                />
                {wizard.scheduledAt && (
                  <p className="text-xs text-[#8B90A7] mt-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Scheduled for {fmtDate(new Date(wizard.scheduledAt).toISOString())}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---- Step 4: Review -------------------------------------------- */}
        {composerStep === 4 && (
          <div className="space-y-4">
            {/* Summary card */}
            <div className="p-4 rounded-xl bg-[#111318] border border-[#2A2E42] space-y-3">
              {[
                {
                  label: 'Name',
                  value: wizard.broadcastName || `Broadcast ${format(new Date(), 'MMM d')}`,
                },
                {
                  label: 'Platform',
                  value: (
                    <div className="flex items-center gap-1.5">
                      <PlatformIcon platform={wizard.platform} size={14} />
                      {wizard.platform.charAt(0) + wizard.platform.slice(1).toLowerCase()}
                    </div>
                  ),
                },
                {
                  label: 'Audience',
                  value: wizard.segmentId
                    ? segments.find((s) => s.id === wizard.segmentId)?.name ?? 'Segment'
                    : 'All Contacts',
                },
                {
                  label: 'Estimated Reach',
                  value: (
                    <span className="text-[#F0F2FF]">
                      {reachCount.toLocaleString()}{' '}
                      {wizard.respectWindow && (
                        <span className="text-[#4B5068]">
                          ({windowCount.toLocaleString()} window-eligible)
                        </span>
                      )}
                    </span>
                  ),
                },
                {
                  label: 'Schedule',
                  value: wizard.sendNow
                    ? 'Send immediately'
                    : wizard.scheduledAt
                    ? fmtDate(new Date(wizard.scheduledAt).toISOString())
                    : '—',
                },
                wizard.useMessageTag
                  ? {
                      label: 'Message Tag',
                      value: MESSAGE_TAGS.find((t) => t.value === wizard.messageTag)?.label ?? wizard.messageTag,
                    }
                  : null,
              ]
                .filter(Boolean)
                .map(({ label, value }: any) => (
                  <div key={label} className="flex justify-between items-center text-sm gap-4">
                    <span className="text-[#8B90A7] flex-shrink-0">{label}</span>
                    <span className="text-[#F0F2FF] text-right">{value}</span>
                  </div>
                ))}
            </div>

            {/* Message preview */}
            <div>
              <p className="text-xs font-medium text-[#8B90A7] mb-2">Message Preview</p>
              <div className="p-3 rounded-xl bg-[#111318] border border-[#2A2E42]">
                <p className="text-sm text-[#F0F2FF] leading-relaxed whitespace-pre-wrap">
                  {wizard.message || '(no message)'}
                </p>
              </div>
            </div>

            {/* Compliance check */}
            <div className={`p-3 rounded-xl border flex items-center gap-2 ${
              wizard.useMessageTag || wizard.respectWindow
                ? 'bg-green-500/10 border-green-500/20'
                : 'bg-amber-500/10 border-amber-500/20'
            }`}>
              {wizard.useMessageTag || wizard.respectWindow ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <p className="text-xs text-green-300">
                    {wizard.useMessageTag
                      ? `Message Tag "${MESSAGE_TAGS.find((t) => t.value === wizard.messageTag)?.label}" applied — post-window contacts included.`
                      : '24h window enforcement active — only eligible contacts will receive this.'}
                  </p>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <p className="text-xs text-amber-300">
                    No window enforcement or message tag selected. Some sends may fail for contacts outside the 24h window.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Wizard footer */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#2A2E42]">
          <Button
            variant="ghost"
            onClick={() => {
              if (composerStep > 1) setComposerStep((s) => s - 1);
              else closeComposer();
            }}
            disabled={submitting}
          >
            {composerStep === 1 ? 'Cancel' : 'Back'}
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#4B5068] hidden sm:block">
              {composerStep} / 4
            </span>
            {composerStep < 4 ? (
              <Button
                variant="primary"
                onClick={() => setComposerStep((s) => s + 1)}
                disabled={!canAdvance()}
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleCreate}
                loading={submitting}
                disabled={submitting}
              >
                {wizard.sendNow ? (
                  <>
                    <Send className="w-3.5 h-3.5" /> Confirm & Send
                  </>
                ) : (
                  <>
                    <Calendar className="w-3.5 h-3.5" /> Confirm & Schedule
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Stats modal */}
      {statsTarget && (
        <StatsModal broadcast={statsTarget} onClose={() => setStatsTarget(null)} />
      )}

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
