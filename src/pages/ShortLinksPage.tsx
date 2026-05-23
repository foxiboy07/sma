import React, { useState, useEffect } from 'react';
import { Plus, Copy, ExternalLink, Trash2, Link2, Check } from 'lucide-react';
import { Button, Card, Modal, Input, Badge, EmptyState } from '../components/ui';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { attributionApi } from '../lib/api';
import { ShortLink } from '../types';

export function ShortLinksPage() {
  const { tenant, brand } = useAuth();
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    fetchLinks();
  }, [tenant]);

  async function fetchLinks() {
    if (!tenant) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('short_links')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to fetch short links:', error.message);
    } else {
      setLinks(data ?? []);
    }
    setLoading(false);
  }

  function copyLink(slug: string) {
    navigator.clipboard.writeText(`https://fp.ly/${slug}`);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  }

  async function createLink() {
    if (!tenant || !brand) return;
    setCreating(true);
    try {
      const result = await attributionApi.createShortLink(tenant.id, brand.id, url);
      setLinks(prev => [result, ...prev]);
      setUrl('');
      setShowCreate(false);
    } catch (err) {
      console.error('Failed to create short link:', err);
    } finally {
      setCreating(false);
    }
  }

  async function deleteLink(id: string) {
    const { error } = await supabase
      .from('short_links')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Failed to delete short link:', error.message);
    } else {
      setLinks(prev => prev.filter(l => l.id !== id));
    }
  }

  return (
    <div className="p-6 max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#F0F2FF]">Short Links</h1>
          <p className="text-xs text-[#8B90A7] mt-0.5">Tracked links with identity tokens for server-side attribution</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> Create Link
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><p className="text-xs text-[#8B90A7] mb-1">Total Links</p><p className="text-2xl font-bold text-[#F0F2FF]">{links.length}</p></Card>
        <Card><p className="text-xs text-[#8B90A7] mb-1">Total Clicks</p><p className="text-2xl font-bold text-[#F0F2FF]">{links.reduce((a, l) => a + l.click_count, 0).toLocaleString()}</p></Card>
        <Card><p className="text-xs text-[#8B90A7] mb-1">Attribution Coverage</p><p className="text-2xl font-bold text-green-400">97%</p></Card>
      </div>

      <div className="bg-[#111318] border border-[#1E2130] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1E2130]">
              {['Short URL', 'Destination', 'Flow', 'Clicks', 'Created', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {links.map(link => (
              <tr key={link.id} className="border-b border-[#1E2130] hover:bg-[#1A1C24] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-sm font-mono text-blue-400">fp.ly/{link.slug}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-[#8B90A7] max-w-xs truncate">{link.destination_url}</td>
                <td className="px-4 py-3 text-xs text-[#8B90A7]">{link.flow_id ?? 'Manual'}</td>
                <td className="px-4 py-3 text-sm font-semibold text-[#F0F2FF]">{link.click_count.toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-[#4B5068]">{format(new Date(link.created_at), 'MMM d, yyyy')}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => copyLink(link.slug)} className="w-7 h-7 flex items-center justify-center rounded text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#222530]">
                      {copied === link.slug ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button className="w-7 h-7 flex items-center justify-center rounded text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#222530]"><ExternalLink className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteLink(link.id)} className="w-7 h-7 flex items-center justify-center rounded text-[#4B5068] hover:text-red-400 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Short Link"
        footer={<><Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button><Button variant="primary" onClick={createLink} disabled={!url || creating}>{creating ? 'Creating...' : 'Create Link'}</Button></>}
      >
        <div className="space-y-3">
          <Input label="Destination URL" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-store.com/product" />
          <p className="text-xs text-[#8B90A7]">An identity token will be appended automatically for server-side attribution tracking.</p>
        </div>
      </Modal>
    </div>
  );
}
