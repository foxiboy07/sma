import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Download, Brain } from 'lucide-react';
import { Card, Badge, Button } from '../components/ui';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';

interface AuditLog {
  id: string;
  contact: string;
  intent: string;
  model_tier: string;
  token_count: number;
  estimated_cost_usd: number;
  created_at: string;
  prompt_text: string;
  kb_chunks: { doc: string; score: number; text: string }[];
  function_calls: { name: string; input: Record<string, unknown>; output: unknown }[];
  response: string;
}

export function AuditLogPage() {
  const { tenant } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState('all');

  useEffect(() => {
    if (!tenant) return;

    async function fetchLogs() {
      setLoading(true);

      // AI audit logs are served via API in a future iteration
      const logsRes = { data: [] as Record<string, unknown>[] };
      const contactMap = new Map<string, string>();

      const mapped: AuditLog[] = (logsRes.data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        contact: contactMap.get(row.contact_id as string) ?? 'Unknown',
        intent: (row.intent_classified as string) ?? '',
        model_tier: (row.model_tier as string) ?? '',
        token_count: (row.token_count as number) ?? 0,
        estimated_cost_usd: Number(row.estimated_cost_usd ?? 0),
        created_at: row.created_at as string,
        prompt_text: (row.prompt_text as string) ?? '',
        kb_chunks: Array.isArray(row.kb_chunks_retrieved) ? row.kb_chunks_retrieved : [],
        function_calls: Array.isArray(row.function_calls) ? row.function_calls : [],
        response: (row.response_text as string) ?? '',
      }));

      setLogs(mapped);
      setLoading(false);
    }

    fetchLogs();
  }, [tenant]);

  const filtered = logs.filter(l => tierFilter === 'all' || l.model_tier === tierFilter);

  function exportCSV() {
    const headers = ['Time', 'Contact', 'Intent', 'Model Tier', 'Tokens', 'Cost (USD)', 'Response'];
    const rows = filtered.map(l => [
      format(new Date(l.created_at), "yyyy-MM-dd'T'HH:mm:ss"),
      `"${l.contact.replace(/"/g, '""')}"`,
      l.intent,
      l.model_tier,
      l.token_count,
      l.estimated_cost_usd.toFixed(6),
      `"${l.response.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#F0F2FF]">AI Audit Log</h1>
          <p className="text-xs text-[#8B90A7] mt-0.5">Full decision trace for every AI response — 1 year retention</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 p-1 bg-[#111318] rounded-lg border border-[#1E2130]">
            {['all', 'TIER_1', 'TIER_2'].map(t => (
              <button key={t} onClick={() => setTierFilter(t)} className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${tierFilter === t ? 'bg-[#1A1C24] text-[#F0F2FF]' : 'text-[#8B90A7] hover:text-[#F0F2FF]'}`}>
                {t === 'all' ? 'All' : t}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={exportCSV}><Download className="w-3.5 h-3.5" /> Export CSV</Button>
        </div>
      </div>

      <div className="bg-[#111318] border border-[#1E2130] rounded-xl overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-[#1E2130]">
              {['Time', 'Contact', 'Intent', 'Model', 'Tokens', 'Cost', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-[#8B90A7]">
                  <Brain className="w-5 h-5 mx-auto mb-2 animate-pulse text-[#4B5068]" />
                  Loading audit logs…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-[#8B90A7]">
                  No audit logs found.
                </td>
              </tr>
            )}
            {filtered.map(log => (
              <React.Fragment key={log.id}>
                <tr className="border-b border-[#1E2130] hover:bg-[#1A1C24] transition-colors">
                  <td className="px-4 py-3 text-xs text-[#8B90A7]">{format(new Date(log.created_at), 'HH:mm:ss')}</td>
                  <td className="px-4 py-3 text-xs font-medium text-[#F0F2FF]">{log.contact}</td>
                  <td className="px-4 py-3"><Badge variant="info">{log.intent}</Badge></td>
                  <td className="px-4 py-3">
                    <Badge variant={log.model_tier === 'TIER_2' ? 'warning' : 'info'}>{log.model_tier}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-[#8B90A7]">{log.token_count}</td>
                  <td className="px-4 py-3 text-xs font-mono text-[#8B90A7]">${log.estimated_cost_usd.toFixed(6)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium"
                    >
                      Why? {expanded === log.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </td>
                </tr>
                {expanded === log.id && (
                  <tr className="border-b border-[#1E2130]">
                    <td colSpan={7} className="px-4 py-4 bg-[#0A0B0F]">
                      <div className="space-y-3 font-mono text-[11px] max-w-3xl">
                        <div className="rounded-lg border border-[#1E2130] overflow-hidden">
                          <div className="px-3 py-1.5 bg-[#111318] border-b border-[#1E2130] text-[10px] font-sans font-semibold text-[#4B5068] uppercase tracking-wider">System Prompt</div>
                          <pre className="p-3 text-[#8B90A7] whitespace-pre-wrap text-[11px]">{log.prompt_text}</pre>
                        </div>

                        {log.kb_chunks.length > 0 && (
                          <div className="rounded-lg border border-[#1E2130] overflow-hidden">
                            <div className="px-3 py-1.5 bg-[#111318] border-b border-[#1E2130] text-[10px] font-sans font-semibold text-[#4B5068] uppercase tracking-wider">KB Chunks Retrieved</div>
                            <div className="p-3 space-y-2">
                              {log.kb_chunks.map((c, i) => (
                                <div key={i}>
                                  <span className="text-green-400">Chunk {i + 1} (score: {c.score})</span>
                                  <span className="text-[#4B5068]"> — {c.doc}</span>
                                  <div className="text-[#8B90A7] mt-0.5 pl-2 border-l border-[#2A2E42]">{c.text}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {log.function_calls.length > 0 && (
                          <div className="rounded-lg border border-[#1E2130] overflow-hidden">
                            <div className="px-3 py-1.5 bg-[#111318] border-b border-[#1E2130] text-[10px] font-sans font-semibold text-[#4B5068] uppercase tracking-wider">Function Calls</div>
                            <div className="p-3 space-y-2">
                              {log.function_calls.map((f, i) => (
                                <div key={i}>
                                  <span className="text-blue-400">{f.name}</span>
                                  <span className="text-[#4B5068]">({JSON.stringify(f.input)})</span>
                                  <div className="text-[#8B90A7] mt-0.5">→ {JSON.stringify(f.output)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="rounded-lg border border-[#1E2130] overflow-hidden">
                          <div className="px-3 py-1.5 bg-[#111318] border-b border-[#1E2130] text-[10px] font-sans font-semibold text-[#4B5068] uppercase tracking-wider">Response</div>
                          <pre className="p-3 text-[#F0F2FF] whitespace-pre-wrap">{log.response}</pre>
                        </div>

                        <div className="flex items-center gap-4 text-[10px] font-sans text-[#4B5068]">
                          <span className={log.model_tier === 'TIER_2' ? 'text-amber-400' : 'text-blue-400'}>{log.model_tier}</span>
                          <span>·</span>
                          <span>{log.token_count} tokens</span>
                          <span>·</span>
                          <span>${log.estimated_cost_usd.toFixed(6)}</span>
                          <span>·</span>
                          <span>{format(new Date(log.created_at), 'HH:mm:ss')}</span>
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
    </div>
  );
}
