import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  QrCode,
  MousePointerClick,
  Globe,
  Share2,
  Copy,
  Check,
  Trash2,
  Eye,
  TrendingUp,
  Users,
  BarChart3,
  ChevronRight,
  Instagram,
  Facebook,
  Zap,
  Link2,
  Code2,
  AlertTriangle,
  RefreshCw,
  Palette,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';
import { Button, Card, Modal, Badge, Tabs, Input, Select, Toggle, EmptyState, MetricCard } from '../components/ui';
import { useAuth } from '../hooks/useAuth';

// ---- Types ----
type ToolType = 'qr_code' | 'click_to_message' | 'website_widget' | 'referral_link';
type Platform = 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK';
type WidgetPosition = 'bottom-right' | 'bottom-left';

interface GrowthTool {
  id: string;
  tenant_id: string;
  brand_id: string;
  tool_type: ToolType;
  name: string;
  platform?: Platform;
  linked_flow_id?: string;
  linked_flow_name?: string;
  config: Record<string, unknown>;
  click_count: number;
  conversion_count: number;
  is_active: boolean;
  created_at: string;
}

// ---- Demo seed data ----
const DEMO_TOOLS: GrowthTool[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440C01',
    tenant_id: '',
    brand_id: '',
    tool_type: 'qr_code',
    name: 'Store Entrance QR',
    platform: 'INSTAGRAM',
    linked_flow_id: 'flow-1',
    linked_flow_name: 'Welcome Flow',
    config: { qr_color: '#3B82F6', destination: 'https://ig.me/m/flowpulse_demo' },
    click_count: 1842,
    conversion_count: 1204,
    is_active: true,
    created_at: new Date(Date.now() - 12 * 24 * 3600000).toISOString(),
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440C02',
    tenant_id: '',
    brand_id: '',
    tool_type: 'click_to_message',
    name: 'Summer Sale Ad CTA',
    platform: 'FACEBOOK',
    linked_flow_id: 'flow-2',
    linked_flow_name: 'Sale Funnel',
    config: { ad_reference: 'fb-ad-2024-summer', url: 'https://m.me/flowpulse_demo?ref=summer_sale' },
    click_count: 3291,
    conversion_count: 2108,
    is_active: true,
    created_at: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440C03',
    tenant_id: '',
    brand_id: '',
    tool_type: 'website_widget',
    name: 'Homepage Chat Widget',
    platform: 'INSTAGRAM',
    linked_flow_id: 'flow-1',
    linked_flow_name: 'Welcome Flow',
    config: {
      position: 'bottom-right',
      greeting: 'Hi! Chat with us on Instagram for exclusive deals.',
      accent_color: '#8B5CF6',
    },
    click_count: 728,
    conversion_count: 412,
    is_active: true,
    created_at: new Date(Date.now() - 20 * 24 * 3600000).toISOString(),
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440C04',
    tenant_id: '',
    brand_id: '',
    tool_type: 'referral_link',
    name: 'VIP Referral Program',
    platform: 'INSTAGRAM',
    linked_flow_id: 'flow-3',
    linked_flow_name: 'Referral Onboarding',
    config: { reward_description: '15% off for you + your friend', url: 'https://fp.ly/ref/vip-ig' },
    click_count: 564,
    conversion_count: 198,
    is_active: false,
    created_at: new Date(Date.now() - 30 * 24 * 3600000).toISOString(),
  },
];

const MOCK_FLOWS = [
  { value: 'flow-1', label: 'Welcome Flow' },
  { value: 'flow-2', label: 'Sale Funnel' },
  { value: 'flow-3', label: 'Referral Onboarding' },
  { value: 'flow-4', label: 'Abandoned Cart Recovery' },
];

const PLATFORM_OPTIONS = [
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'TIKTOK', label: 'TikTok' },
];

const WIDGET_POSITION_OPTIONS = [
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
];

// ---- Helpers ----
function toolTypeLabel(type: ToolType): string {
  return {
    qr_code: 'QR Code',
    click_to_message: 'Click-to-Message',
    website_widget: 'Website Widget',
    referral_link: 'Referral Link',
  }[type];
}

function toolTypeIcon(type: ToolType, size = 16): React.ReactNode {
  const cls = `w-${size === 16 ? 4 : 5} h-${size === 16 ? 4 : 5}`;
  if (type === 'qr_code') return <QrCode className={cls} />;
  if (type === 'click_to_message') return <MousePointerClick className={cls} />;
  if (type === 'website_widget') return <Globe className={cls} />;
  return <Share2 className={cls} />;
}

function toolTypeColor(type: ToolType): string {
  return {
    qr_code: 'text-violet-400 bg-violet-500/15 border-violet-500/20',
    click_to_message: 'text-blue-400 bg-blue-500/15 border-blue-500/20',
    website_widget: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
    referral_link: 'text-amber-400 bg-amber-500/15 border-amber-500/20',
  }[type];
}

function platformBadgeVariant(p?: Platform): 'platform' {
  return 'platform';
}

function conversionRate(clicks: number, conversions: number): string {
  if (clicks === 0) return '0%';
  return `${((conversions / clicks) * 100).toFixed(1)}%`;
}

function generateQRDataUrl(text: string, color: string): string {
  // Deterministic SVG QR placeholder that looks real
  const cells: boolean[][] = [];
  const size = 21;
  for (let r = 0; r < size; r++) {
    cells[r] = [];
    for (let c = 0; c < size; c++) {
      // finder patterns
      const inFinder =
        (r < 7 && c < 7) ||
        (r < 7 && c >= size - 7) ||
        (r >= size - 7 && c < 7);
      if (inFinder) {
        const lr = r < 7 ? r : r - (size - 7);
        const lc = c < 7 ? c : c - (size - 7);
        const innerR = r < 7 ? r : r - (size - 7);
        const innerC = c < 7 ? c : c - (size - 7);
        const onBorder = lr === 0 || lr === 6 || lc === 0 || lc === 6;
        const onInner = innerR >= 2 && innerR <= 4 && innerC >= 2 && innerC <= 4;
        cells[r][c] = onBorder || onInner;
      } else {
        // pseudo-random data area
        const hash = ((r * 31 + c * 17 + text.charCodeAt((r + c) % Math.max(text.length, 1)) * 7) * 2654435761) >>> 0;
        cells[r][c] = (hash % 3) !== 0;
      }
    }
  }

  const cellSize = 8;
  const svgSize = size * cellSize + 16;
  let rects = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cells[r][c]) {
        rects += `<rect x="${c * cellSize + 8}" y="${r * cellSize + 8}" width="${cellSize}" height="${cellSize}" fill="${color}" />`;
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}"><rect width="${svgSize}" height="${svgSize}" fill="white"/>${rects}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function generateEmbedSnippet(tool: GrowthTool): string {
  const pos = (tool.config.position as string) || 'bottom-right';
  const color = (tool.config.accent_color as string) || '#3B82F6';
  const greeting = (tool.config.greeting as string) || 'Chat with us on Instagram!';
  const igHandle = 'your_instagram_handle';
  return `<!-- FlowPulse Widget -->
<script>
  window.FP_WIDGET = {
    handle: "${igHandle}",
    position: "${pos}",
    accentColor: "${color}",
    greeting: "${greeting}",
    flowRef: "${tool.linked_flow_id || ''}"
  };
</script>
<script src="https://cdn.flowpulse.io/widget.js" async></script>`;
}

function generateClickToMessageUrl(tool: GrowthTool): string {
  const platform = tool.platform || 'INSTAGRAM';
  const ref = (tool.config.ad_reference as string) || tool.id.slice(-8);
  if (platform === 'INSTAGRAM') return `https://ig.me/m/your_ig_handle?ref=${ref}`;
  if (platform === 'FACEBOOK') return `https://m.me/your_page?ref=${ref}`;
  return `https://www.tiktok.com/@your_handle?dm_ref=${ref}`;
}

function generateReferralUrl(tool: GrowthTool): string {
  return (tool.config.url as string) || `https://fp.ly/ref/${tool.id.slice(-8)}`;
}

// ---- Create Form State ----
interface CreateFormState {
  name: string;
  tool_type: ToolType;
  platform: Platform;
  linked_flow_id: string;
  // QR Code
  qr_color: string;
  // Click-to-message
  ad_reference: string;
  // Website widget
  widget_position: WidgetPosition;
  greeting_text: string;
  accent_color: string;
  // Referral
  reward_description: string;
}

const defaultForm: CreateFormState = {
  name: '',
  tool_type: 'qr_code',
  platform: 'INSTAGRAM',
  linked_flow_id: '',
  qr_color: '#3B82F6',
  ad_reference: '',
  widget_position: 'bottom-right',
  greeting_text: 'Chat with us on Instagram for exclusive deals!',
  accent_color: '#3B82F6',
  reward_description: '',
};

// ---- Tool Card ----
interface ToolCardProps {
  tool: GrowthTool;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  onView: (tool: GrowthTool) => void;
}

function ToolCard({ tool, onToggle, onDelete, onView }: ToolCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleting(true);
    onDelete(tool.id);
  };

  const rate = conversionRate(tool.click_count, tool.conversion_count);
  const typeColorCls = toolTypeColor(tool.tool_type);

  return (
    <Card className="flex flex-col gap-3 group relative overflow-hidden">
      {/* Subtle glow strip on active */}
      {tool.is_active && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500/0 via-blue-500/60 to-blue-500/0 rounded-t-xl" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${typeColorCls}`}>
            {toolTypeIcon(tool.tool_type, 16)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#F0F2FF] truncate leading-tight">{tool.name}</p>
            <p className="text-[10px] text-[#4B5068] mt-0.5">{toolTypeLabel(tool.tool_type)}</p>
          </div>
        </div>
        <Toggle checked={tool.is_active} onChange={(v) => onToggle(tool.id, v)} size="sm" />
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {tool.platform && (
          <Badge variant="platform" platform={tool.platform}>
            {tool.platform.charAt(0) + tool.platform.slice(1).toLowerCase()}
          </Badge>
        )}
        {tool.linked_flow_name && (
          <Badge variant="default">
            <Zap className="w-2.5 h-2.5" /> {tool.linked_flow_name}
          </Badge>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#0A0B0F] rounded-lg px-2.5 py-2 text-center">
          <p className="text-sm font-bold text-[#F0F2FF]">{tool.click_count.toLocaleString()}</p>
          <p className="text-[9px] text-[#4B5068] uppercase tracking-wide mt-0.5">Clicks</p>
        </div>
        <div className="bg-[#0A0B0F] rounded-lg px-2.5 py-2 text-center">
          <p className="text-sm font-bold text-[#F0F2FF]">{tool.conversion_count.toLocaleString()}</p>
          <p className="text-[9px] text-[#4B5068] uppercase tracking-wide mt-0.5">Convs</p>
        </div>
        <div className="bg-[#0A0B0F] rounded-lg px-2.5 py-2 text-center">
          <p className={`text-sm font-bold ${parseFloat(rate) >= 50 ? 'text-green-400' : parseFloat(rate) >= 25 ? 'text-amber-400' : 'text-[#F0F2FF]'}`}>{rate}</p>
          <p className="text-[9px] text-[#4B5068] uppercase tracking-wide mt-0.5">CVR</p>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-[#1E2130]">
        <Button variant="ghost" size="sm" className="flex-1 text-xs gap-1.5" onClick={() => onView(tool)}>
          <Eye className="w-3.5 h-3.5" /> View Details
        </Button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
            confirmDelete
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'text-[#4B5068] hover:text-red-400 hover:bg-red-500/10'
          }`}
          title={confirmDelete ? 'Click again to confirm' : 'Delete tool'}
        >
          {deleting ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </Card>
  );
}

// ---- Create Modal ----
interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (tool: Partial<GrowthTool>) => Promise<void>;
  defaultType?: ToolType;
}

function CreateModal({ open, onClose, onCreate, defaultType }: CreateModalProps) {
  const [form, setForm] = useState<CreateFormState>({ ...defaultForm, tool_type: defaultType ?? 'qr_code' });
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateFormState, string>>>({});

  useEffect(() => {
    if (open) setForm({ ...defaultForm, tool_type: defaultType ?? 'qr_code' });
  }, [open, defaultType]);

  const set = <K extends keyof CreateFormState>(key: K, val: CreateFormState[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (form.tool_type === 'click_to_message' && !form.ad_reference.trim())
      e.ad_reference = 'Ad reference is required';
    if (form.tool_type === 'referral_link' && !form.reward_description.trim())
      e.reward_description = 'Reward description is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCreate() {
    if (!validate()) return;
    setCreating(true);
    const config: Record<string, unknown> = {};
    if (form.tool_type === 'qr_code') {
      config.qr_color = form.qr_color;
      config.destination = form.platform === 'INSTAGRAM'
        ? 'https://ig.me/m/your_ig_handle'
        : form.platform === 'FACEBOOK'
        ? 'https://m.me/your_page'
        : 'https://vm.tiktok.com/your_link';
    } else if (form.tool_type === 'click_to_message') {
      config.ad_reference = form.ad_reference;
    } else if (form.tool_type === 'website_widget') {
      config.position = form.widget_position;
      config.greeting = form.greeting_text;
      config.accent_color = form.accent_color;
    } else if (form.tool_type === 'referral_link') {
      config.reward_description = form.reward_description;
      config.url = `https://fp.ly/ref/${Math.random().toString(36).slice(2, 9)}`;
    }

    const flowName = MOCK_FLOWS.find(f => f.value === form.linked_flow_id)?.label;

    await onCreate({
      tool_type: form.tool_type,
      name: form.name,
      platform: form.tool_type === 'website_widget' ? form.platform : form.platform,
      linked_flow_id: form.linked_flow_id || undefined,
      linked_flow_name: flowName,
      config,
      click_count: 0,
      conversion_count: 0,
      is_active: true,
    });
    setCreating(false);
  }

  const toolTypeTabs = [
    { id: 'qr_code', label: 'QR Code' },
    { id: 'click_to_message', label: 'Click-to-Msg' },
    { id: 'website_widget', label: 'Widget' },
    { id: 'referral_link', label: 'Referral' },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Growth Tool"
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleCreate} loading={creating}>
            {creating ? 'Creating...' : 'Create Tool'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Tool type selector */}
        <div>
          <label className="text-xs font-medium text-[#8B90A7] block mb-2">Tool Type</label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { type: 'qr_code' as ToolType, label: 'QR Code', desc: 'Scannable code for DMs', icon: <QrCode className="w-4 h-4" />, color: 'text-violet-400' },
                { type: 'click_to_message' as ToolType, label: 'Click-to-Message', desc: 'Ad CTA links', icon: <MousePointerClick className="w-4 h-4" />, color: 'text-blue-400' },
                { type: 'website_widget' as ToolType, label: 'Website Widget', desc: 'Embeddable chat', icon: <Globe className="w-4 h-4" />, color: 'text-emerald-400' },
                { type: 'referral_link' as ToolType, label: 'Referral Link', desc: 'Tracked share links', icon: <Share2 className="w-4 h-4" />, color: 'text-amber-400' },
              ] as const
            ).map(({ type, label, desc, icon, color }) => (
              <button
                key={type}
                type="button"
                onClick={() => set('tool_type', type)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  form.tool_type === type
                    ? 'border-blue-500/40 bg-blue-500/8 ring-1 ring-blue-500/20'
                    : 'border-[#2A2E42] hover:border-[#3A3E52]'
                }`}
              >
                <div className={`mb-1.5 ${color}`}>{icon}</div>
                <p className="text-xs font-semibold text-[#F0F2FF]">{label}</p>
                <p className="text-[10px] text-[#4B5068] mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Common fields */}
        <Input
          label="Tool Name"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder={
            form.tool_type === 'qr_code' ? 'e.g. Store Entrance QR' :
            form.tool_type === 'click_to_message' ? 'e.g. Summer Sale Ad CTA' :
            form.tool_type === 'website_widget' ? 'e.g. Homepage Chat Widget' :
            'e.g. VIP Referral Program'
          }
          error={errors.name}
        />

        {form.tool_type !== 'website_widget' && (
          <Select
            label="Platform"
            value={form.platform}
            onChange={e => set('platform', e.target.value as Platform)}
            options={PLATFORM_OPTIONS}
          />
        )}

        <Select
          label="Linked Flow (optional)"
          value={form.linked_flow_id}
          onChange={e => set('linked_flow_id', e.target.value)}
          options={[{ value: '', label: 'No flow linked' }, ...MOCK_FLOWS]}
        />

        {/* Type-specific fields */}
        {form.tool_type === 'qr_code' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#8B90A7]">QR Code Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.qr_color}
                onChange={e => set('qr_color', e.target.value)}
                className="w-9 h-9 rounded-lg border border-[#2A2E42] bg-[#1A1C24] cursor-pointer p-0.5"
              />
              <span className="text-sm font-mono text-[#F0F2FF]">{form.qr_color}</span>
              <div className="flex gap-1.5 ml-auto">
                {['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set('qr_color', c)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${form.qr_color === c ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            {/* Live QR preview */}
            {form.name && (
              <div className="mt-2 flex justify-center">
                <div className="p-3 bg-white rounded-xl inline-block">
                  <img
                    src={generateQRDataUrl(form.name + form.platform, form.qr_color)}
                    alt="QR Preview"
                    className="w-24 h-24"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {form.tool_type === 'click_to_message' && (
          <Input
            label="Ad Reference / UTM Tag"
            value={form.ad_reference}
            onChange={e => set('ad_reference', e.target.value)}
            placeholder="e.g. fb-ad-2024-summer"
            error={errors.ad_reference}
          />
        )}

        {form.tool_type === 'website_widget' && (
          <>
            <Select
              label="Platform"
              value={form.platform}
              onChange={e => set('platform', e.target.value as Platform)}
              options={PLATFORM_OPTIONS}
            />
            <Select
              label="Widget Position"
              value={form.widget_position}
              onChange={e => set('widget_position', e.target.value as WidgetPosition)}
              options={WIDGET_POSITION_OPTIONS}
            />
            <Input
              label="Greeting Text"
              value={form.greeting_text}
              onChange={e => set('greeting_text', e.target.value)}
              placeholder="Hi! Chat with us on Instagram..."
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#8B90A7]">Accent Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.accent_color}
                  onChange={e => set('accent_color', e.target.value)}
                  className="w-9 h-9 rounded-lg border border-[#2A2E42] bg-[#1A1C24] cursor-pointer p-0.5"
                />
                <span className="text-sm font-mono text-[#F0F2FF]">{form.accent_color}</span>
                <div className="flex gap-1.5 ml-auto">
                  {['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set('accent_color', c)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${form.accent_color === c ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {form.tool_type === 'referral_link' && (
          <Input
            label="Reward Description"
            value={form.reward_description}
            onChange={e => set('reward_description', e.target.value)}
            placeholder="e.g. 15% off for you + your friend"
            error={errors.reward_description}
          />
        )}
      </div>
    </Modal>
  );
}

// ---- Detail Modal ----
interface DetailModalProps {
  tool: GrowthTool | null;
  onClose: () => void;
}

function DetailModal({ tool, onClose }: DetailModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!tool) return null;

  function copyText(text: string, field: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  const CopyBtn = ({ text, field }: { text: string; field: string }) => (
    <button
      onClick={() => copyText(text, field)}
      className="w-7 h-7 flex items-center justify-center rounded-lg text-[#4B5068] hover:text-blue-400 hover:bg-blue-500/10 transition-all"
      title="Copy to clipboard"
    >
      {copiedField === field ? (
        <Check className="w-3.5 h-3.5 text-green-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );

  const rate = conversionRate(tool.click_count, tool.conversion_count);

  return (
    <Modal
      open={!!tool}
      onClose={onClose}
      title={tool.name}
      maxWidth="max-w-lg"
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4">
        {/* Status / meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${toolTypeColor(tool.tool_type)}`}>
            {toolTypeIcon(tool.tool_type, 16)}
            {toolTypeLabel(tool.tool_type)}
          </span>
          {tool.platform && (
            <Badge variant="platform" platform={tool.platform}>
              {tool.platform.charAt(0) + tool.platform.slice(1).toLowerCase()}
            </Badge>
          )}
          <Badge variant={tool.is_active ? 'success' : 'default'}>
            {tool.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#0A0B0F] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-[#F0F2FF]">{tool.click_count.toLocaleString()}</p>
            <p className="text-[10px] text-[#4B5068] uppercase tracking-wide mt-0.5">Total Clicks</p>
          </div>
          <div className="bg-[#0A0B0F] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-[#F0F2FF]">{tool.conversion_count.toLocaleString()}</p>
            <p className="text-[10px] text-[#4B5068] uppercase tracking-wide mt-0.5">Conversions</p>
          </div>
          <div className="bg-[#0A0B0F] rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${parseFloat(rate) >= 50 ? 'text-green-400' : 'text-blue-400'}`}>{rate}</p>
            <p className="text-[10px] text-[#4B5068] uppercase tracking-wide mt-0.5">Conv. Rate</p>
          </div>
        </div>

        {/* Tool-specific content */}
        {tool.tool_type === 'qr_code' && (
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-white rounded-2xl shadow-lg">
                <img
                  src={generateQRDataUrl(
                    (tool.config.destination as string) || tool.id,
                    (tool.config.qr_color as string) || '#3B82F6',
                  )}
                  alt="QR Code"
                  className="w-40 h-40"
                />
              </div>
              <p className="text-xs text-[#4B5068]">Scan to open DM</p>
            </div>
            <div className="bg-[#0A0B0F] rounded-xl p-3 flex items-center gap-2">
              <Link2 className="w-3.5 h-3.5 text-[#4B5068] flex-shrink-0" />
              <p className="text-xs text-[#8B90A7] font-mono flex-1 truncate">{tool.config.destination as string}</p>
              <CopyBtn text={(tool.config.destination as string) || ''} field="destination" />
              <a
                href={(tool.config.destination as string)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#4B5068] hover:text-blue-400 hover:bg-blue-500/10 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {tool.tool_type === 'click_to_message' && (
          <div className="space-y-3">
            <div className="bg-[#0A0B0F] rounded-xl p-3">
              <p className="text-[10px] text-[#4B5068] uppercase tracking-wide mb-2">Click-to-Message URL</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-blue-400 font-mono flex-1 break-all">{generateClickToMessageUrl(tool)}</p>
                <CopyBtn text={generateClickToMessageUrl(tool)} field="ctm_url" />
              </div>
            </div>
            {!!tool.config.ad_reference && (
              <div className="bg-[#0A0B0F] rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-[#4B5068] uppercase tracking-wide mb-0.5">Ad Reference</p>
                  <p className="text-xs text-[#F0F2FF] font-mono">{tool.config.ad_reference as string}</p>
                </div>
                <CopyBtn text={tool.config.ad_reference as string} field="ad_ref" />
              </div>
            )}
            <div className="p-3 rounded-xl bg-blue-500/8 border border-blue-500/20">
              <p className="text-xs text-blue-300">
                Paste this URL as the destination URL for your ad's "Send Message" CTA button.
              </p>
            </div>
          </div>
        )}

        {tool.tool_type === 'website_widget' && (
          <div className="space-y-3">
            {/* Widget preview */}
            <div className="bg-[#0A0B0F] rounded-xl p-4 relative min-h-[100px] overflow-hidden">
              <p className="text-[10px] text-[#4B5068] uppercase tracking-wide mb-3">Widget Preview</p>
              <div
                className={`absolute bottom-3 ${(tool.config.position as string) === 'bottom-left' ? 'left-3' : 'right-3'} flex items-center gap-2`}
              >
                <div
                  className="px-3 py-2 rounded-xl text-white text-xs max-w-[200px] shadow-lg"
                  style={{ backgroundColor: (tool.config.accent_color as string) || '#3B82F6' }}
                >
                  {(tool.config.greeting as string) || 'Chat with us!'}
                </div>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg flex-shrink-0"
                  style={{ backgroundColor: (tool.config.accent_color as string) || '#3B82F6' }}
                >
                  <MessageSquare className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Embed snippet */}
            <div className="bg-[#0A0B0F] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#1E2130]">
                <div className="flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-[#4B5068]" />
                  <span className="text-[10px] text-[#4B5068] uppercase tracking-wide">Embed Snippet</span>
                </div>
                <CopyBtn text={generateEmbedSnippet(tool)} field="snippet" />
              </div>
              <pre className="text-[11px] text-[#8B90A7] font-mono p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {generateEmbedSnippet(tool)}
              </pre>
            </div>
            <p className="text-xs text-[#4B5068]">
              Paste this snippet before the closing <code className="text-[#8B90A7]">&lt;/body&gt;</code> tag on every page.
            </p>
          </div>
        )}

        {tool.tool_type === 'referral_link' && (
          <div className="space-y-3">
            <div className="bg-[#0A0B0F] rounded-xl p-3">
              <p className="text-[10px] text-[#4B5068] uppercase tracking-wide mb-2">Referral Link</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-blue-400 font-mono flex-1 break-all">{generateReferralUrl(tool)}</p>
                <CopyBtn text={generateReferralUrl(tool)} field="ref_url" />
                <a
                  href={generateReferralUrl(tool)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#4B5068] hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
            {!!tool.config.reward_description && (
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3">
                <p className="text-[10px] text-amber-400 uppercase tracking-wide mb-1">Reward</p>
                <p className="text-sm text-[#F0F2FF]">{tool.config.reward_description as string}</p>
              </div>
            )}
          </div>
        )}

        {/* Linked flow */}
        {tool.linked_flow_name && (
          <div className="bg-[#0A0B0F] rounded-xl p-3 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] text-[#4B5068] uppercase tracking-wide">Linked Flow</p>
              <p className="text-xs text-[#F0F2FF] mt-0.5">{tool.linked_flow_name}</p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[#4B5068]" />
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---- Main Page ----
export function GrowthToolsPage() {
  const { tenant, brand } = useAuth();
  const [tools, setTools] = useState<GrowthTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | ToolType>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [createDefaultType, setCreateDefaultType] = useState<ToolType>('qr_code');
  const [viewTool, setViewTool] = useState<GrowthTool | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Quick toast helper
  const toast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchTools = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    // Growth tools API endpoint to be wired in a future iteration — use demo data
    setTools(DEMO_TOOLS.map(t => ({ ...t, tenant_id: tenant.id, brand_id: brand?.id ?? '' })));
    setLoading(false);
  }, [tenant, brand]);

  useEffect(() => {
    if (tenant) fetchTools();
  }, [tenant, fetchTools]);

  // Create
  async function handleCreate(partial: Partial<GrowthTool>) {
    if (!tenant || !brand) return;
    const newTool: GrowthTool = {
      id: `local-${Date.now()}`,
      tenant_id: tenant.id,
      brand_id: brand.id,
      tool_type: partial.tool_type ?? 'qr_code',
      name: partial.name ?? 'Untitled',
      platform: partial.platform,
      linked_flow_id: partial.linked_flow_id,
      linked_flow_name: partial.linked_flow_name,
      config: partial.config ?? {},
      click_count: 0,
      conversion_count: 0,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    // Local insert — persist via API in a future iteration
    setTools(prev => [newTool, ...prev]);
    setShowCreate(false);
    toast(`"${newTool.name}" created successfully`);
  }

  // Toggle active
  async function handleToggle(id: string, active: boolean) {
    // Local update — persist via API in a future iteration
    setTools(prev => prev.map(t => (t.id === id ? { ...t, is_active: active } : t)));
    toast(active ? 'Tool activated' : 'Tool deactivated');
  }

  // Delete
  async function handleDelete(id: string) {
    // Local delete — persist via API in a future iteration
    setTools(prev => prev.filter(t => t.id !== id));
    toast('Tool deleted');
  }

  // Filtered tools
  const filteredTools = activeTab === 'all'
    ? tools
    : tools.filter(t => t.tool_type === activeTab);

  // Metrics
  const totalClicks = tools.reduce((s, t) => s + t.click_count, 0);
  const totalConversions = tools.reduce((s, t) => s + t.conversion_count, 0);
  const totalCvr = conversionRate(totalClicks, totalConversions);
  const activeCount = tools.filter(t => t.is_active).length;

  // Tab counts
  const countByType = (type: ToolType) => tools.filter(t => t.tool_type === type).length;

  const tabs = [
    { id: 'all', label: 'All Tools', badge: tools.length },
    { id: 'qr_code', label: 'QR Codes', badge: countByType('qr_code') },
    { id: 'click_to_message', label: 'Click-to-Msg', badge: countByType('click_to_message') },
    { id: 'website_widget', label: 'Widgets', badge: countByType('website_widget') },
    { id: 'referral_link', label: 'Referral', badge: countByType('referral_link') },
  ];

  function openCreate(type: ToolType = 'qr_code') {
    setCreateDefaultType(type);
    setShowCreate(true);
  }

  return (
    <div className="min-h-screen bg-[#0A0B0F]">
      <div className="p-4 md:p-6 max-w-[1400px] space-y-6">

        {/* ---- Header ---- */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#F0F2FF]">Growth Tools</h1>
            <p className="text-xs text-[#8B90A7] mt-1">
              Acquire new contacts with QR codes, ad links, website widgets, and referral programs.
            </p>
          </div>
          <Button variant="primary" size="default" onClick={() => openCreate('qr_code')}>
            <Plus className="w-4 h-4" /> New Tool
          </Button>
        </div>

        {/* ---- Metrics ---- */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            label="Total Clicks"
            value={totalClicks.toLocaleString()}
            icon={<MousePointerClick className="w-4 h-4" />}
            iconColor="text-blue-400"
            change={{ value: '12.4% vs last month', positive: true }}
          />
          <MetricCard
            label="Total Conversions"
            value={totalConversions.toLocaleString()}
            icon={<Users className="w-4 h-4" />}
            iconColor="text-green-400"
            change={{ value: '8.2% vs last month', positive: true }}
          />
          <MetricCard
            label="Conversion Rate"
            value={totalCvr}
            icon={<TrendingUp className="w-4 h-4" />}
            iconColor="text-violet-400"
            subtitle="Across all active tools"
          />
          <MetricCard
            label="Active Tools"
            value={activeCount}
            icon={<BarChart3 className="w-4 h-4" />}
            iconColor="text-amber-400"
            subtitle={`${tools.length} total tools`}
          />
        </div>

        {/* ---- Quick create strip ---- */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(
            [
              { type: 'qr_code' as ToolType, label: 'New QR Code', icon: <QrCode className="w-4 h-4" />, desc: 'For in-store or print', color: 'hover:border-violet-500/40 hover:bg-violet-500/5' },
              { type: 'click_to_message' as ToolType, label: 'New Click-to-Msg', icon: <MousePointerClick className="w-4 h-4" />, desc: 'For paid ads', color: 'hover:border-blue-500/40 hover:bg-blue-500/5' },
              { type: 'website_widget' as ToolType, label: 'New Widget', icon: <Globe className="w-4 h-4" />, desc: 'Embed on your site', color: 'hover:border-emerald-500/40 hover:bg-emerald-500/5' },
              { type: 'referral_link' as ToolType, label: 'New Referral Link', icon: <Share2 className="w-4 h-4" />, desc: 'Shareable + tracked', color: 'hover:border-amber-500/40 hover:bg-amber-500/5' },
            ] as const
          ).map(({ type, label, icon, desc, color }) => (
            <button
              key={type}
              onClick={() => openCreate(type)}
              className={`flex items-center gap-3 p-3 rounded-xl border border-[#2A2E42] bg-[#111318] text-left transition-all group ${color}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${toolTypeColor(type)}`}>
                {icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#F0F2FF] group-hover:text-white">{label}</p>
                <p className="text-[10px] text-[#4B5068]">{desc}</p>
              </div>
              <Plus className="w-3.5 h-3.5 text-[#4B5068] ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>

        {/* ---- Tabs + grid ---- */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <Tabs
              tabs={tabs}
              active={activeTab}
              onChange={(id) => setActiveTab(id as typeof activeTab)}
            />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-[#111318] border border-[#2A2E42] rounded-xl p-4 space-y-3 animate-pulse">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#1A1C24]" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-[#1A1C24] rounded w-3/4" />
                      <div className="h-2 bg-[#1A1C24] rounded w-1/2" />
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="h-5 bg-[#1A1C24] rounded-full w-20" />
                    <div className="h-5 bg-[#1A1C24] rounded-full w-24" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map(j => (
                      <div key={j} className="h-12 bg-[#1A1C24] rounded-lg" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTools.length === 0 ? (
            <div className="bg-[#111318] border border-[#2A2E42] rounded-2xl">
              <EmptyState
                icon={toolTypeIcon(activeTab === 'all' ? 'qr_code' : activeTab as ToolType, 20)}
                title={
                  activeTab === 'all'
                    ? 'No growth tools yet'
                    : `No ${toolTypeLabel(activeTab as ToolType)}s yet`
                }
                description={
                  activeTab === 'all'
                    ? 'Create your first growth tool to start acquiring contacts via DM automation.'
                    : `Create a ${toolTypeLabel(activeTab as ToolType)} to get started.`
                }
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openCreate((activeTab === 'all' ? 'qr_code' : activeTab) as ToolType)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {activeTab === 'all' ? 'New Tool' : `New ${toolTypeLabel(activeTab as ToolType)}`}
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredTools.map(tool => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onView={setViewTool}
                />
              ))}
            </div>
          )}
        </div>

        {/* ---- Platform breakdown ---- */}
        {tools.length > 0 && (
          <div className="bg-[#111318] border border-[#2A2E42] rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-[#F0F2FF] mb-4">Platform Breakdown</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(['INSTAGRAM', 'FACEBOOK', 'TIKTOK'] as Platform[]).map(platform => {
                const platformTools = tools.filter(t => t.platform === platform);
                const pClicks = platformTools.reduce((s, t) => s + t.click_count, 0);
                const pConvs = platformTools.reduce((s, t) => s + t.conversion_count, 0);
                const pRate = conversionRate(pClicks, pConvs);
                const pct = totalClicks > 0 ? Math.round((pClicks / totalClicks) * 100) : 0;

                const platformColors: Record<Platform, string> = {
                  INSTAGRAM: 'bg-pink-500',
                  FACEBOOK: 'bg-blue-500',
                  TIKTOK: 'bg-cyan-500',
                };
                const platformTextColors: Record<Platform, string> = {
                  INSTAGRAM: 'text-pink-400',
                  FACEBOOK: 'text-blue-400',
                  TIKTOK: 'text-cyan-400',
                };

                return (
                  <div key={platform} className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="platform" platform={platform}>
                          {platform.charAt(0) + platform.slice(1).toLowerCase()}
                        </Badge>
                        <span className="text-[10px] text-[#4B5068]">{platformTools.length} tools</span>
                      </div>
                      <span className={`text-xs font-bold ${platformTextColors[platform]}`}>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-[#1A1C24] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${platformColors[platform]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#4B5068]">
                      <span>{pClicks.toLocaleString()} clicks</span>
                      <span>{pRate} CVR</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ---- Modals ---- */}
      <CreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
        defaultType={createDefaultType}
      />

      <DetailModal
        tool={viewTool}
        onClose={() => setViewTool(null)}
      />

      {/* ---- Inline Toast ---- */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-[100] flex items-center gap-2 bg-[#1A1C24] border border-[#2A2E42] border-l-4 border-l-blue-500 rounded-xl px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-2 duration-300">
          <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <p className="text-sm text-[#F0F2FF]">{toastMsg}</p>
        </div>
      )}
    </div>
  );
}
