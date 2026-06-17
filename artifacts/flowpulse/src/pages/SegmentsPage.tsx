import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Users, Filter, Trash2, Edit2, Send, MoreVertical,
  ChevronRight, X, CheckCircle2, Clock, UserPlus, Layers, Tag,
  AlertTriangle, ArrowRight, RefreshCw, Copy,
} from 'lucide-react';
import { Button, Badge, Modal, Input, Select, EmptyState, MetricCard, Tabs, Dropdown } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { formatDistanceToNow, format } from 'date-fns';

// ---- Types ----------------------------------------------------------------

type FilterField = 'loyalty_tier' | 'tags' | 'platform' | 'sentiment_score';
type FilterOperator = 'eq' | 'neq' | 'contains' | 'gt' | 'lt';

interface FilterRule {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string;
}

interface Segment {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  filter_rules: FilterRule[];
  member_count: number;
  created_at: string;
  updated_at: string;
}

interface ContactRow {
  id: string;
  display_name: string;
  email: string | null;
  loyalty_tier: string;
  sentiment_score: number;
  tags: string[];
  created_at: string;
}

// ---- Constants -------------------------------------------------------------

const FIELD_OPTIONS: { value: FilterField; label: string }[] = [
  { value: 'loyalty_tier', label: 'Loyalty Tier' },
  { value: 'tags', label: 'Tags' },
  { value: 'platform', label: 'Platform' },
  { value: 'sentiment_score', label: 'Sentiment Score' },
];

const OPERATOR_OPTIONS: Record<FilterField, { value: FilterOperator; label: string }[]> = {
  loyalty_tier: [
    { value: 'eq', label: 'is' },
    { value: 'neq', label: 'is not' },
  ],
  tags: [
    { value: 'contains', label: 'contains' },
    { value: 'eq', label: 'equals' },
  ],
  platform: [
    { value: 'eq', label: 'is' },
    { value: 'neq', label: 'is not' },
  ],
  sentiment_score: [
    { value: 'gt', label: 'greater than' },
    { value: 'lt', label: 'less than' },
    { value: 'eq', label: 'equals' },
  ],
};

const VALUE_OPTIONS: Partial<Record<FilterField, { value: string; label: string }[]>> = {
  loyalty_tier: [
    { value: 'NEWBIE', label: 'Newbie' },
    { value: 'FAN', label: 'Fan' },
    { value: 'ADVOCATE', label: 'Advocate' },
  ],
  platform: [
    { value: 'INSTAGRAM', label: 'Instagram' },
    { value: 'FACEBOOK', label: 'Facebook' },
    { value: 'TIKTOK', label: 'TikTok' },
  ],
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyRule(): FilterRule {
  return { id: uid(), field: 'loyalty_tier', operator: 'eq', value: 'FAN' };
}

// ---- Filter badge helpers --------------------------------------------------

function ruleSummary(rule: FilterRule): string {
  const fieldLabel = FIELD_OPTIONS.find(f => f.value === rule.field)?.label ?? rule.field;
  const opLabel = OPERATOR_OPTIONS[rule.field]?.find(o => o.value === rule.operator)?.label ?? rule.operator;
  const valLabel = VALUE_OPTIONS[rule.field]?.find(v => v.value === rule.value)?.label ?? rule.value;
  return `${fieldLabel} ${opLabel} ${valLabel}`;
}

function filterVariant(field: FilterField): 'info' | 'success' | 'warning' | 'default' {
  switch (field) {
    case 'loyalty_tier': return 'info';
    case 'platform': return 'warning';
    case 'tags': return 'success';
    default: return 'default';
  }
}

// ---- Demo data seed --------------------------------------------------------

const DEMO_SEGMENTS: Segment[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440B01',
    tenant_id: 'demo',
    name: 'VIP Advocates',
    description: 'Top-tier contacts who have reached Advocate status on any platform.',
    filter_rules: [{ id: '1', field: 'loyalty_tier', operator: 'eq', value: 'ADVOCATE' }],
    member_count: 342,
    created_at: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440B02',
    tenant_id: 'demo',
    name: 'Instagram Fans',
    description: 'Fan-level users on Instagram — primed for engagement upsells.',
    filter_rules: [
      { id: '2', field: 'platform', operator: 'eq', value: 'INSTAGRAM' },
      { id: '3', field: 'loyalty_tier', operator: 'eq', value: 'FAN' },
    ],
    member_count: 1204,
    created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440B03',
    tenant_id: 'demo',
    name: 'High-Sentiment TikTok',
    description: 'Positive sentiment contacts on TikTok — best for product launches.',
    filter_rules: [
      { id: '4', field: 'platform', operator: 'eq', value: 'TIKTOK' },
      { id: '5', field: 'sentiment_score', operator: 'gt', value: '0.5' },
    ],
    member_count: 578,
    created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440B04',
    tenant_id: 'demo',
    name: 'New Arrivals',
    description: 'All fresh contacts regardless of platform — ideal for onboarding flows.',
    filter_rules: [{ id: '6', field: 'loyalty_tier', operator: 'eq', value: 'NEWBIE' }],
    member_count: 2891,
    created_at: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440B05',
    tenant_id: 'demo',
    name: 'VIP Tag Holders',
    description: 'Contacts manually tagged as "vip" across all platforms.',
    filter_rules: [{ id: '7', field: 'tags', operator: 'contains', value: 'vip' }],
    member_count: 87,
    created_at: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
  },
];

// ---- FilterRow component ---------------------------------------------------

interface FilterRowProps {
  rule: FilterRule;
  onChange: (rule: FilterRule) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function FilterRow({ rule, onChange, onRemove, canRemove }: FilterRowProps) {
  const ops = OPERATOR_OPTIONS[rule.field] || [];
  const vals = VALUE_OPTIONS[rule.field];

  const handleFieldChange = (field: FilterField) => {
    const firstOp = (OPERATOR_OPTIONS[field]?.[0]?.value as FilterOperator) ?? 'eq';
    const firstVal = VALUE_OPTIONS[field]?.[0]?.value ?? '';
    onChange({ ...rule, field, operator: firstOp, value: firstVal });
  };

  return (
    <div className="flex items-start gap-2 group">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Select
          options={FIELD_OPTIONS}
          value={rule.field}
          onChange={e => handleFieldChange(e.target.value as FilterField)}
        />
        <Select
          options={ops}
          value={rule.operator}
          onChange={e => onChange({ ...rule, operator: e.target.value as FilterOperator })}
        />
        {vals ? (
          <Select
            options={vals}
            value={rule.value}
            onChange={e => onChange({ ...rule, value: e.target.value })}
          />
        ) : (
          <Input
            value={rule.value}
            onChange={e => onChange({ ...rule, value: e.target.value })}
            placeholder="value..."
          />
        )}
      </div>
      <button
        onClick={onRemove}
        disabled={!canRemove}
        className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-colors flex-shrink-0 ${canRemove ? 'border-[#2A2E42] text-[#4B5068] hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/10' : 'border-transparent text-transparent pointer-events-none'}`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ---- Live preview hook -----------------------------------------------------

function useLiveCount(_rules: FilterRule[], _tenantId: string | undefined, _debounceMs = 600) {
  // Live count estimation endpoint to be wired in a future iteration
  return { count: null as number | null, loading: false };
}

// ---- Main Page -------------------------------------------------------------

export function SegmentsPage() {
  const navigate = useNavigate();
  const { tenant, brand } = useAuth();

  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showAddContacts, setShowAddContacts] = useState(false);

  const [activeSegment, setActiveSegment] = useState<Segment | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Create / Edit form
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formRules, setFormRules] = useState<FilterRule[]>([emptyRule()]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [nameError, setNameError] = useState('');

  // Detail view
  const [detailContacts, setDetailContacts] = useState<ContactRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('contacts');

  // Add contacts
  const [bulkContactIds, setBulkContactIds] = useState('');
  const [addingContacts, setAddingContacts] = useState(false);

  // Live count (for modal)
  const { count: liveCount, loading: liveCountLoading } = useLiveCount(formRules, tenant?.id);

  // ---- Load segments -------------------------------------------------------

  useEffect(() => {
    if (!tenant) return;
    loadSegments();
  }, [tenant]);

  async function loadSegments() {
    if (!tenant) return;
    setLoading(true);
    // Segments API endpoint to be wired in a future iteration — show demo data
    setSegments(DEMO_SEGMENTS);
    setLoading(false);
  }

  // ---- Load detail contacts ------------------------------------------------

  async function loadDetailContacts(_segment: Segment) {
    setDetailLoading(true);
    // Segment contact detail endpoint to be wired in a future iteration
    setDetailContacts([]);
    setDetailLoading(false);
  }

  // ---- Open Detail ---------------------------------------------------------

  function openDetail(seg: Segment) {
    setActiveSegment(seg);
    setDetailTab('contacts');
    setShowDetail(true);
    loadDetailContacts(seg);
  }

  // ---- Open Create ---------------------------------------------------------

  function openCreate() {
    setIsEditing(false);
    setFormName('');
    setFormDesc('');
    setFormRules([emptyRule()]);
    setNameError('');
    setShowCreate(true);
  }

  // ---- Open Edit -----------------------------------------------------------

  function openEdit(seg: Segment) {
    setIsEditing(true);
    setActiveSegment(seg);
    setFormName(seg.name);
    setFormDesc(seg.description ?? '');
    setFormRules(seg.filter_rules.length > 0 ? seg.filter_rules.map(r => ({ ...r })) : [emptyRule()]);
    setNameError('');
    setShowCreate(true);
  }

  // ---- Save ----------------------------------------------------------------

  async function handleSave() {
    if (!formName.trim()) { setNameError('Name is required'); return; }
    if (!tenant) return;
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDesc.trim() || null,
        filter_rules: formRules,
        updated_at: new Date().toISOString(),
      };

      if (isEditing && activeSegment) {
        // Local update — persist via API in a future iteration
        setSegments(prev => prev.map(s => s.id === activeSegment.id ? { ...s, ...payload } : s));
      } else {
        {
          // Local insert — persist via API in a future iteration
          const newSeg: Segment = {
            id: uid(),
            tenant_id: tenant.id,
            ...payload,
            description: payload.description,
            member_count: liveCount ?? 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setSegments(prev => [newSeg, ...prev]);
        }
      }

      setShowCreate(false);
    } catch {
      setShowCreate(false);
    } finally {
      setSaving(false);
    }
  }

  // ---- Delete --------------------------------------------------------------

  async function handleDelete() {
    if (!activeSegment) return;
    setDeleting(true);
    try {
      // Segments delete API to be wired in a future iteration
      setSegments(prev => prev.filter(s => s.id !== activeSegment.id));
      setShowDelete(false);
      setShowDetail(false);
      setActiveSegment(null);
    } finally {
      setDeleting(false);
    }
  }

  // ---- Bulk add contacts ---------------------------------------------------

  async function handleBulkAdd() {
    if (!activeSegment || !bulkContactIds.trim()) return;
    setAddingContacts(true);
    try {
      const ids = bulkContactIds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      // Bulk add API to be wired in a future iteration
      setBulkContactIds('');
      setShowAddContacts(false);
      // Refresh member count
      setSegments(prev => prev.map(s => s.id === activeSegment.id ? { ...s, member_count: s.member_count + ids.length } : s));
    } catch {
      // silently ignore
    } finally {
      setAddingContacts(false);
    }
  }

  // ---- Filter rows helpers -------------------------------------------------

  function addRule() {
    setFormRules(r => [...r, emptyRule()]);
  }

  function updateRule(idx: number, rule: FilterRule) {
    setFormRules(r => r.map((x, i) => i === idx ? rule : x));
  }

  function removeRule(idx: number) {
    setFormRules(r => r.length > 1 ? r.filter((_, i) => i !== idx) : r);
  }

  // ---- Computed values -----------------------------------------------------

  const filtered = segments.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const totalMembers = segments.reduce((sum, s) => sum + (s.member_count ?? 0), 0);

  const sentimentLabel = (score: number) => {
    if (score > 0.3) return { label: 'Positive', cls: 'text-green-400' };
    if (score > -0.3) return { label: 'Neutral', cls: 'text-amber-400' };
    return { label: 'Negative', cls: 'text-red-400' };
  };

  // ---- Render --------------------------------------------------------------

  return (
    <div className="p-4 md:p-6 max-w-[1400px]">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#F0F2FF]">Segments</h1>
          <p className="text-xs text-[#8B90A7] mt-0.5">
            {segments.length} segment{segments.length !== 1 ? 's' : ''} &middot; {totalMembers.toLocaleString()} total members
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Create Segment
        </Button>
      </div>

      {/* ---- Metric cards ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Total Segments"
          value={segments.length}
          icon={<Layers className="w-4 h-4" />}
          iconColor="text-blue-400"
          subtitle="Active groups"
        />
        <MetricCard
          label="Total Members"
          value={totalMembers.toLocaleString()}
          icon={<Users className="w-4 h-4" />}
          iconColor="text-green-400"
          subtitle="Across all segments"
        />
        <MetricCard
          label="Largest Segment"
          value={segments.length > 0 ? Math.max(...segments.map(s => s.member_count)).toLocaleString() : '—'}
          icon={<Tag className="w-4 h-4" />}
          iconColor="text-amber-400"
          subtitle={segments.length > 0 ? (segments.reduce((a, b) => a.member_count > b.member_count ? a : b, segments[0])?.name ?? '—') : '—'}
        />
        <MetricCard
          label="Avg. Members"
          value={segments.length > 0 ? Math.round(totalMembers / segments.length).toLocaleString() : '—'}
          icon={<Filter className="w-4 h-4" />}
          iconColor="text-purple-400"
          subtitle="Per segment"
        />
      </div>

      {/* ---- Search bar ---- */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4B5068]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search segments..."
            className="h-9 w-full pl-9 pr-3 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] placeholder:text-[#4B5068] focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={loadSegments}>
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* ---- Loading ---- */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
          <span className="ml-3 text-sm text-[#8B90A7]">Loading segments…</span>
        </div>
      )}

      {/* ---- Grid ---- */}
      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={<Layers className="w-8 h-8" />}
          title={search ? 'No segments match your search' : 'No segments yet'}
          description={search ? 'Try a different search term.' : 'Create a segment to group contacts by shared attributes for targeted broadcasts and flows.'}
          action={!search ? <Button variant="primary" onClick={openCreate}><Plus className="w-4 h-4" /> Create Segment</Button> : undefined}
        />
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(seg => (
            <SegmentCard
              key={seg.id}
              segment={seg}
              onOpen={() => openDetail(seg)}
              onEdit={() => openEdit(seg)}
              onDelete={() => { setActiveSegment(seg); setShowDelete(true); }}
              onUseBroadcast={() => navigate(`/broadcasts?segment=${seg.id}`)}
            />
          ))}
        </div>
      )}

      {/* ==================================================================
          Modal: Create / Edit Segment
      ================================================================== */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={isEditing ? 'Edit Segment' : 'Create Segment'}
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              {isEditing ? 'Save Changes' : 'Create Segment'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Name */}
          <Input
            label="Segment name"
            value={formName}
            onChange={e => { setFormName(e.target.value); if (e.target.value) setNameError(''); }}
            placeholder="e.g. VIP Advocates"
            error={nameError}
            autoFocus
          />

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#8B90A7]">Description <span className="text-[#4B5068]">(optional)</span></label>
            <textarea
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              placeholder="What is this segment for?"
              rows={2}
              className="w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-[#F0F2FF] placeholder:text-[#4B5068] px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
            />
          </div>

          {/* Filter Builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[#8B90A7] uppercase tracking-wider">Filter Rules</label>
              <span className="text-[10px] text-[#4B5068]">Match ALL conditions below</span>
            </div>
            <div className="space-y-2 p-3 rounded-xl bg-[#111318] border border-[#1E2130]">
              {formRules.map((rule, idx) => (
                <FilterRow
                  key={rule.id}
                  rule={rule}
                  onChange={r => updateRule(idx, r)}
                  onRemove={() => removeRule(idx)}
                  canRemove={formRules.length > 1}
                />
              ))}
              <button
                onClick={addRule}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mt-2 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add filter rule
              </button>
            </div>
          </div>

          {/* Live count preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1">
              {liveCountLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-[#8B90A7]">Calculating…</span>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-[#F0F2FF]">
                    {liveCount !== null ? liveCount.toLocaleString() : '—'} matching contacts
                  </p>
                  <p className="text-[10px] text-[#8B90A7]">Live preview based on current filter rules</p>
                </>
              )}
            </div>
            {liveCount !== null && !liveCountLoading && (
              <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
            )}
          </div>
        </div>
      </Modal>

      {/* ==================================================================
          Modal: Segment Detail
      ================================================================== */}
      {activeSegment && (
        <Modal
          open={showDetail}
          onClose={() => setShowDetail(false)}
          title={activeSegment.name}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4">
            {/* Meta row */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-[#8B90A7]">
                <Clock className="w-3.5 h-3.5" />
                Created {formatDistanceToNow(new Date(activeSegment.created_at))} ago
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#8B90A7]">
                <Users className="w-3.5 h-3.5" />
                {activeSegment.member_count.toLocaleString()} members
              </div>
              {activeSegment.description && (
                <p className="text-xs text-[#8B90A7] flex-1">{activeSegment.description}</p>
              )}
            </div>

            {/* Filter rule badges */}
            {activeSegment.filter_rules.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeSegment.filter_rules.map((r, i) => (
                  <Badge key={i} variant={filterVariant(r.field)}>
                    <Filter className="w-3 h-3" />
                    {ruleSummary(r)}
                  </Badge>
                ))}
              </div>
            )}

            {/* Action row */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button variant="primary" size="sm" onClick={() => navigate(`/broadcasts?segment=${activeSegment.id}`)}>
                <Send className="w-3.5 h-3.5" /> Use in Broadcast
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setShowDetail(false); openEdit(activeSegment); }}>
                <Edit2 className="w-3.5 h-3.5" /> Edit Segment
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowAddContacts(true)}>
                <UserPlus className="w-3.5 h-3.5" /> Add Contacts
              </Button>
              <div className="flex-1" />
              <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            </div>

            {/* Tabs */}
            <Tabs
              tabs={[
                { id: 'contacts', label: 'Contacts', badge: detailContacts.length },
                { id: 'rules', label: 'Filter Rules', badge: activeSegment.filter_rules.length },
              ]}
              active={detailTab}
              onChange={setDetailTab}
            />

            {/* Contacts list */}
            {detailTab === 'contacts' && (
              <div className="bg-[#111318] border border-[#1E2130] rounded-xl overflow-hidden overflow-x-auto">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="ml-2 text-xs text-[#8B90A7]">Loading contacts…</span>
                  </div>
                ) : detailContacts.length === 0 ? (
                  <EmptyState
                    icon={<Users className="w-7 h-7" />}
                    title="No contacts in this segment yet"
                    description="Add contacts manually or adjust filter rules to match your audience."
                  />
                ) : (
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr className="border-b border-[#1E2130]">
                        {['Contact', 'Tier', 'Sentiment', 'Tags', 'Joined'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detailContacts.map(c => {
                        const s = sentimentLabel(c.sentiment_score ?? 0);
                        return (
                          <tr
                            key={c.id}
                            className="border-b border-[#1E2130] hover:bg-[#1A1C24] transition-colors cursor-pointer"
                            onClick={() => navigate(`/contacts/${c.id}`)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/30 to-violet-500/30 flex items-center justify-center text-xs font-bold text-blue-300">
                                  {(c.display_name ?? '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-[#F0F2FF]">{c.display_name ?? 'Unknown'}</p>
                                  <p className="text-[10px] text-[#4B5068]">{c.email ?? 'No email'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border ${
                                c.loyalty_tier === 'ADVOCATE' ? 'text-green-400 bg-green-400/10 border-green-400/20'
                                  : c.loyalty_tier === 'FAN' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                                  : 'text-gray-400 bg-gray-400/10 border-gray-400/20'
                              }`}>{c.loyalty_tier ?? 'NEWBIE'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium ${s.cls}`}>{s.label}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1 flex-wrap">
                                {(c.tags ?? []).slice(0, 3).map((t: string) => (
                                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#222530] text-[#8B90A7] border border-[#2A2E42]">{t}</span>
                                ))}
                                {(c.tags ?? []).length > 3 && <span className="text-[10px] text-[#4B5068]">+{(c.tags ?? []).length - 3}</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[10px] text-[#4B5068]">
                              {format(new Date(c.created_at), 'MMM d, yyyy')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {detailContacts.length > 0 && (
                  <div className="px-4 py-2 border-t border-[#1E2130] flex items-center justify-between">
                    <p className="text-[10px] text-[#4B5068]">Showing first 50 contacts</p>
                    <button
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      onClick={() => navigate(`/contacts?segment=${activeSegment.id}`)}
                    >
                      View all in Contacts <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Rules tab */}
            {detailTab === 'rules' && (
              <div className="space-y-2">
                {activeSegment.filter_rules.length === 0 ? (
                  <p className="text-xs text-[#8B90A7] py-4 text-center">No filter rules defined.</p>
                ) : (
                  activeSegment.filter_rules.map((rule, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#111318] border border-[#1E2130]">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-xs text-[#F0F2FF] font-medium">{ruleSummary(rule)}</p>
                        <p className="text-[10px] text-[#4B5068]">
                          Field: <span className="text-[#8B90A7]">{rule.field}</span> &middot;
                          Operator: <span className="text-[#8B90A7]">{rule.operator}</span> &middot;
                          Value: <span className="text-[#8B90A7]">{rule.value}</span>
                        </p>
                      </div>
                      <Badge variant={filterVariant(rule.field)}>{rule.field}</Badge>
                    </div>
                  ))
                )}
                <div className="pt-2">
                  <Button variant="secondary" size="sm" onClick={() => { setShowDetail(false); openEdit(activeSegment); }}>
                    <Edit2 className="w-3.5 h-3.5" /> Edit Filter Rules
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ==================================================================
          Modal: Delete Confirmation
      ================================================================== */}
      {activeSegment && (
        <Modal
          open={showDelete}
          onClose={() => setShowDelete(false)}
          title="Delete Segment"
          maxWidth="max-w-sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowDelete(false)}>Cancel</Button>
              <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete Segment</Button>
            </>
          }
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-[#F0F2FF] font-medium">
                Delete &ldquo;{activeSegment.name}&rdquo;?
              </p>
              <p className="text-xs text-[#8B90A7] mt-1">
                This will permanently remove the segment and its {activeSegment.member_count.toLocaleString()} members from all associated broadcasts and flows. This action cannot be undone.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* ==================================================================
          Modal: Bulk Add Contacts
      ================================================================== */}
      {activeSegment && (
        <Modal
          open={showAddContacts}
          onClose={() => setShowAddContacts(false)}
          title="Add Contacts Manually"
          maxWidth="max-w-md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowAddContacts(false)}>Cancel</Button>
              <Button variant="primary" loading={addingContacts} onClick={handleBulkAdd} disabled={!bulkContactIds.trim()}>
                <UserPlus className="w-3.5 h-3.5" /> Add Contacts
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-[#111318] border border-[#1E2130]">
              <p className="text-xs font-semibold text-[#F0F2FF] mb-1">Adding to: {activeSegment.name}</p>
              <p className="text-[10px] text-[#8B90A7]">Current members: {activeSegment.member_count.toLocaleString()}</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#8B90A7]">Contact IDs</label>
              <textarea
                value={bulkContactIds}
                onChange={e => setBulkContactIds(e.target.value)}
                placeholder={'Paste contact IDs separated by commas or newlines\ne.g.\nuuid-1\nuuid-2, uuid-3'}
                rows={6}
                className="w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-[#F0F2FF] placeholder:text-[#4B5068] px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none font-mono"
              />
              <p className="text-[10px] text-[#4B5068]">
                {bulkContactIds.trim() ? `${bulkContactIds.split(/[\n,]+/).filter(s => s.trim()).length} IDs detected` : 'Separate IDs with newlines or commas'}
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---- Segment Card ----------------------------------------------------------

interface SegmentCardProps {
  segment: Segment;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUseBroadcast: () => void;
}

function SegmentCard({ segment, onOpen, onEdit, onDelete, onUseBroadcast }: SegmentCardProps) {
  return (
    <div
      className="bg-[#111318] border border-[#2A2E42] rounded-xl p-4 cursor-pointer hover:border-blue-500/30 hover:bg-[#141620] transition-all duration-150 group flex flex-col gap-3"
      onClick={onOpen}
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
          <Layers className="w-4 h-4 text-blue-400" />
        </div>
        <div onClick={e => e.stopPropagation()}>
          <Dropdown
            trigger={
              <button className="w-7 h-7 flex items-center justify-center rounded-lg text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#1A1C24] opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            }
            items={[
              { label: 'View Details', icon: <ChevronRight className="w-3.5 h-3.5" />, onClick: onOpen },
              { label: 'Edit Segment', icon: <Edit2 className="w-3.5 h-3.5" />, onClick: onEdit },
              { label: 'Use in Broadcast', icon: <Send className="w-3.5 h-3.5" />, onClick: onUseBroadcast },
              { divider: true, label: '' },
              { label: 'Delete Segment', icon: <Trash2 className="w-3.5 h-3.5" />, onClick: onDelete, danger: true },
            ]}
          />
        </div>
      </div>

      {/* Name & description */}
      <div>
        <h3 className="text-sm font-semibold text-[#F0F2FF] group-hover:text-blue-300 transition-colors leading-snug">{segment.name}</h3>
        {segment.description && (
          <p className="text-xs text-[#8B90A7] mt-1 line-clamp-2 leading-relaxed">{segment.description}</p>
        )}
      </div>

      {/* Filter rule badges */}
      {segment.filter_rules.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {segment.filter_rules.slice(0, 3).map((r, i) => (
            <Badge key={i} variant={filterVariant(r.field)}>
              {ruleSummary(r)}
            </Badge>
          ))}
          {segment.filter_rules.length > 3 && (
            <Badge variant="default">+{segment.filter_rules.length - 3} more</Badge>
          )}
        </div>
      )}

      {/* Bottom stats row */}
      <div className="flex items-center justify-between pt-2 border-t border-[#1E2130]">
        <div className="flex items-center gap-1.5 text-xs text-[#8B90A7]">
          <Users className="w-3.5 h-3.5" />
          <span className="font-semibold text-[#F0F2FF]">{segment.member_count.toLocaleString()}</span> members
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[#4B5068]">
          <Clock className="w-3 h-3" />
          {formatDistanceToNow(new Date(segment.created_at))} ago
        </div>
      </div>

      {/* Broadcast CTA — shown on hover */}
      <button
        onClick={e => { e.stopPropagation(); onUseBroadcast(); }}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-[#2A2E42] text-xs text-[#4B5068] hover:border-blue-500/40 hover:text-blue-400 hover:bg-blue-500/5 transition-all opacity-0 group-hover:opacity-100"
      >
        <Send className="w-3 h-3" /> Use in Broadcast
      </button>
    </div>
  );
}
