import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, X, ChevronDown, ChevronUp, Clock, AlertTriangle, CheckCircle2, Loader } from 'lucide-react';
import { Button, Badge, Card, EmptyState, PlatformIcon } from '../components/ui';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { dlqApi } from '../lib/api';

const ERROR_LABELS: Record<string, string> = {
  '24H_WINDOW_EXPIRED': '24-hour window expired',
  TOKEN_INVALID: 'Access token invalid',
  SHOPIFY_TIMEOUT: 'Shopify API timeout',
  META_API_503: 'Meta API unavailable',
  TIKTOK_API_403: 'TikTok API forbidden',
  LAMBDA_TIMEOUT: 'Processing timeout',
  UNKNOWN: 'Unknown error',
};

interface DLQMessageDisplay {
  id: string;
  platform: string;
  contact_name: string;
  flow_name: string;
  node_id: string;
  error_code: string;
  status: string;
  retry_count: number;
  created_at: string;
  retry_history: { at: string; result: string; reason: string }[];
  payload: Record<string, unknown>;
}

export function DLQPage() {
  const { tenant } = useAuth();
  const [messages, setMessages] = useState<DLQMessageDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [errorFilter, setErrorFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replaying, setReplaying] = useState<string | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchProgress, setBatchProgress] = useState<null | { done: number; total: number }>(null);

  useEffect(() => {
    if (!tenant?.id) return;
    setLoading(true);
    setError(null);
    dlqApi.messages(tenant.id)
      .then((res) => {
        const mapped: DLQMessageDisplay[] = (res.messages ?? res ?? []).map((m: any) => ({
          id: m.id,
          platform: m.platform ?? 'UNKNOWN',
          contact_name: m.contact_name ?? 'Unknown',
          flow_name: m.flow_name ?? 'Unknown flow',
          node_id: m.node_id ?? '',
          error_code: m.error_code ?? 'UNKNOWN',
          status: m.status ?? 'PENDING',
          retry_count: m.retry_count ?? 0,
          created_at: m.created_at ?? new Date().toISOString(),
          retry_history: (m.retry_history ?? []).map((h: any) => ({
            at: h.at ?? h.attempted_at ?? '',
            result: h.result ?? 'failed',
            reason: h.reason ?? h.error_detail ?? '',
          })),
          payload: m.original_payload ?? m.payload ?? {},
        }));
        setMessages(mapped);
      })
      .catch((err) => setError(err.message || 'Failed to load DLQ messages'))
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  const pending = messages.filter(m => m.status === 'PENDING');

  const filtered = messages.filter(m => {
    if (platformFilter !== 'all' && m.platform !== platformFilter) return false;
    if (errorFilter !== 'all' && m.error_code !== errorFilter) return false;
    return true;
  });

  async function replayMessage(id: string) {
    setReplaying(id);
    try {
      await dlqApi.replay(id);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'REPLAYED', retry_count: m.retry_count + 1 } : m));
    } catch {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'FAILED' } : m));
    } finally {
      setReplaying(null);
    }
  }

  async function batchReplay() {
    if (!tenant?.id) return;
    setBatchProgress({ done: 0, total: pending.length });
    setShowBatchModal(false);
    try {
      const res = await dlqApi.batchReplay(tenant.id);
      const replayedCount = res.replayed_count ?? res.count ?? pending.length;
      setBatchProgress({ done: replayedCount, total: pending.length });
      setMessages(prev => prev.map(m => m.status === 'PENDING' ? { ...m, status: 'REPLAYED', retry_count: m.retry_count + 1 } : m));
    } catch {
      setBatchProgress(null);
    }
    setTimeout(() => setBatchProgress(null), 2000);
  }

  const statusBadge = (s: string) => {
    if (s === 'PENDING') return <Badge variant="warning">Pending</Badge>;
    if (s === 'DISMISSED') return <Badge variant="default">Dismissed</Badge>;
    if (s === 'REPLAYED') return <Badge variant="success">Replayed</Badge>;
    return <Badge variant="danger">Failed again</Badge>;
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-[#F0F2FF]">Dead Letter Queue</h1>
            {pending.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20">{pending.length}</span>
            )}
          </div>
          <p className="text-xs text-[#8B90A7]">Next auto-replay scan in 8 minutes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => {
            const rows = filtered.map(m => [
              m.created_at,
              m.platform,
              m.contact_name,
              m.flow_name,
              m.error_code,
              m.retry_count,
              m.status,
              JSON.stringify(m.payload),
            ]);
            const csv = ['Time,Platform,Contact,Flow,Error,Retries,Status,Payload', ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dlq-export-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}><Download className="w-3.5 h-3.5" /> Export</Button>
          {pending.length > 0 && (
            <Button variant="primary" size="sm" onClick={() => setShowBatchModal(true)}>
              <RefreshCw className="w-3.5 h-3.5" /> Batch Replay All ({pending.length})
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 overflow-x-auto">
        <div className="flex gap-1 p-1 bg-[#111318] rounded-lg border border-[#1E2130]">
          {['all', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK'].map(p => (
            <button key={p} onClick={() => setPlatformFilter(p)} className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${platformFilter === p ? 'bg-[#1A1C24] text-[#F0F2FF]' : 'text-[#8B90A7] hover:text-[#F0F2FF]'}`}>
              {p === 'all' ? 'All platforms' : p.charAt(0) + p.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 bg-[#111318] rounded-lg border border-[#1E2130]">
          <button onClick={() => setErrorFilter('all')} className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${errorFilter === 'all' ? 'bg-[#1A1C24] text-[#F0F2FF]' : 'text-[#8B90A7] hover:text-[#F0F2FF]'}`}>All errors</button>
          {Object.keys(ERROR_LABELS).map(e => (
            <button key={e} onClick={() => setErrorFilter(e)} className={`px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all whitespace-nowrap ${errorFilter === e ? 'bg-[#1A1C24] text-[#F0F2FF]' : 'text-[#8B90A7] hover:text-[#F0F2FF]'}`}>{e}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader className="w-6 h-6 text-blue-400 animate-spin" />
          <span className="ml-3 text-sm text-[#8B90A7]">Loading DLQ messages...</span>
        </div>
      ) : error ? (
        <EmptyState icon={<AlertTriangle className="w-8 h-8" />} title="Failed to load" description={error} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<CheckCircle2 className="w-8 h-8" />} title="All clear" description="No failed messages in the Dead Letter Queue." />
      ) : (
        <div className="bg-[#111318] border border-[#1E2130] rounded-xl overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-[#1E2130]">
                {['Time Failed', 'Platform', 'Contact', 'Flow', 'Error', 'Retries', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(msg => (
                <React.Fragment key={msg.id}>
                  <tr className="border-b border-[#1E2130] hover:bg-[#1A1C24] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-xs text-[#F0F2FF]">{format(new Date(msg.created_at), 'HH:mm')}</p>
                      <p className="text-[10px] text-[#4B5068]">{formatDistanceToNow(new Date(msg.created_at))} ago</p>
                    </td>
                    <td className="px-4 py-3"><PlatformIcon platform={msg.platform} size={16} /></td>
                    <td className="px-4 py-3 text-xs text-[#F0F2FF]">{msg.contact_name}</td>
                    <td className="px-4 py-3 text-xs text-[#8B90A7]">{msg.flow_name}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-xs text-red-400 font-medium">{ERROR_LABELS[msg.error_code] || msg.error_code}</p>
                        <p className="text-[10px] text-[#4B5068] font-mono">{msg.error_code}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#8B90A7]">{msg.retry_count}/3</td>
                    <td className="px-4 py-3">{statusBadge(msg.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {msg.status === 'PENDING' && (
                          <button
                            onClick={() => replayMessage(msg.id)}
                            disabled={replaying === msg.id}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                          >
                            {replaying === msg.id ? <Loader className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Replay
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            try {
                              await dlqApi.dismiss(msg.id);
                              setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'DISMISSED' } : m));
                            } catch { /* keep current state on failure */ }
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[#8B90A7] hover:bg-[#222530] transition-colors"
                        >
                          <X className="w-3 h-3" /> Dismiss
                        </button>
                        <button
                          onClick={() => setExpanded(expanded === msg.id ? null : msg.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[#8B90A7] hover:bg-[#222530] transition-colors"
                        >
                          Details {expanded === msg.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded === msg.id && (
                    <tr className="border-b border-[#1E2130]">
                      <td colSpan={8} className="px-4 py-4 bg-[#1A1C24]">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider mb-2">Original Payload</p>
                            <pre className="text-[10px] font-mono text-[#8B90A7] bg-[#111318] rounded-lg p-3 overflow-x-auto">
                              {JSON.stringify(msg.payload, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider mb-2">Retry History</p>
                            {msg.retry_history.length > 0 ? (
                              <div className="space-y-1.5">
                                {msg.retry_history.map((h, i) => (
                                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[#111318] text-xs">
                                    <span className="text-[#4B5068]">Attempt {i + 1} at {h.at}</span>
                                    <span className="text-red-400">{h.result}</span>
                                    <span className="text-[#8B90A7] font-mono text-[10px]">{h.reason}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-[#4B5068]">No retry attempts yet</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Batch progress */}
      {batchProgress && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#1A1C24] border border-[#2A2E42] rounded-xl px-4 py-3 shadow-2xl">
          <Loader className="w-4 h-4 text-blue-400 animate-spin" />
          <span className="text-sm text-[#F0F2FF]">Replaying: {batchProgress.done} / {batchProgress.total} complete</span>
          <div className="w-24 h-1.5 bg-[#222530] rounded-full">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Batch confirm modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowBatchModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-[#1A1C24] border border-[#2A2E42] rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[#F0F2FF] mb-2">Batch Replay Confirmation</h3>
            <p className="text-sm text-[#8B90A7] mb-4">Replay all {pending.length} pending messages from the last 6 hours?</p>
            <div className="space-y-1.5 mb-4">
              {Object.entries(pending.reduce((acc, m) => ({ ...acc, [m.error_code]: (acc[m.error_code] || 0) + 1 }), {} as Record<string, number>)).map(([code, count]) => (
                <div key={code} className="flex justify-between text-xs">
                  <span className="text-[#8B90A7]">{ERROR_LABELS[code] || code}</span>
                  <span className="text-[#F0F2FF] font-medium">{count}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setShowBatchModal(false)}>Cancel</Button>
              <Button variant="primary" className="flex-1" onClick={batchReplay}>Replay All</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
