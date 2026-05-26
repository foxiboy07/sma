import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Grid3X3, Table, MoreVertical, Play, Pause, Copy, Archive, Zap, Clock, Users, DollarSign, GitBranch, Filter, X, AlertCircle, EyeOff, Eye } from 'lucide-react';
import { Button, Badge, Card, Modal, Input, Select, EmptyState, Skeleton, Dropdown } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Flow, FlowStatus, TriggerType } from '../types';
import { formatDistanceToNow } from 'date-fns';

const TRIGGER_LABELS: Record<TriggerType, string> = {
  COMMENT_TO_DM: 'Comment → DM',
  STORY_MENTION: 'Story Mention',
  STORY_REPLY: 'Story Reply',
  FOLLOW_TO_DM: 'Follow → DM',
  SHARE_TO_DM: 'Share → DM',
  TIKTOK_COMMENT_TO_DM: 'TikTok Comment → DM',
  TIKTOK_SHOP_COMMENT: 'TikTok Shop Comment',
  DEEPLINK_BIO_CLICK: 'Bio Link Click',
  MANUAL: 'Manual',
};

const TRIGGER_PLATFORMS: Record<TriggerType, string[]> = {
  COMMENT_TO_DM: ['INSTAGRAM', 'FACEBOOK'],
  STORY_MENTION: ['INSTAGRAM'],
  STORY_REPLY: ['INSTAGRAM'],
  FOLLOW_TO_DM: ['INSTAGRAM'],
  SHARE_TO_DM: ['INSTAGRAM'],
  TIKTOK_COMMENT_TO_DM: ['TIKTOK'],
  TIKTOK_SHOP_COMMENT: ['TIKTOK'],
  DEEPLINK_BIO_CLICK: ['INSTAGRAM', 'FACEBOOK', 'TIKTOK'],
  MANUAL: ['INSTAGRAM', 'FACEBOOK', 'TIKTOK'],
};

const TEMPLATES = [
  { name: 'Comment-to-DM Giveaway', desc: 'Auto-DM everyone who comments a keyword on your post', trigger: 'COMMENT_TO_DM' as TriggerType, platform: 'INSTAGRAM', conv: '34%' },
  { name: 'Story Reply Lead Capture', desc: 'Capture leads from story replies with a smart delay', trigger: 'STORY_REPLY' as TriggerType, platform: 'INSTAGRAM', conv: '28%' },
  { name: 'TikTok Shop Price Inquiry', desc: 'Auto-send product cards when users ask for prices', trigger: 'TIKTOK_SHOP_COMMENT' as TriggerType, platform: 'TIKTOK', conv: '41%' },
  { name: 'Welcome New Followers', desc: 'Send a welcome message to every new follower', trigger: 'FOLLOW_TO_DM' as TriggerType, platform: 'INSTAGRAM', conv: '22%' },
];

export function FlowsPage() {
  const navigate = useNavigate();
  const { tenant, brand } = useAuth();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState<'choose' | 'details'>('choose');
  const [newFlow, setNewFlow] = useState({ name: '', trigger_type: 'COMMENT_TO_DM' as TriggerType });
  const [actionError, setActionError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant?.id) return;
    const fetchFlows = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('flows')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('updated_at', { ascending: false });
      if (!error && data) setFlows(data as Flow[]);
      setLoading(false);
    };
    fetchFlows();
  }, [tenant?.id]);

  const filtered = flows.filter(f => {
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || f.status === statusFilter;
    // Hide archived by default unless showArchived is on, or user explicitly filters to ARCHIVED
    const matchArchive = showArchived || statusFilter === 'ARCHIVED' || f.status !== 'ARCHIVED';
    return matchSearch && matchStatus && matchArchive;
  });

  const counts = {
    active: flows.filter(f => f.status === 'ACTIVE').length,
    paused: flows.filter(f => f.status === 'PAUSED').length,
    draft: flows.filter(f => f.status === 'DRAFT').length,
    archived: flows.filter(f => f.status === 'ARCHIVED').length,
  };

  async function createFlow() {
    if (!tenant?.id || !brand?.id) return;
    try {
      const { data, error } = await supabase
        .from('flows')
        .insert({
          tenant_id: tenant.id,
          brand_id: brand.id,
          name: newFlow.name,
          status: 'DRAFT',
          trigger_type: newFlow.trigger_type,
          trigger_config: {},
          ghost_traffic_pct: 0,
          triggered_count: 0,
          conversion_count: 0,
          revenue_attributed: 0,
        })
        .select()
        .single();
      if (error || !data) throw new Error(error?.message);
      const flow = data as Flow;
      setFlows(prev => [flow, ...prev]);
      setShowCreate(false);
      setCreateStep('choose');
      setNewFlow({ name: '', trigger_type: 'COMMENT_TO_DM' });
      navigate(`/flows/${flow.id}/builder`);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to create flow');
    }
  }

  async function toggleStatus(id: string) {
    const flow = flows.find(f => f.id === id);
    if (!flow) return;
    const nextStatus: FlowStatus = flow.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setFlows(prev => prev.map(f => f.id === id ? { ...f, status: nextStatus } : f));
    try {
      const { error } = await supabase
        .from('flows')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(error.message);
    } catch (err: any) {
      setFlows(prev => prev.map(f => f.id === id ? { ...f, status: flow.status } : f));
      setActionError(err?.message || 'Failed to update flow status');
    }
  }

  async function duplicateFlow(id: string) {
    const flow = flows.find(f => f.id === id);
    if (!flow || !tenant?.id || !brand?.id) return;
    setDuplicating(id);
    setActionError(null);
    try {
      // Duplicate the flow row
      const { data: newFlowData, error: flowErr } = await supabase
        .from('flows')
        .insert({
          tenant_id: tenant.id,
          brand_id: brand.id,
          name: `${flow.name} (Copy)`,
          status: 'DRAFT',
          trigger_type: flow.trigger_type,
          trigger_config: flow.trigger_config,
          ghost_traffic_pct: 0,
          triggered_count: 0,
          conversion_count: 0,
          revenue_attributed: 0,
        })
        .select()
        .single();
      if (flowErr || !newFlowData) throw new Error(flowErr?.message);

      // Duplicate flow_nodes
      const { data: srcNodes } = await supabase
        .from('flow_nodes')
        .select('*')
        .eq('flow_id', id);

      if (srcNodes && srcNodes.length > 0) {
        const copiedNodes = srcNodes.map(({ id: _id, ...rest }: any) => ({
          ...rest,
          flow_id: newFlowData.id,
          tenant_id: tenant.id,
        }));
        await supabase.from('flow_nodes').insert(copiedNodes);
      }

      // Duplicate flow_edges
      const { data: srcEdges } = await supabase
        .from('flow_edges')
        .select('*')
        .eq('flow_id', id);

      if (srcEdges && srcEdges.length > 0) {
        const copiedEdges = srcEdges.map(({ id: _id, ...rest }: any) => ({
          ...rest,
          flow_id: newFlowData.id,
          tenant_id: tenant.id,
        }));
        await supabase.from('flow_edges').insert(copiedEdges);
      }

      setFlows(prev => [newFlowData as Flow, ...prev]);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to duplicate flow');
    } finally {
      setDuplicating(null);
    }
  }

  async function archiveFlow(id: string) {
    const flow = flows.find(f => f.id === id);
    if (!flow) return;
    setArchiving(id);
    setActionError(null);
    try {
      const { error } = await supabase
        .from('flows')
        .update({ status: 'ARCHIVED', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(error.message);
      setFlows(prev => prev.map(f => f.id === id ? { ...f, status: 'ARCHIVED' } : f));
    } catch (err: any) {
      setActionError(err?.message || 'Failed to archive flow');
    } finally {
      setArchiving(null);
    }
  }

  const statusBadge = (s: FlowStatus) => {
    const map = { ACTIVE: 'success', PAUSED: 'warning', DRAFT: 'default', ARCHIVED: 'default' } as const;
    return <Badge variant={map[s]}>{s.charAt(0) + s.slice(1).toLowerCase()}</Badge>;
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#F0F2FF]">Flows</h1>
          <p className="text-xs text-[#8B90A7] mt-0.5">
            {counts.active} active · {counts.paused} paused · {counts.draft} draft
            {counts.archived > 0 && ` · ${counts.archived} archived`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => {}}>Import JSON</Button>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> New Flow
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4B5068]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search flows..."
            className="h-9 w-full pl-9 pr-8 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] placeholder:text-[#4B5068] focus:outline-none focus:border-blue-500 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4B5068] hover:text-[#F0F2FF]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1 p-1 bg-[#111318] rounded-lg border border-[#1E2130]">
          {['all', 'ACTIVE', 'PAUSED', 'DRAFT'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${statusFilter === s ? 'bg-[#1A1C24] text-[#F0F2FF]' : 'text-[#8B90A7] hover:text-[#F0F2FF]'}`}
            >
              {s === 'all' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {counts.archived > 0 && (
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              showArchived
                ? 'bg-[#1A1C24] border-[#2A2E42] text-[#F0F2FF]'
                : 'border-[#2A2E42] text-[#4B5068] hover:text-[#8B90A7]'
            }`}
          >
            {showArchived ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {counts.archived} archived
          </button>
        )}
        <div className="flex gap-1 p-1 bg-[#111318] rounded-lg border border-[#1E2130] ml-auto">
          <button onClick={() => setView('grid')} className={`p-1.5 rounded ${view === 'grid' ? 'bg-[#1A1C24] text-[#F0F2FF]' : 'text-[#4B5068]'}`}>
            <Grid3X3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setView('table')} className={`p-1.5 rounded ${view === 'table' ? 'bg-[#1A1C24] text-[#F0F2FF]' : 'text-[#4B5068]'}`}>
            <Table className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Loading skeletons */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Zap className="w-8 h-8" />}
          title={search ? 'No flows match your search' : 'No flows found'}
          description={search ? 'Try a different search term.' : 'Create your first automation flow to start engaging with your audience.'}
          action={!search ? <Button variant="primary" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> Create Flow</Button> : undefined}
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(flow => (
            <FlowCard
              key={flow.id}
              flow={flow}
              onToggle={toggleStatus}
              onEdit={() => navigate(`/flows/${flow.id}/builder`)}
              onDuplicate={duplicateFlow}
              onArchive={archiveFlow}
              duplicating={duplicating === flow.id}
              archiving={archiving === flow.id}
            />
          ))}
        </div>
      ) : (
        <FlowTable
          flows={filtered}
          onToggle={toggleStatus}
          onEdit={id => navigate(`/flows/${id}/builder`)}
          onDuplicate={duplicateFlow}
          onArchive={archiveFlow}
        />
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setCreateStep('choose'); }} title="Create new flow" maxWidth="max-w-2xl">
        {createStep === 'choose' ? (
          <div>
            <h3 className="text-sm font-semibold text-[#F0F2FF] mb-4">Start from a template</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {TEMPLATES.map(t => (
                <button
                  key={t.name}
                  onClick={() => { setNewFlow({ name: t.name, trigger_type: t.trigger }); setCreateStep('details'); }}
                  className="text-left p-4 rounded-xl bg-[#111318] border border-[#2A2E42] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="info">{TRIGGER_LABELS[t.trigger]}</Badge>
                    <span className="text-xs text-green-400 font-medium">{t.conv} conv</span>
                  </div>
                  <p className="text-sm font-semibold text-[#F0F2FF] mb-1">{t.name}</p>
                  <p className="text-xs text-[#8B90A7]">{t.desc}</p>
                </button>
              ))}
            </div>
            <div className="border-t border-[#1E2130] pt-4">
              <button
                onClick={() => setCreateStep('details')}
                className="text-sm text-[#8B90A7] hover:text-[#F0F2FF] transition-colors"
              >
                Or start from scratch →
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Flow name"
              value={newFlow.name}
              onChange={e => setNewFlow(p => ({ ...p, name: e.target.value }))}
              placeholder="My awesome flow"
              autoFocus
            />
            <Select
              label="Trigger type"
              value={newFlow.trigger_type}
              onChange={e => setNewFlow(p => ({ ...p, trigger_type: e.target.value as TriggerType }))}
              options={Object.entries(TRIGGER_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </div>
        )}
        <div className="flex justify-between pt-4 border-t border-[#1E2130] mt-4">
          <Button variant="ghost" onClick={() => { if (createStep === 'details') setCreateStep('choose'); else setShowCreate(false); }}>
            {createStep === 'details' ? 'Back' : 'Cancel'}
          </Button>
          {createStep === 'details' && (
            <Button variant="primary" onClick={createFlow} disabled={!newFlow.name.trim()}>
              Create & Open Builder
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}

interface FlowCardProps {
  flow: Flow;
  onToggle: (id: string) => void;
  onEdit: () => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
  duplicating?: boolean;
  archiving?: boolean;
}

function FlowCard({ flow, onToggle, onEdit, onDuplicate, onArchive, duplicating, archiving }: FlowCardProps) {
  const pct = flow.triggered_count > 0 ? Math.round((flow.conversion_count / flow.triggered_count) * 100) : 0;
  const platforms = TRIGGER_PLATFORMS[flow.trigger_type] || [];
  const statusColor = { ACTIVE: 'text-green-400', PAUSED: 'text-amber-400', DRAFT: 'text-[#4B5068]', ARCHIVED: 'text-[#4B5068]' };
  const isArchived = flow.status === 'ARCHIVED';

  return (
    <Card hover className={isArchived ? 'opacity-60' : ''}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${statusColor[flow.status]}`}>
            ● {flow.status.charAt(0) + flow.status.slice(1).toLowerCase()}
          </span>
          {flow.ghost_variant_id && (
            <Badge variant="info"><GitBranch className="w-3 h-3" /> A/B</Badge>
          )}
        </div>
        <Dropdown
          trigger={
            <button className="w-6 h-6 flex items-center justify-center rounded text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#222530]">
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          }
          items={[
            { label: 'Edit', onClick: onEdit },
            {
              label: duplicating ? 'Duplicating...' : 'Duplicate',
              icon: <Copy className="w-3.5 h-3.5" />,
              onClick: () => !duplicating && onDuplicate(flow.id),
            },
            ...(!isArchived ? [{
              label: flow.status === 'ACTIVE' ? 'Pause' : 'Activate',
              icon: flow.status === 'ACTIVE' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />,
              onClick: () => onToggle(flow.id),
            }] : []),
            { divider: true },
            ...(!isArchived ? [{
              label: archiving ? 'Archiving...' : 'Archive',
              icon: <Archive className="w-3.5 h-3.5" />,
              onClick: () => !archiving && onArchive(flow.id),
              danger: true,
            }] : []),
          ]}
        />
      </div>

      <button onClick={onEdit} className="text-left w-full mb-3">
        <h3 className="text-sm font-semibold text-[#F0F2FF] hover:text-blue-400 transition-colors">{flow.name}</h3>
        <p className="text-xs text-[#8B90A7] mt-1">{TRIGGER_LABELS[flow.trigger_type]}</p>
      </button>

      <div className="flex items-center gap-1 mb-3">
        {platforms.map(p => (
          <span key={p} className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${p === 'INSTAGRAM' ? 'text-pink-400 border-pink-400/20 bg-pink-400/10' : p === 'FACEBOOK' ? 'text-blue-400 border-blue-400/20 bg-blue-400/10' : 'text-cyan-400 border-cyan-400/20 bg-cyan-400/10'}`}>
            {p.charAt(0) + p.slice(1).toLowerCase()}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1E2130]">
        <div>
          <p className="text-[10px] text-[#4B5068] uppercase tracking-wider mb-0.5">Triggered</p>
          <p className="text-sm font-semibold text-[#F0F2FF]">{flow.triggered_count.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#4B5068] uppercase tracking-wider mb-0.5">Conv%</p>
          <p className="text-sm font-semibold text-green-400">{pct}%</p>
        </div>
        <div>
          <p className="text-[10px] text-[#4B5068] uppercase tracking-wider mb-0.5">Revenue</p>
          <p className="text-sm font-semibold text-[#F0F2FF]">${flow.revenue_attributed.toLocaleString()}</p>
        </div>
      </div>

      <p className="text-[10px] text-[#4B5068] mt-2">
        Updated {formatDistanceToNow(new Date(flow.updated_at))} ago
      </p>
    </Card>
  );
}

function FlowTable({
  flows, onToggle, onEdit, onDuplicate, onArchive,
}: {
  flows: Flow[];
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const pct = (f: Flow) => f.triggered_count > 0 ? Math.round((f.conversion_count / f.triggered_count) * 100) : 0;

  return (
    <div className="bg-[#111318] border border-[#1E2130] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b border-[#1E2130]">
            {['Name', 'Status', 'Trigger', 'Triggered', 'Conv%', 'Revenue', 'Last Edit', ''].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {flows.map(f => (
            <tr key={f.id} className={`border-b border-[#1E2130] hover:bg-[#1A1C24] transition-colors ${f.status === 'ARCHIVED' ? 'opacity-60' : ''}`}>
              <td className="px-4 py-3">
                <button onClick={() => onEdit(f.id)} className="text-sm font-medium text-[#F0F2FF] hover:text-blue-400">{f.name}</button>
              </td>
              <td className="px-4 py-3">
                <button onClick={() => f.status !== 'ARCHIVED' && onToggle(f.id)}>
                  <Badge variant={f.status === 'ACTIVE' ? 'success' : f.status === 'PAUSED' ? 'warning' : 'default'}>
                    {f.status.charAt(0) + f.status.slice(1).toLowerCase()}
                  </Badge>
                </button>
              </td>
              <td className="px-4 py-3 text-xs text-[#8B90A7]">{TRIGGER_LABELS[f.trigger_type]}</td>
              <td className="px-4 py-3 text-sm text-[#F0F2FF]">{f.triggered_count.toLocaleString()}</td>
              <td className="px-4 py-3 text-sm font-semibold text-green-400">{pct(f)}%</td>
              <td className="px-4 py-3 text-sm text-[#F0F2FF]">${f.revenue_attributed.toLocaleString()}</td>
              <td className="px-4 py-3 text-xs text-[#4B5068]">{formatDistanceToNow(new Date(f.updated_at))} ago</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <button onClick={() => onEdit(f.id)} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded bg-blue-500/10">Edit</button>
                  <button onClick={() => onDuplicate(f.id)} className="text-xs text-[#8B90A7] hover:text-[#F0F2FF] px-2 py-1 rounded hover:bg-[#222530]">Copy</button>
                  {f.status !== 'ARCHIVED' && (
                    <button onClick={() => onArchive(f.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10">Archive</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
