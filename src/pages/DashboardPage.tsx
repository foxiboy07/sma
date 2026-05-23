import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Zap, Users, DollarSign, TrendingUp,
  AlertTriangle, Brain, ArrowRight, Plus, TestTube2,
  Megaphone, UserPlus, CheckCircle2
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { MetricCard, Card, Badge, Button, PlatformIcon, LoyaltyBadge, Skeleton } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { ConnectedAccount, Flow } from '../types';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';

interface PriorityRedItem {
  id: string;
  name: string;
  platform: string;
  waitingMin: number;
}

interface AIDecisionItem {
  contact: string;
  intent: string;
  tier: string;
  cost: string;
  flowId: string;
}

interface ActivityHour {
  hour: string;
  messages: number;
  purchases: number;
  revenue: number;
}

interface MetricsData {
  dmsSentToday: number;
  activeFlows: number;
  pausedFlows: number;
  conversationsBot: number;
  conversationsHuman: number;
  conversationsRed: number;
  aiCreditsSaved: string;
  cacheHitRate: string;
}

export function DashboardPage() {
  const { user, tenant, brand } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('24h');

  const [priorityRed, setPriorityRed] = useState<PriorityRedItem[]>([]);
  const [aiDecisions, setAiDecisions] = useState<AIDecisionItem[]>([]);
  const [activity, setActivity] = useState<ActivityHour[]>([]);
  const [metrics, setMetrics] = useState<MetricsData>({
    dmsSentToday: 0,
    activeFlows: 0,
    pausedFlows: 0,
    conversationsBot: 0,
    conversationsHuman: 0,
    conversationsRed: 0,
    aiCreditsSaved: '$0.00',
    cacheHitRate: '0%',
  });

  useEffect(() => {
    if (!tenant?.id) { setLoading(false); return; }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    Promise.all([
      // Connected accounts
      supabase.from('connected_accounts').select('*').eq('tenant_id', tenant.id).limit(5),

      // All flows (active + paused) for metrics
      supabase.from('flows').select('*').eq('tenant_id', tenant.id).in('status', ['ACTIVE', 'PAUSED']),

      // Priority Red conversations
      supabase
        .from('conversations')
        .select('id, platform, created_at, unified_contacts(display_name)')
        .eq('tenant_id', tenant.id)
        .eq('priority_red', true)
        .neq('status', 'CLOSED')
        .order('created_at', { ascending: true })
        .limit(5),

      // AI audit logs
      supabase
        .from('ai_audit_logs')
        .select('id, contact_id, intent_classified, model_tier, estimated_cost_usd, flow_id, unified_contacts(display_name)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(5),

      // Activity chart: attribution events grouped by hour (last 24h)
      supabase
        .from('attribution_events')
        .select('event_type, revenue_attributed, created_at')
        .eq('tenant_id', tenant.id)
        .gte('created_at', twentyFourHoursAgo),

      // DMs sent today
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('direction', 'OUTBOUND')
        .gte('created_at', todayStart),

      // Conversations in last 24h by status
      supabase
        .from('conversations')
        .select('status, priority_red')
        .eq('tenant_id', tenant.id)
        .gte('last_message_at', twentyFourHoursAgo),

      // AI audit logs this month for credits saved
      supabase
        .from('ai_audit_logs')
        .select('estimated_cost_usd, kb_chunks_retrieved')
        .eq('tenant_id', tenant.id)
        .gte('created_at', monthStart),
    ]).then(([
      accRes, flowRes, priorityRedRes, aiDecisionsRes, activityRes,
      dmsRes, conversationsRes, aiCreditsRes,
    ]) => {
      setAccounts(accRes.data || []);

      const allFlows = flowRes.data || [];
      setFlows(allFlows.filter(f => f.status === 'ACTIVE'));

      // Priority Red
      const prData = (priorityRedRes.data || []).map((c: any) => {
        const created = c.created_at ? new Date(c.created_at) : now;
        const waitingMin = Math.max(1, Math.round((now.getTime() - created.getTime()) / 60000));
        return {
          id: c.id,
          name: c.unified_contacts?.display_name || 'Unknown',
          platform: c.platform,
          waitingMin,
        };
      });
      setPriorityRed(prData);

      // AI Decisions
      const aiData = (aiDecisionsRes.data || []).map((log: any) => ({
        contact: log.unified_contacts?.display_name || 'Unknown',
        intent: log.intent_classified || 'N/A',
        tier: log.model_tier || 'TIER_1',
        cost: log.estimated_cost_usd?.toFixed(4) || '0.0000',
        flowId: log.flow_id || '',
      }));
      setAiDecisions(aiData);

      // Activity chart: group attribution events by hour
      const hourMap: Record<string, { messages: number; purchases: number; revenue: number }> = {};
      for (let i = 0; i < 24; i++) {
        const hourStart = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
        const label = `${hourStart.getHours()}:00`;
        hourMap[label] = { messages: 0, purchases: 0, revenue: 0 };
      }
      (activityRes.data || []).forEach((ev: any) => {
        const evDate = new Date(ev.created_at);
        const label = `${evDate.getHours()}:00`;
        if (hourMap[label]) {
          if (ev.event_type === 'MESSAGE_SENT') hourMap[label].messages++;
          if (ev.event_type === 'PURCHASE_ATTRIBUTED') {
            hourMap[label].purchases++;
            hourMap[label].revenue += ev.revenue_attributed || 0;
          }
        }
      });
      const activityData = Object.values(hourMap).map((h, i) => ({
        hour: `${((now.getHours() - 23 + i + 24) % 24)}:00`,
        messages: h.messages,
        purchases: h.purchases,
        revenue: Math.round(h.revenue),
      }));
      setActivity(activityData);

      // Metrics: DMs sent today
      const dmsSentToday = dmsRes.count || 0;

      // Metrics: Flows
      const activeFlows = allFlows.filter(f => f.status === 'ACTIVE').length;
      const pausedFlows = allFlows.filter(f => f.status === 'PAUSED').length;

      // Metrics: Conversations (24h)
      const convs = conversationsRes.data || [];
      const conversationsBot = convs.filter((c: any) => c.status === 'BOT').length;
      const conversationsHuman = convs.filter((c: any) => c.status === 'HUMAN').length;
      const conversationsRed = convs.filter((c: any) => c.priority_red === true).length;

      // Metrics: AI Credits Saved
      const aiLogs = aiCreditsRes.data || [];
      const totalCost = aiLogs.reduce((sum: number, log: any) => sum + (log.estimated_cost_usd || 0), 0);
      const cacheHits = aiLogs.filter((log: any) =>
        log.kb_chunks_retrieved && Array.isArray(log.kb_chunks_retrieved) && log.kb_chunks_retrieved.length > 0
      ).length;
      const cacheHitRate = aiLogs.length > 0 ? Math.round((cacheHits / aiLogs.length) * 100) : 0;
      const flatRateCost = aiLogs.length * 0.015;
      const savings = Math.max(0, flatRateCost - totalCost);

      setMetrics({
        dmsSentToday,
        activeFlows,
        pausedFlows,
        conversationsBot,
        conversationsHuman,
        conversationsRed,
        aiCreditsSaved: `$${savings.toFixed(2)}`,
        cacheHitRate: `${cacheHitRate}% cache hit rate`,
      });

      setLoading(false);
    });
  }, [tenant?.id]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.email?.split('@')[0] || 'there';

  const isNewUser = accounts.length === 0;

  if (isNewUser) {
    return <OnboardingChecklist />;
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F0F2FF]">{greeting}, {firstName}</h1>
          <p className="text-sm text-[#8B90A7]">{format(new Date(), 'MMMM d, yyyy')} · Last updated just now</p>
        </div>
        <div className="flex gap-2">
          {(['24h', '7d', '30d'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === p ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-[#8B90A7] hover:text-[#F0F2FF]'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Row */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="DMs Sent Today"
            value={metrics.dmsSentToday.toLocaleString()}
            icon={<MessageSquare className="w-4 h-4" />}
          />
          <MetricCard
            label="Active Flows"
            value={metrics.activeFlows}
            subtitle={`${metrics.pausedFlows} paused`}
            icon={<Zap className="w-4 h-4" />}
            iconColor="text-amber-400"
          />
          <MetricCard
            label="Conversations (24h)"
            value={metrics.conversationsBot + metrics.conversationsHuman}
            subtitle={`Bot: ${metrics.conversationsBot} · Human: ${metrics.conversationsHuman} · Red: ${metrics.conversationsRed}`}
            icon={<Users className="w-4 h-4" />}
            iconColor="text-green-400"
          />
          <MetricCard
            label="AI Credits Saved"
            value={metrics.aiCreditsSaved}
            change={{ value: metrics.cacheHitRate, positive: true }}
            icon={<Brain className="w-4 h-4" />}
            iconColor="text-cyan-400"
            subtitle="vs flat-rate messaging"
          />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-5 gap-4">
        {/* Activity Chart */}
        <Card className="col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#F0F2FF]">Activity Timeline</h2>
            <div className="flex items-center gap-4 text-xs text-[#8B90A7]">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block" /> Messages</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-400 inline-block" /> Revenue ($)</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={activity}>
              <defs>
                <linearGradient id="messagesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2130" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#4B5068' }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: '#4B5068' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1A1C24', border: '1px solid #2A2E42', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="messages" stroke="#3B82F6" fill="url(#messagesGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="revenue" stroke="#22C55E" fill="url(#revenueGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Platform Health */}
        <Card className="col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#F0F2FF]">Platform Health</h2>
            <button onClick={() => navigate('/health')} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {loading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)
            ) : accounts.length > 0 ? accounts.slice(0, 4).map(acc => (
              <div key={acc.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlatformIcon platform={acc.platform} size={20} />
                  <div>
                    <p className="text-xs font-medium text-[#F0F2FF]">{acc.platform_username || acc.platform}</p>
                    <p className="text-[10px] text-[#4B5068]">
                      {acc.last_webhook_at ? `Last webhook ${formatDistanceToNow(new Date(acc.last_webhook_at))} ago` : 'No webhooks yet'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${acc.health_status === 'HEALTHY' ? 'bg-green-400' : acc.health_status === 'EXPIRING' ? 'bg-amber-400' : 'bg-red-400'}`} />
                  <span className="text-[10px] text-[#8B90A7]">{acc.health_status}</span>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center py-4 gap-2">
                <p className="text-xs text-[#4B5068] text-center">No accounts connected yet</p>
                <Button variant="primary" size="sm" onClick={() => navigate('/health')}>Connect account</Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Third Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Top Flows */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#F0F2FF]">Top Flows</h2>
            <button onClick={() => navigate('/flows')} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {[
              { name: 'Price Inquiry DM', trigger: 'COMMENT_TO_DM', conv: '34.2%', trend: '+3.1%', platform: 'TIKTOK' },
              { name: 'Story Reply Lead', trigger: 'STORY_REPLY', conv: '28.7%', trend: '+1.2%', platform: 'INSTAGRAM' },
              { name: 'Welcome New Followers', trigger: 'FOLLOW_TO_DM', conv: '22.1%', trend: '-0.4%', platform: 'INSTAGRAM' },
              { name: 'Bio Click Capture', trigger: 'DEEPLINK_BIO_CLICK', conv: '18.9%', trend: '+5.2%', platform: 'FACEBOOK' },
            ].map(flow => (
              <div key={flow.name} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <PlatformIcon platform={flow.platform} size={14} />
                  <span className="text-xs text-[#F0F2FF] truncate">{flow.name}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs font-semibold text-green-400">{flow.conv}</span>
                  <span className={`text-[10px] ${flow.trend.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>{flow.trend}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Priority Red */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#F0F2FF] flex items-center gap-2">
              Priority Red
              {priorityRed.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-400 priority-red-pulse" />
              )}
            </h2>
            <button onClick={() => navigate('/inbox')} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              Open Inbox <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {priorityRed.length > 0 ? (
            <div className="space-y-3">
              {priorityRed.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/15">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center text-xs font-bold text-red-400">
                      {item.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#F0F2FF]">{item.name}</p>
                      <div className="flex items-center gap-1">
                        <PlatformIcon platform={item.platform} size={10} />
                        <span className="text-[10px] text-[#8B90A7]">Waiting {item.waitingMin}m</span>
                      </div>
                    </div>
                  </div>
                  <button className="text-xs text-red-400 hover:text-red-300 font-medium">Respond</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 gap-2">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
              <p className="text-xs text-[#8B90A7] text-center">All clear — no Priority Red conversations</p>
            </div>
          )}
        </Card>

        {/* Recent AI Decisions */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#F0F2FF]">Recent AI Decisions</h2>
            <button onClick={() => navigate('/audit')} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              View audit log <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {aiDecisions.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#F0F2FF] truncate">{item.contact}</p>
                  <p className="text-[10px] text-[#8B90A7]">{item.intent}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${item.tier === 'TIER_2' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                    {item.tier}
                  </span>
                  <span className="text-[10px] text-[#4B5068] font-mono">${item.cost}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-[#F0F2FF] mb-3">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Create Flow', icon: <Zap className="w-4 h-4" />, action: () => navigate('/flows'), primary: true },
            { label: 'New Broadcast', icon: <Megaphone className="w-4 h-4" />, action: () => navigate('/broadcasts') },
            { label: 'Import Contacts', icon: <UserPlus className="w-4 h-4" />, action: () => navigate('/contacts') },
            { label: 'Test Webhook', icon: <TestTube2 className="w-4 h-4" />, action: () => {} },
          ].map(item => (
            <button
              key={item.label}
              onClick={item.action}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-150 ${
                item.primary
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
                  : 'bg-[#1A1C24] border-[#2A2E42] text-[#8B90A7] hover:bg-[#222530] hover:text-[#F0F2FF]'
              }`}
            >
              {item.icon}
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function OnboardingChecklist() {
  const navigate = useNavigate();
  const steps = [
    { label: 'Connect your first account', desc: 'Link Instagram, Facebook, or TikTok to start', action: () => navigate('/health'), done: false },
    { label: 'Create your first flow', desc: 'Use a template or build from scratch', action: () => navigate('/flows'), done: false },
    { label: 'Test your flow', desc: 'Send a test trigger to verify everything works', action: () => {}, done: false },
    { label: 'Invite your team', desc: 'Bring your team to collaborate in real-time', action: () => navigate('/settings'), done: false },
  ];

  return (
    <div className="p-6 max-w-xl mx-auto mt-12">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
          <Zap className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-[#F0F2FF] mb-2">Welcome to FlowPulse</h1>
        <p className="text-[#8B90A7]">Let's get you set up in under 90 seconds</p>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#F0F2FF]">Setup checklist</h2>
          <span className="text-xs text-[#8B90A7]">0 of 4 complete</span>
        </div>
        <div className="h-1.5 bg-[#1E2130] rounded-full mb-6">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: '0%' }} />
        </div>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#111318] border border-[#1E2130]">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${step.done ? 'bg-green-500' : 'border-2 border-[#2A2E42]'}`}>
                {step.done ? <CheckCircle2 className="w-4 h-4 text-white" /> : <span className="text-xs text-[#4B5068]">{i + 1}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${step.done ? 'text-[#4B5068] line-through' : 'text-[#F0F2FF]'}`}>{step.label}</p>
                <p className="text-xs text-[#8B90A7] mt-0.5">{step.desc}</p>
              </div>
              {!step.done && (
                <button onClick={step.action} className="text-xs text-blue-400 hover:text-blue-300 font-medium flex-shrink-0">
                  Start →
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
