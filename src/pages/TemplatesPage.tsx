import React, { useState } from 'react';
import {
  Search, Star, Download, Eye, Zap, MessageSquare, ShoppingCart,
  UserCheck, BarChart2, Gift, Globe, X, Play,
  CheckCircle2, TrendingUp, Users, Lock
} from 'lucide-react';
import { Button, Card, Badge, Modal } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { TriggerType } from '../types';

const CATEGORIES = [
  { id: 'all', label: 'All Templates' },
  { id: 'ecommerce', label: 'E-commerce' },
  { id: 'lead_gen', label: 'Lead Generation' },
  { id: 'support', label: 'Customer Support' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'recovery', label: 'Recovery' },
  { id: 'loyalty', label: 'Loyalty' },
];

const TEMPLATES = [
  {
    id: '1',
    name: 'Story Reply → Purchase',
    desc: 'Automatically engage users who reply to your Instagram story, qualify intent, and guide them to checkout.',
    category: 'ecommerce',
    platform: ['INSTAGRAM'],
    rating: 4.9,
    uses: 12400,
    nodes: 8,
    trigger: 'Story Reply',
    trigger_type: 'STORY_REPLY' as TriggerType,
    conversionRate: '23%',
    icon: ShoppingCart,
    iconColor: '#E1306C',
    tags: ['AI Step', 'Intent Detection', 'Checkout Link'],
    popular: true,
    preview: [
      { type: 'TRIGGER', label: 'Story Reply Trigger' },
      { type: 'AI_STEP', label: 'Classify: Product Interest?' },
      { type: 'CONDITION', label: 'Has BUY_INTENT?' },
      { type: 'SEND_DM_CARD', label: 'Send Product Card' },
      { type: 'ACTION_BLOCK', label: 'Add Loyalty Score +10' },
    ],
  },
  {
    id: '2',
    name: 'Abandoned Cart Recovery',
    desc: "Re-engage users who added items to cart but didn't purchase. Sends timed reminder DMs with a discount.",
    category: 'recovery',
    platform: ['INSTAGRAM', 'FACEBOOK'],
    rating: 4.8,
    uses: 8900,
    nodes: 6,
    trigger: 'Webhook: Cart Abandon',
    trigger_type: 'MANUAL' as TriggerType,
    conversionRate: '18%',
    icon: ShoppingCart,
    iconColor: '#F59E0B',
    tags: ['Shopify', 'Smart Delay', 'Discount Code'],
    popular: true,
    preview: [
      { type: 'TRIGGER', label: 'Webhook: cart.abandoned' },
      { type: 'SMART_DELAY', label: 'Wait 1 hour' },
      { type: 'SEND_MESSAGE', label: 'Friendly reminder + cart link' },
      { type: 'SMART_DELAY', label: 'Wait 24 hours' },
      { type: 'SEND_MESSAGE', label: '10% discount offer' },
    ],
  },
  {
    id: '3',
    name: 'Lead Qualification Funnel',
    desc: 'Qualify inbound DM leads with AI-powered intent scoring before routing to a human sales rep.',
    category: 'lead_gen',
    platform: ['INSTAGRAM', 'FACEBOOK', 'TIKTOK'],
    rating: 4.7,
    uses: 6200,
    nodes: 10,
    trigger: 'DM Keyword: "price", "info"',
    trigger_type: 'COMMENT_TO_DM' as TriggerType,
    conversionRate: '34%',
    icon: UserCheck,
    iconColor: '#3B82F6',
    tags: ['AI Step', 'Human Handoff', 'CRM Tag'],
    popular: false,
    preview: [
      { type: 'TRIGGER', label: 'Keyword: price / info' },
      { type: 'AI_STEP', label: 'Qualify: Budget & Need' },
      { type: 'CONDITION', label: 'Score ≥ 70?' },
      { type: 'ACTION_BLOCK', label: 'Tag: HOT_LEAD' },
      { type: 'SEND_MESSAGE', label: 'Route to Sales Team' },
    ],
  },
  {
    id: '4',
    name: 'Welcome Series (3-Part)',
    desc: 'Onboard new followers with a 3-message welcome sequence introducing your brand, products, and community.',
    category: 'engagement',
    platform: ['INSTAGRAM'],
    rating: 4.6,
    uses: 15600,
    nodes: 7,
    trigger: 'New Follow',
    trigger_type: 'FOLLOW_TO_DM' as TriggerType,
    conversionRate: '41%',
    icon: MessageSquare,
    iconColor: '#22C55E',
    tags: ['Smart Delay', 'Personalization', 'Quick Reply'],
    popular: false,
    preview: [
      { type: 'TRIGGER', label: 'New Follower' },
      { type: 'SEND_MESSAGE', label: 'Welcome + brand intro' },
      { type: 'SMART_DELAY', label: 'Wait 1 day' },
      { type: 'SEND_DM_CARD', label: 'Best sellers showcase' },
      { type: 'SMART_DELAY', label: 'Wait 2 days' },
    ],
  },
  {
    id: '5',
    name: 'TikTok Shop Product Launch',
    desc: 'Drive TikTok Shop purchases by combining video comment triggers with personalized DM flows.',
    category: 'ecommerce',
    platform: ['TIKTOK'],
    rating: 4.9,
    uses: 4100,
    nodes: 9,
    trigger: 'Video Comment Keyword',
    trigger_type: 'TIKTOK_SHOP_COMMENT' as TriggerType,
    conversionRate: '29%',
    icon: ShoppingCart,
    iconColor: '#69C9D0',
    tags: ['TikTok Shop', 'Product Card', 'Attribution'],
    popular: true,
    pro: true,
    preview: [
      { type: 'TRIGGER', label: 'Comment: "link" / "buy"' },
      { type: 'SEND_MESSAGE', label: 'Personalized reply' },
      { type: 'TIKTOK_SHOP_PRODUCT', label: 'Product: Summer Collection' },
      { type: 'ACTION_BLOCK', label: 'Log Attribution Event' },
    ],
  },
  {
    id: '6',
    name: 'VIP Loyalty Reward',
    desc: 'Reward ADVOCATE tier contacts with exclusive offers, early access, and VIP perks automatically.',
    category: 'loyalty',
    platform: ['INSTAGRAM', 'FACEBOOK'],
    rating: 4.8,
    uses: 2800,
    nodes: 5,
    trigger: 'Loyalty Tier Change → ADVOCATE',
    trigger_type: 'MANUAL' as TriggerType,
    conversionRate: '67%',
    icon: Gift,
    iconColor: '#F59E0B',
    tags: ['Loyalty Tier', 'Exclusive Discount', 'Thank You'],
    popular: false,
    preview: [
      { type: 'TRIGGER', label: 'Tier upgrade: ADVOCATE' },
      { type: 'SEND_DM_CARD', label: 'VIP welcome message' },
      { type: 'ACTION_BLOCK', label: 'Apply 20% loyalty discount' },
      { type: 'ACTION_BLOCK', label: 'Tag: VIP_ACCESS' },
    ],
  },
  {
    id: '7',
    name: 'FAQ Auto-Response',
    desc: 'Handle the most common customer questions automatically with AI, with seamless human escalation.',
    category: 'support',
    platform: ['INSTAGRAM', 'FACEBOOK', 'TIKTOK'],
    rating: 4.5,
    uses: 22100,
    nodes: 6,
    trigger: 'Any DM',
    trigger_type: 'COMMENT_TO_DM' as TriggerType,
    conversionRate: '89% deflection',
    icon: MessageSquare,
    iconColor: '#8B90A7',
    tags: ['AI Step', 'Knowledge Base', 'Human Escalation'],
    popular: false,
    preview: [
      { type: 'TRIGGER', label: 'Any incoming DM' },
      { type: 'AI_STEP', label: 'Classify intent + RAG lookup' },
      { type: 'CONDITION', label: 'Confidence ≥ 0.85?' },
      { type: 'SEND_MESSAGE', label: 'AI-generated response' },
      { type: 'ACTION_BLOCK', label: 'Escalate to human' },
    ],
  },
  {
    id: '8',
    name: 'Contest & Giveaway Entry',
    desc: 'Run viral giveaway campaigns where users comment to enter and receive DM confirmation automatically.',
    category: 'engagement',
    platform: ['INSTAGRAM', 'FACEBOOK'],
    rating: 4.7,
    uses: 9300,
    nodes: 7,
    trigger: 'Post Comment Keyword',
    trigger_type: 'COMMENT_TO_DM' as TriggerType,
    conversionRate: '93% entry',
    icon: Gift,
    iconColor: '#E1306C',
    tags: ['Comment Trigger', 'Quick Reply', 'Broadcast List'],
    popular: false,
    preview: [
      { type: 'TRIGGER', label: 'Comment: "enter" / "giveaway"' },
      { type: 'SEND_MESSAGE', label: 'Entry confirmed + rules' },
      { type: 'ACTION_BLOCK', label: 'Add to segment: CONTEST_ENTRANT' },
      { type: 'ACTION_BLOCK', label: 'Tag contact + log event' },
    ],
  },
  {
    id: '9',
    name: 'Ghost A/B Test Starter',
    desc: 'Test two different message approaches with automatic traffic split, monitoring, and winner promotion.',
    category: 'engagement',
    platform: ['INSTAGRAM', 'FACEBOOK', 'TIKTOK'],
    rating: 4.6,
    uses: 3400,
    nodes: 8,
    trigger: 'Any DM',
    trigger_type: 'COMMENT_TO_DM' as TriggerType,
    conversionRate: 'Varies',
    icon: BarChart2,
    iconColor: '#3B82F6',
    tags: ['Ghost A/B', 'SUPER_RANDOMIZER', 'Analytics'],
    popular: false,
    pro: true,
    preview: [
      { type: 'TRIGGER', label: 'Incoming DM' },
      { type: 'SUPER_RANDOMIZER', label: '50/50 split' },
      { type: 'SEND_MESSAGE', label: 'Variant A: Direct CTA' },
      { type: 'SEND_MESSAGE', label: 'Variant B: Story-first' },
    ],
  },
];

const NODE_COLORS: Record<string, string> = {
  TRIGGER: 'bg-green-500/20 text-green-400 border-green-500/30',
  AI_STEP: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  CONDITION: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  SEND_MESSAGE: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  SEND_DM_CARD: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  ACTION_BLOCK: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  SMART_DELAY: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  SUPER_RANDOMIZER: 'bg-green-500/20 text-green-400 border-green-500/30',
  TIKTOK_SHOP_PRODUCT: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: '#E1306C',
  FACEBOOK: '#1877F2',
  TIKTOK: '#69C9D0',
};

const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: 'IG',
  FACEBOOK: 'FB',
  TIKTOK: 'TT',
};

export function TemplatesPage() {
  const { tenant, brand } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<typeof TEMPLATES[0] | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = TEMPLATES.filter(t => {
    const matchCat = category === 'all' || t.category === category;
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.desc.toLowerCase().includes(search.toLowerCase()) || t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  async function install(template: typeof TEMPLATES[0]) {
    if (!tenant?.id || !brand?.id) {
      setError('You must be logged in to install a template.');
      return;
    }
    setInstalling(template.id);
    setError(null);
    try {
      // 1. Insert the flow
      const { data: flow, error: flowErr } = await supabase
        .from('flows')
        .insert({
          tenant_id: tenant.id,
          brand_id: brand.id,
          name: template.name,
          status: 'DRAFT',
          trigger_type: template.trigger_type,
          trigger_config: {},
          ghost_traffic_pct: 0,
          triggered_count: 0,
          conversion_count: 0,
          revenue_attributed: 0,
        })
        .select()
        .single();

      if (flowErr || !flow) throw new Error(flowErr?.message || 'Failed to create flow');

      // 2. Insert flow_nodes from template preview
      if (template.preview.length > 0) {
        const nodes = template.preview.map((node, idx) => ({
          flow_id: flow.id,
          tenant_id: tenant.id,
          node_type: node.type,
          label: node.label,
          position_x: 300,
          position_y: idx * 120,
          config: {},
        }));
        const { error: nodesErr } = await supabase
          .from('flow_nodes')
          .insert(nodes);
        if (nodesErr) console.warn('Could not insert nodes:', nodesErr.message);
      }

      setInstalled(prev => new Set([...prev, template.id]));
      // Navigate to the builder
      navigate(`/flows/${flow.id}/builder`);
    } catch (err: any) {
      setError(err?.message || 'Failed to install template. Please try again.');
    } finally {
      setInstalling(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1400px]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#F0F2FF]">Template Marketplace</h1>
        <p className="text-xs text-[#8B90A7] mt-0.5">Production-ready flow templates. One click to add to your workspace.</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Templates', value: TEMPLATES.length, icon: <Zap className="w-4 h-4" />, color: 'text-blue-400' },
          { label: 'Total Uses', value: '85.3K', icon: <Download className="w-4 h-4" />, color: 'text-green-400' },
          { label: 'Avg Conversion', value: '38%', icon: <TrendingUp className="w-4 h-4" />, color: 'text-amber-400' },
          { label: 'Platforms Covered', value: '3', icon: <Globe className="w-4 h-4" />, color: 'text-cyan-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-[#111318] border border-[#1E2130] rounded-xl p-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg bg-[#1A1C24] flex items-center justify-center ${stat.color}`}>{stat.icon}</div>
            <div>
              <p className="text-base font-bold text-[#F0F2FF]">{stat.value}</p>
              <p className="text-[10px] text-[#4B5068]">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
        <div className="relative w-full sm:flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4B5068]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates, tags, platforms..."
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-[#111318] border border-[#1E2130] text-[#F0F2FF] placeholder:text-[#4B5068] text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5068] hover:text-[#F0F2FF]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1 p-1 bg-[#111318] rounded-xl border border-[#1E2130] overflow-x-auto w-full sm:w-auto">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${category === cat.id ? 'bg-[#1A1C24] text-[#F0F2FF] shadow-sm' : 'text-[#8B90A7] hover:text-[#F0F2FF]'}`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(template => {
          const Icon = template.icon;
          const isInstalled = installed.has(template.id);
          const isInstalling = installing === template.id;

          return (
            <div
              key={template.id}
              className={`group relative bg-[#111318] border rounded-2xl p-5 transition-all duration-200 hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 ${template.popular ? 'border-blue-500/20' : 'border-[#1E2130]'}`}
            >
              {/* Popular badge */}
              {template.popular && (
                <div className="absolute -top-2 left-4">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                    <Star className="w-2.5 h-2.5 fill-white" /> Popular
                  </span>
                </div>
              )}
              {(template as any).pro && (
                <div className="absolute -top-2 right-4">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                    <Lock className="w-2.5 h-2.5" /> PRO
                  </span>
                </div>
              )}

              {/* Icon + title */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: template.iconColor + '20' }}>
                  <Icon className="w-5 h-5" style={{ color: template.iconColor }} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#F0F2FF] leading-tight">{template.name}</h3>
                  <div className="flex items-center gap-1 mt-1">
                    {template.platform.map(p => (
                      <span key={p} className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: PLATFORM_COLORS[p] + '25', color: PLATFORM_COLORS[p] }}>
                        {PLATFORM_LABELS[p]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-[#8B90A7] leading-relaxed mb-3 line-clamp-2">{template.desc}</p>

              {/* Stats row */}
              <div className="flex items-center gap-3 mb-3 text-[11px]">
                <div className="flex items-center gap-1 text-amber-400">
                  <Star className="w-3 h-3 fill-amber-400" />
                  <span className="font-semibold">{template.rating}</span>
                </div>
                <div className="flex items-center gap-1 text-[#4B5068]">
                  <Users className="w-3 h-3" />
                  <span>{template.uses.toLocaleString()} uses</span>
                </div>
                <div className="flex items-center gap-1 text-[#4B5068]">
                  <Zap className="w-3 h-3" />
                  <span>{template.nodes} nodes</span>
                </div>
                <div className="ml-auto text-green-400 font-semibold">{template.conversionRate}</div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mb-4">
                {template.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-[#1A1C24] border border-[#2A2E42] text-[10px] text-[#8B90A7]">{tag}</span>
                ))}
              </div>

              {/* Trigger */}
              <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-[#0A0B0F] border border-[#1E2130]">
                <Zap className="w-3 h-3 text-green-400 flex-shrink-0" />
                <span className="text-[11px] text-[#8B90A7] truncate">Trigger: <span className="text-[#F0F2FF]">{template.trigger}</span></span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setPreview(template)}
                  className="flex-1 h-8 rounded-lg border border-[#2A2E42] text-xs text-[#8B90A7] hover:text-[#F0F2FF] hover:bg-[#1A1C24] transition-colors flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
                <button
                  onClick={() => !isInstalled && !isInstalling && install(template)}
                  disabled={isInstalling || isInstalled}
                  className={`flex-1 h-8 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    isInstalled
                      ? 'bg-green-500/15 border border-green-500/30 text-green-400 cursor-default'
                      : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.98] disabled:opacity-50'
                  }`}
                >
                  {isInstalling ? (
                    <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Installing...</>
                  ) : isInstalled ? (
                    <><CheckCircle2 className="w-3.5 h-3.5" /> Installed</>
                  ) : (
                    <><Download className="w-3.5 h-3.5" /> Use Template</>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#1A1C24] border border-[#2A2E42] flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-[#4B5068]" />
          </div>
          <h3 className="text-sm font-semibold text-[#F0F2FF] mb-1">No templates found</h3>
          <p className="text-xs text-[#8B90A7]">Try adjusting your search or category filter</p>
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <Modal
          open={!!preview}
          onClose={() => setPreview(null)}
          title={preview.name}
          maxWidth="max-w-xl"
          footer={
            <>
              <Button variant="ghost" onClick={() => setPreview(null)}>Close</Button>
              <Button
                variant="primary"
                onClick={() => { install(preview); setPreview(null); }}
                disabled={installed.has(preview.id) || installing === preview.id}
                loading={installing === preview.id}
              >
                {installed.has(preview.id) ? 'Already Installed' : <><Download className="w-3.5 h-3.5" /> Use Template</>}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-[#8B90A7]">{preview.desc}</p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-[#0A0B0F] border border-[#1E2130] text-center">
                <p className="text-base font-bold text-[#F0F2FF]">{preview.rating}</p>
                <p className="text-[10px] text-[#4B5068]">Rating</p>
              </div>
              <div className="p-3 rounded-xl bg-[#0A0B0F] border border-[#1E2130] text-center">
                <p className="text-base font-bold text-[#F0F2FF]">{preview.uses.toLocaleString()}</p>
                <p className="text-[10px] text-[#4B5068]">Uses</p>
              </div>
              <div className="p-3 rounded-xl bg-[#0A0B0F] border border-[#1E2130] text-center">
                <p className="text-base font-bold text-green-400">{preview.conversionRate}</p>
                <p className="text-[10px] text-[#4B5068]">Conversion</p>
              </div>
            </div>

            {/* Flow preview */}
            <div>
              <p className="text-xs font-semibold text-[#4B5068] uppercase tracking-wider mb-2">Flow Preview ({preview.nodes} nodes total)</p>
              <div className="space-y-2">
                {preview.preview.map((node, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex-1 ${NODE_COLORS[node.type] || 'bg-[#1A1C24] text-[#8B90A7] border-[#2A2E42]'}`}>
                      <span className="opacity-60 text-[10px] mr-2">{node.type.replace(/_/g, ' ')}</span>
                      {node.label}
                    </div>
                    {i < preview.preview.length - 1 && (
                      <div className="absolute ml-3 mt-8 text-[#2A2E42] text-lg leading-none">↓</div>
                    )}
                  </div>
                ))}
                {preview.nodes > preview.preview.length && (
                  <p className="text-[11px] text-[#4B5068] text-center py-1">+ {preview.nodes - preview.preview.length} more nodes...</p>
                )}
              </div>
            </div>

            {/* Tags */}
            <div>
              <p className="text-xs font-semibold text-[#4B5068] uppercase tracking-wider mb-2">Features</p>
              <div className="flex flex-wrap gap-1.5">
                {preview.tags.map(tag => (
                  <span key={tag} className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
