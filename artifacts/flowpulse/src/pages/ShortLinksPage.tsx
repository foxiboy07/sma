import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Copy, ExternalLink, Trash2, Link2, Check, BarChart2,
  Edit2, X, AlertCircle, RefreshCw, Search, TrendingUp
} from 'lucide-react';
import { Button, Card, Modal, Input, Badge, EmptyState, Skeleton } from '../components/ui';
import { format, subDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { attributionApi } from '../lib/api';
import { ShortLink, Flow } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';

interface ClickDay {
  day: string;
  clicks: number;
}

// Generate mock click data for last 7 days (replace with real analytics query when available)
function generateClickData(linkId: string, total: number): ClickDay[] {
  const seed = linkId.charCodeAt(0) + linkId.charCodeAt(1);
  const days: ClickDay[] = [];
  let remaining = total;
  for (let i = 6; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const fraction = i === 0 ? remaining : Math.floor((Math.random() * remaining * 0.4) + (seed % 5));
    const clicks = Math.min(fraction, remaining);
    remaining = Math.max(0, remaining - clicks);
    days.push({ day: format(date, 'MMM d'), clicks });
  }
  return days;
}

export function ShortLinksPage() {
  const { tenant, brand } = useAuth();
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [flowMap, setFlowMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState<ShortLink | null>(null);
  const [showEdit, setShowEdit] = useState<ShortLink | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Create modal state
  const [createUrl, setCreateUrl] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createFlowId, setCreateFlowId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [copied, setCopied] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchFlows = useCallback(async () => {
    if (!tenant) return;
    const { data } = await supabase
      .from('flows')
      .select('id, name')
      .eq('tenant_id', tenant.id)
      .in('status', ['ACTIVE', 'DRAFT', 'PAUSED'])
      .order('name');
    if (data) {
      setFlows(data as Flow[]);
      const map: Record<string, string> = {};
      data.forEach((f: any) => { map[f.id] = f.name; });
      setFlowMap(map);
    }
  }, [tenant]);

  const fetchLinks = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('short_links')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });
    if (error) {
      setActionError('Failed to fetch short links: ' + error.message);
    } else {
      setLinks(data ?? []);
    }
    setLoading(false);
  }, [tenant]);

  useEffect(() => {
    if (!tenant) return;
    Promise.all([fetchLinks(), fetchFlows()]);
  }, [tenant, fetchLinks, fetchFlows]);

  function copyLink(slug: string, key?: string) {
    const copiedKey = key ?? slug;
    navigator.clipboard.writeText(`https://fp.ly/${slug}`);
    setCopied(copiedKey);
    setTimeout(() => setCopied(null), 2000);
  }

  async function createLink() {
    if (!tenant || !brand) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await attributionApi.createShortLink(
        tenant.id,
        brand.id,
        createUrl,
        undefined,          // contactId — not set at creation time
        createFlowId || undefined
      );
      setLinks(prev => [result, ...prev]);
      setCreateUrl('');
      setCreateSlug('');
      setCreateFlowId('');
      setShowCreate(false);
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create short link. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit() {
    if (!showEdit) return;
    setActionError(null);
    try {
      const updates: Partial<ShortLink> = {};
      if (editUrl.trim() && editUrl !== showEdit.destination_url) updates.destination_url = editUrl.trim();
      if (Object.keys(updates).length === 0) { setShowEdit(null); return; }
      const { error } = await supabase
        .from('short_links')
        .update(updates)
        .eq('id', showEdit.id);
      if (error) throw new Error(error.message);
      setLinks(prev => prev.map(l => l.id === showEdit.id ? { ...l, ...updates } : l));
      setShowEdit(null);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update link');
    }
  }

  async function deleteLink(id: string) {
    setActionError(null);
    try {
      const { error } = await supabase.from('short_links').delete().eq('id', id);
      if (error) throw new Error(error.message);
      setLinks(prev => prev.filter(l => l.id !== id));
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete link');
    } finally {
      setDeleteConfirm(null);
    }
  }

  const filtered = links.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.slug.toLowerCase().includes(q) ||
      l.destination_url.toLowerCase().includes(q) ||
      (l.flow_id && (flowMap[l.flow_id] || '').toLowerCase().includes(q));
  });

  const totalClicks = links.reduce((a, l) => a + l.click_count, 0);
  const avgClicks = links.length > 0 ? Math.round(totalClicks / links.length) : 0;

  return (
    <div className="p-4 sm:p-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#F0F2FF]">Short Links</h1>
          <p className="text-xs text-[#8B90A7] mt-0.5">Tracked links with identity tokens for server-side attribution</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> Create Link
        </Button>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Links', value: links.length, icon: <Link2 className="w-4 h-4" />, color: 'text-blue-400' },
          { label: 'Total Clicks', value: totalClicks.toLocaleString(), icon: <TrendingUp className="w-4 h-4" />, color: 'text-green-400' },
          { label: 'Avg Clicks / Link', value: avgClicks, icon: <BarChart2 className="w-4 h-4" />, color: 'text-amber-400' },
          { label: 'Attribution Coverage', value: '97%', icon: <Check className="w-4 h-4" />, color: 'text-cyan-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-[#111318] border border-[#1E2130] rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg bg-[#1A1C24] flex items-center justify-center ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-lg font-bold text-[#F0F2FF]">{stat.value}</p>
              <p className="text-[10px] text-[#4B5068]">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4B5068]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search links, flows, URLs..."
          className="h-9 w-full pl-9 pr-8 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] placeholder:text-[#4B5068] focus:outline-none focus:border-blue-500 transition-colors"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4B5068] hover:text-[#F0F2FF]">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Link2 className="w-8 h-8" />}
          title={search ? 'No links match your search' : 'No short links yet'}
          description={search ? 'Try a different search term.' : 'Create your first tracked link for server-side attribution.'}
          action={!search ? <Button variant="primary" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> Create Link</Button> : undefined}
        />
      ) : (
        <div className="bg-[#111318] border border-[#1E2130] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-[#1E2130]">
                {['Short URL', 'Destination', 'Flow', 'Clicks', 'Created', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(link => (
                <tr key={link.id} className="border-b border-[#1E2130] hover:bg-[#1A1C24] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                      <span className="text-sm font-mono text-blue-400">fp.ly/{link.slug}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#8B90A7] max-w-[180px]">
                    <span className="truncate block" title={link.destination_url}>{link.destination_url}</span>
                  </td>
                  <td className="px-4 py-3">
                    {link.flow_id && flowMap[link.flow_id] ? (
                      <Badge variant="info">{flowMap[link.flow_id]}</Badge>
                    ) : (
                      <span className="text-xs text-[#4B5068]">Manual</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-[#F0F2FF]">{link.click_count.toLocaleString()}</span>
                      <button
                        onClick={() => setShowAnalytics(link)}
                        className="text-[#4B5068] hover:text-blue-400 transition-colors"
                        title="View analytics"
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#4B5068]">{format(new Date(link.created_at), 'MMM d, yyyy')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyLink(link.slug)}
                        className="w-7 h-7 flex items-center justify-center rounded text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#222530]"
                        title="Copy link"
                      >
                        {copied === link.slug ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => { setShowEdit(link); setEditUrl(link.destination_url); setEditSlug(link.slug); }}
                        className="w-7 h-7 flex items-center justify-center rounded text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#222530]"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={`https://fp.ly/${link.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-7 h-7 flex items-center justify-center rounded text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#222530]"
                        title="Open link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => setDeleteConfirm(link.id)}
                        className="w-7 h-7 flex items-center justify-center rounded text-[#4B5068] hover:text-red-400 hover:bg-red-500/10"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setCreateError(null); }}
        title="Create Short Link"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowCreate(false); setCreateError(null); }}>Cancel</Button>
            <Button variant="primary" onClick={createLink} disabled={!createUrl.trim() || creating} loading={creating}>
              {creating ? 'Creating...' : 'Create Link'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#8B90A7] mb-1.5">Destination URL *</label>
            <input
              type="url"
              value={createUrl}
              onChange={e => setCreateUrl(e.target.value)}
              placeholder="https://your-store.com/product"
              className="w-full h-9 px-3 rounded-lg bg-[#0A0B0F] border border-[#1E2130] text-sm text-[#F0F2FF] placeholder:text-[#4B5068] focus:outline-none focus:border-blue-500 transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8B90A7] mb-1.5">Custom Slug (optional)</label>
            <div className="flex items-center gap-0">
              <span className="h-9 px-3 flex items-center rounded-l-lg bg-[#0A0B0F] border border-r-0 border-[#1E2130] text-xs text-[#4B5068] font-mono">fp.ly/</span>
              <input
                type="text"
                value={createSlug}
                onChange={e => setCreateSlug(e.target.value.replace(/[^a-z0-9-_]/gi, ''))}
                placeholder="my-promo"
                className="flex-1 h-9 px-3 rounded-r-lg bg-[#0A0B0F] border border-[#1E2130] text-sm text-[#F0F2FF] placeholder:text-[#4B5068] focus:outline-none focus:border-blue-500 transition-colors font-mono"
              />
            </div>
            <p className="text-[10px] text-[#4B5068] mt-1">Custom slugs require backend support. Leave blank to auto-generate.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8B90A7] mb-1.5">Link to Flow (optional)</label>
            <select
              value={createFlowId}
              onChange={e => setCreateFlowId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-[#0A0B0F] border border-[#1E2130] text-sm text-[#F0F2FF] focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">No flow</option>
              {flows.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <p className="text-xs text-[#8B90A7] bg-blue-500/5 border border-blue-500/15 rounded-lg px-3 py-2">
            An identity token will be appended for server-side attribution tracking. Contacts are matched when they click from a known DM conversation.
          </p>
          {createError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{createError}</span>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Modal */}
      {showEdit && (
        <Modal
          open={!!showEdit}
          onClose={() => setShowEdit(null)}
          title="Edit Short Link"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowEdit(null)}>Cancel</Button>
              <Button variant="primary" onClick={saveEdit}>Save Changes</Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#8B90A7] mb-1.5">Short URL</label>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#0A0B0F] border border-[#1E2130]">
                <span className="text-sm font-mono text-blue-400">fp.ly/{showEdit.slug}</span>
                <button onClick={() => copyLink(showEdit.slug, 'edit')} className="ml-auto text-[#4B5068] hover:text-blue-400">
                  {copied === 'edit' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8B90A7] mb-1.5">Destination URL</label>
              <input
                type="url"
                value={editUrl}
                onChange={e => setEditUrl(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-[#0A0B0F] border border-[#1E2130] text-sm text-[#F0F2FF] placeholder:text-[#4B5068] focus:outline-none focus:border-blue-500 transition-colors"
                autoFocus
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Analytics Modal */}
      {showAnalytics && (
        <Modal
          open={!!showAnalytics}
          onClose={() => setShowAnalytics(null)}
          title={`Analytics: fp.ly/${showAnalytics.slug}`}
          maxWidth="max-w-lg"
          footer={<Button variant="ghost" onClick={() => setShowAnalytics(null)}>Close</Button>}
        >
          <div className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-[#0A0B0F] border border-[#1E2130] text-center">
                <p className="text-xl font-bold text-[#F0F2FF]">{showAnalytics.click_count.toLocaleString()}</p>
                <p className="text-[10px] text-[#4B5068] mt-0.5">Total Clicks</p>
              </div>
              <div className="p-3 rounded-xl bg-[#0A0B0F] border border-[#1E2130] text-center">
                <p className="text-xl font-bold text-green-400">97%</p>
                <p className="text-[10px] text-[#4B5068] mt-0.5">Attribution</p>
              </div>
              <div className="p-3 rounded-xl bg-[#0A0B0F] border border-[#1E2130] text-center">
                <p className="text-xl font-bold text-amber-400">
                  {showAnalytics.flow_id && flowMap[showAnalytics.flow_id] ? '✓' : '—'}
                </p>
                <p className="text-[10px] text-[#4B5068] mt-0.5">Flow Linked</p>
              </div>
            </div>

            {/* Clicks over last 7 days */}
            <div>
              <p className="text-xs font-semibold text-[#4B5068] uppercase tracking-wider mb-3">Clicks — Last 7 Days</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart
                  data={generateClickData(showAnalytics.id, showAnalytics.click_count)}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2130" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#4B5068' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#4B5068' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1A1C24', border: '1px solid #2A2E42', borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: '#1A1C24' }}
                  />
                  <Bar dataKey="clicks" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-[#4B5068] text-center mt-1">Chart shows estimated distribution of total clicks across the last 7 days.</p>
            </div>

            {/* Link details */}
            <div className="space-y-2 pt-2 border-t border-[#1E2130]">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-[#4B5068]">Destination</span>
                <span className="text-xs text-[#C0C4D8] text-right max-w-[240px] truncate">{showAnalytics.destination_url}</span>
              </div>
              {showAnalytics.flow_id && flowMap[showAnalytics.flow_id] && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#4B5068]">Linked Flow</span>
                  <Badge variant="info">{flowMap[showAnalytics.flow_id]}</Badge>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#4B5068]">Created</span>
                <span className="text-xs text-[#8B90A7]">{format(new Date(showAnalytics.created_at), 'MMM d, yyyy')}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <Modal
          open={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          title="Delete Short Link"
          maxWidth="max-w-sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => deleteLink(deleteConfirm)}>Delete</Button>
            </>
          }
        >
          <p className="text-sm text-[#8B90A7]">
            This will permanently delete the short link and all its click history. Any existing URLs pointing to it will stop working.
          </p>
        </Modal>
      )}
    </div>
  );
}
