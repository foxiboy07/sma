import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Send, Users, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button, Badge, Card, Modal, Select, Tabs, PlatformIcon } from '../components/ui';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { broadcastApi } from '../lib/api';

const MESSAGE_TAGS = [
  { value: 'POST_PURCHASE_UPDATE', label: 'Post Purchase Update' },
  { value: 'CONFIRMED_EVENT_UPDATE', label: 'Confirmed Event Update' },
  { value: 'ACCOUNT_UPDATE', label: 'Account Update' },
];

export function BroadcastsPage() {
  const { tenant, brand } = useAuth();
  const [tab, setTab] = useState('campaigns');
  const [showComposer, setShowComposer] = useState(false);
  const [step, setStep] = useState(1);
  const [platform, setPlatform] = useState('INSTAGRAM');
  const [message, setMessage] = useState('');
  const [reach, setReach] = useState(2840);
  const [windowEligible, setWindowEligible] = useState(1203);
  const [needsTag, setNeedsTag] = useState(false);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!tenant?.id) return;
    setLoadingBroadcasts(true);
    broadcastApi.list(tenant.id, brand?.id)
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.data ?? res?.broadcasts ?? [];
        setBroadcasts(list.map((b: any) => ({
          id: b.id,
          name: b.name,
          status: b.status,
          platform: b.platform ?? 'INSTAGRAM',
          scheduled_at: b.scheduled_at ?? null,
          sent_count: b.sent_count ?? 0,
          delivered_count: b.delivered_count ?? 0,
          replied_count: b.replied_count ?? 0,
          revenue_attributed: b.revenue_attributed ?? 0,
        })));
      })
      .catch(() => setBroadcasts([]))
      .finally(() => setLoadingBroadcasts(false));
  }, [tenant?.id, brand?.id]);

  const refreshBroadcasts = () => {
    if (!tenant?.id) return;
    broadcastApi.list(tenant.id, brand?.id)
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.data ?? res?.broadcasts ?? [];
        setBroadcasts(list.map((b: any) => ({
          id: b.id,
          name: b.name,
          status: b.status,
          platform: b.platform ?? 'INSTAGRAM',
          scheduled_at: b.scheduled_at ?? null,
          sent_count: b.sent_count ?? 0,
          delivered_count: b.delivered_count ?? 0,
          replied_count: b.replied_count ?? 0,
          revenue_attributed: b.revenue_attributed ?? 0,
        })));
      })
      .catch(() => setBroadcasts([]));
  };

  const handleCancel = async (broadcastId: string) => {
    try {
      await broadcastApi.cancel(broadcastId);
      setBroadcasts(prev => prev.map(b => b.id === broadcastId ? { ...b, status: 'cancelled' } : b));
    } catch (err) {
      console.error('Failed to cancel broadcast:', err);
    }
  };

  const handleSendNow = async (broadcastId: string) => {
    try {
      await broadcastApi.send(broadcastId);
      setBroadcasts(prev => prev.map(b => b.id === broadcastId ? { ...b, status: 'sending' } : b));
    } catch (err) {
      console.error('Failed to send broadcast:', err);
    }
  };

  const handleComposerSubmit = async () => {
    if (!tenant?.id || !brand?.id || sending) return;
    setSending(true);
    try {
      await broadcastApi.create(
        tenant.id,
        brand.id,
        `Broadcast ${new Date().toLocaleDateString()}`,
        platform,
        message,
        needsTag ? MESSAGE_TAGS[0].value : undefined,
        undefined,
        undefined,
      );
      refreshBroadcasts();
    } catch (err) {
      console.error('Failed to create broadcast:', err);
    } finally {
      setSending(false);
      setShowComposer(false);
    }
  };

  const statusBadge = (s: string) => {
    const map = { sent: 'success', scheduled: 'info', sending: 'warning', draft: 'default', cancelled: 'danger' } as const;
    return <Badge variant={map[s as keyof typeof map] || 'default'}>{s.charAt(0).toUpperCase() + s.slice(1)}</Badge>;
  };

  return (
    <div className="p-6 max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[#F0F2FF]">Broadcasts</h1>
        <Button variant="primary" onClick={() => { setShowComposer(true); setStep(1); }}>
          <Plus className="w-4 h-4" /> New Broadcast
        </Button>
      </div>

      <Tabs
        tabs={[{ id: 'campaigns', label: 'Campaigns' }, { id: 'history', label: 'History' }]}
        active={tab}
        onChange={setTab}
        className="mb-6"
      />

      {tab === 'campaigns' && (
        <div className="space-y-4">
          {loadingBroadcasts ? (
            <p className="text-sm text-[#8B90A7]">Loading broadcasts...</p>
          ) : broadcasts.filter(b => b.status !== 'sent').length === 0 ? (
            <p className="text-sm text-[#8B90A7]">No active campaigns.</p>
          ) : (
            broadcasts.filter(b => b.status !== 'sent').map(b => (
              <Card key={b.id} className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <PlatformIcon platform={b.platform} size={24} />
                  <div>
                    <p className="text-sm font-semibold text-[#F0F2FF]">{b.name}</p>
                    <p className="text-xs text-[#8B90A7] mt-0.5">
                      {b.scheduled_at ? `Scheduled: ${format(new Date(b.scheduled_at), 'MMM d, yyyy HH:mm')}` : 'Not scheduled'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(b.status)}
                  <Button variant="secondary" size="sm">Edit</Button>
                  {b.status === 'scheduled' && <Button variant="danger" size="sm" onClick={() => handleCancel(b.id)}>Cancel</Button>}
                  {b.status === 'draft' && <Button variant="primary" size="sm" onClick={() => handleSendNow(b.id)}>Send Now</Button>}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-[#111318] border border-[#1E2130] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1E2130]">
                {['Date Sent', 'Name', 'Platform', 'Sent', 'Delivered', 'Replied', 'Revenue'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingBroadcasts ? (
                <tr><td colSpan={7} className="px-4 py-3 text-xs text-[#8B90A7]">Loading...</td></tr>
              ) : broadcasts.filter(b => b.status === 'sent').length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-3 text-xs text-[#8B90A7]">No broadcast history yet.</td></tr>
              ) : (
                broadcasts.filter(b => b.status === 'sent').map(b => (
                  <tr key={b.id} className="border-b border-[#1E2130] hover:bg-[#1A1C24] transition-colors">
                    <td className="px-4 py-3 text-xs text-[#8B90A7]">{b.scheduled_at ? format(new Date(b.scheduled_at), 'MMM d, yyyy') : '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[#F0F2FF]">{b.name}</td>
                    <td className="px-4 py-3"><PlatformIcon platform={b.platform} size={16} /></td>
                    <td className="px-4 py-3 text-sm text-[#F0F2FF]">{b.sent_count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-[#F0F2FF]">{b.delivered_count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-green-400 font-medium">{b.replied_count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-green-400">${b.revenue_attributed.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Broadcast Composer */}
      <Modal open={showComposer} onClose={() => setShowComposer(false)} title={`New Broadcast — Step ${step} of 4`} maxWidth="max-w-2xl">
        <div className="mb-4">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${s <= step ? 'bg-blue-500' : 'bg-[#2A2E42]'}`} />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#F0F2FF]">Step 1: Choose Audience</h3>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">Only contacts who interacted within the last 24 hours are eligible for standard broadcasts. Use Message Tags for post-window sends.</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[#8B90A7] block mb-1">Platform</label>
              <div className="flex gap-2">
                {['INSTAGRAM', 'FACEBOOK', 'TIKTOK'].map(p => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${platform === p ? 'border-blue-500/40 bg-blue-500/10 text-[#F0F2FF]' : 'border-[#2A2E42] text-[#8B90A7] hover:border-[#2A2E42]'}`}
                  >
                    <PlatformIcon platform={p} size={16} />
                    <span className="text-xs font-medium">{p.charAt(0) + p.slice(1).toLowerCase()}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[#8B90A7] block mb-2">Audience Filters</label>
              <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-[#111318] border border-[#1E2130] mb-2">
                {[{ label: 'Loyalty tier = Fan' }, { label: 'Tag = vip' }].map(f => (
                  <span key={f.label} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF]">
                    {f.label} <button className="text-[#4B5068] hover:text-red-400">×</button>
                  </span>
                ))}
                <button className="px-2 py-1 rounded-lg border border-dashed border-[#2A2E42] text-xs text-[#4B5068] hover:text-[#F0F2FF]">+ Add filter</button>
              </div>
              <div className="flex gap-4">
                <div className="p-3 rounded-xl bg-[#111318] border border-[#1E2130] flex-1 text-center">
                  <p className="text-xl font-bold text-[#F0F2FF]">{reach.toLocaleString()}</p>
                  <p className="text-xs text-[#8B90A7]">Estimated reach</p>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex-1 text-center">
                  <p className="text-xl font-bold text-green-400">{windowEligible.toLocaleString()}</p>
                  <p className="text-xs text-[#8B90A7]">Within 24h window</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#F0F2FF]">Step 2: Compose Message</h3>
            <div>
              <label className="text-xs font-medium text-[#8B90A7] block mb-1">Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Hi {{contact.name}}! We have an exclusive offer for you..."
                rows={4}
                className="w-full rounded-xl bg-[#111318] border border-[#2A2E42] text-sm text-[#F0F2FF] placeholder:text-[#4B5068] p-3 focus:outline-none focus:border-blue-500 resize-none"
              />
              <p className="text-[10px] text-[#4B5068] mt-1">{message.length}/1000 characters</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={needsTag} onChange={e => setNeedsTag(e.target.checked)} className="rounded border-[#2A2E42]" />
              <label className="text-xs text-[#8B90A7]">Send to post-window contacts (requires Message Tag)</label>
            </div>
            {needsTag && (
              <Select
                label="Message Tag"
                options={MESSAGE_TAGS}
              />
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#F0F2FF]">Step 3: Schedule</h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-left">
                <p className="text-sm font-semibold text-blue-400">Send Now</p>
                <p className="text-xs text-[#8B90A7] mt-1">Start sending immediately</p>
              </button>
              <button className="p-4 rounded-xl bg-[#111318] border border-[#2A2E42] text-left hover:border-[#4B5068]">
                <p className="text-sm font-semibold text-[#F0F2FF]">Schedule for Later</p>
                <p className="text-xs text-[#8B90A7] mt-1">Pick a date and time</p>
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#F0F2FF]">Step 4: Review & Send</h3>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-[#111318] border border-[#1E2130]">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-[#8B90A7]">Platform</span>
                  <div className="flex items-center gap-1"><PlatformIcon platform={platform} size={12} /><span className="text-[#F0F2FF]">{platform.charAt(0) + platform.slice(1).toLowerCase()}</span></div>
                </div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-[#8B90A7]">Audience</span>
                  <span className="text-[#F0F2FF]">{reach.toLocaleString()} contacts</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#8B90A7]">24H eligible</span>
                  <span className="text-green-400">{windowEligible.toLocaleString()}</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <p className="text-xs text-green-300">24H compliance check passed</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between pt-4 border-t border-[#1E2130] mt-4">
          <Button variant="ghost" onClick={() => { if (step > 1) setStep(s => s - 1); else setShowComposer(false); }}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          <Button variant="primary" disabled={sending} onClick={() => { if (step < 4) setStep(s => s + 1); else handleComposerSubmit(); }}>
            {step === 4 ? <><Send className="w-3.5 h-3.5" /> Send Now</> : <>Next <ArrowRight className="w-3.5 h-3.5" /></>}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
