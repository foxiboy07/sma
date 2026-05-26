import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Download, Upload, Merge, MoreVertical, Tag, Trash2, MessageSquare, ExternalLink, ChevronDown, X, FileUp, AlertCircle } from 'lucide-react';
import { Button, Badge, LoyaltyBadge, PlatformIcon, EmptyState, Card, Modal } from '../components/ui';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { loyaltyApi } from '../lib/api';

interface ContactRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tier: string;
  score: number;
  platforms: string[];
  tags: string[];
  sentiment: number;
  lastInteraction: Date;
  conversations: number;
  revenue: number;
}

export function ContactsPage() {
  const navigate = useNavigate();
  const { tenant, brand } = useAuth();
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('lastInteraction');
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [merging, setMerging] = useState(false);
  const [exporting, setExporting] = useState(false);

  // CSV Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState<string[][]>([]);
  const [csvAllRows, setCsvAllRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; error?: string } | null>(null);

  const CONTACT_FIELDS = ['display_name', 'email', 'phone', 'tags', 'notes', 'custom_fields'];

  function parseCSV(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    function parseLine(line: string): string[] {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    }
    if (lines.length === 0) return { headers: [], rows: [] };
    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine);
    return { headers, rows };
  }

  function handleCsvFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);
      setCsvHeaders(headers);
      setCsvPreviewRows(rows.slice(0, 5));
      setCsvAllRows(rows);
      // Auto-map headers that exactly match field names
      const autoMap: Record<string, string> = {};
      headers.forEach(h => {
        const lower = h.toLowerCase().replace(/\s+/g, '_');
        if (CONTACT_FIELDS.includes(lower)) autoMap[h] = lower;
      });
      setColumnMap(autoMap);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!tenant || !brand || csvAllRows.length === 0) return;
    setImporting(true);
    setImportResult(null);
    try {
      const map = columnMap;
      const mapped = csvAllRows.map(row => {
        const get = (field: string) => {
          const header = Object.keys(map).find(k => map[k] === field);
          if (!header) return undefined;
          const idx = csvHeaders.indexOf(header);
          return idx >= 0 ? row[idx] : undefined;
        };
        return {
          tenant_id: tenant.id,
          brand_id: brand.id,
          display_name: get('display_name') || null,
          email: get('email') || null,
          phone: get('phone') || null,
          tags: get('tags') ? get('tags')!.split(';').map(t => t.trim()).filter(Boolean) : [],
          notes: get('notes') || null,
          loyalty_score: 30,
          loyalty_tier: 'NEWBIE',
          sentiment_score: 0.5,
        };
      }).filter(r => r.display_name || r.email || r.phone);

      const { error } = await supabase.from('unified_contacts').insert(mapped);
      if (error) throw error;
      setImportResult({ count: mapped.length });
      await loadContacts();
    } catch (err: any) {
      setImportResult({ count: 0, error: err.message || 'Import failed' });
    } finally {
      setImporting(false);
    }
  }

  function closeImportModal() {
    setShowImportModal(false);
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvPreviewRows([]);
    setCsvAllRows([]);
    setColumnMap({});
    setImportResult(null);
  }

  useEffect(() => {
    if (!tenant) return;
    loadContacts();
    loadDuplicateCount();
  }, [tenant]);

  async function loadContacts() {
    if (!tenant) return;
    setLoading(true);

    try {
      // Fetch unified_contacts where tenant_id matches and gdpr_deleted_at is null
      const { data: rows, error } = await supabase
        .from('unified_contacts')
        .select('id, display_name, email, phone, loyalty_score, loyalty_tier, tags, sentiment_score, created_at')
        .eq('tenant_id', tenant.id)
        .is('gdpr_deleted_at', null);

      if (error) throw error;
      if (!rows) { setContacts([]); setLoading(false); return; }

      const contactIds = rows.map((r: any) => r.id);

      // Fetch platform_profiles for all contacts
      const { data: profiles } = await supabase
        .from('platform_profiles')
        .select('unified_contact_id, platform, last_interaction_at')
        .in('unified_contact_id', contactIds);

      // Fetch conversations count per contact
      const { data: convRows } = await supabase
        .from('conversations')
        .select('unified_contact_id, id')
        .eq('tenant_id', tenant.id);

      // Fetch attribution_events for revenue
      const { data: attrRows } = await supabase
        .from('attribution_events')
        .select('unified_contact_id, revenue_attributed')
        .eq('tenant_id', tenant.id);

      // Build lookup maps
      const profileMap = new Map<string, { platforms: string[]; lastInteraction: Date | null }>();
      (profiles || []).forEach((p: any) => {
        const existing = profileMap.get(p.unified_contact_id) || { platforms: [], lastInteraction: null };
        if (!existing.platforms.includes(p.platform)) {
          existing.platforms.push(p.platform);
        }
        const pDate = p.last_interaction_at ? new Date(p.last_interaction_at) : null;
        if (pDate && (!existing.lastInteraction || pDate > existing.lastInteraction)) {
          existing.lastInteraction = pDate;
        }
        profileMap.set(p.unified_contact_id, existing);
      });

      const convCountMap = new Map<string, number>();
      (convRows || []).forEach((c: any) => {
        convCountMap.set(c.unified_contact_id, (convCountMap.get(c.unified_contact_id) || 0) + 1);
      });

      const revenueMap = new Map<string, number>();
      (attrRows || []).forEach((a: any) => {
        if (a.unified_contact_id && a.revenue_attributed) {
          revenueMap.set(a.unified_contact_id, (revenueMap.get(a.unified_contact_id) || 0) + Number(a.revenue_attributed));
        }
      });

      // Assemble contact rows
      const assembled: ContactRow[] = rows.map((r: any) => {
        const pInfo = profileMap.get(r.id);
        const lastInteraction = pInfo?.lastInteraction || new Date(r.created_at);
        return {
          id: r.id,
          name: r.display_name || 'Unknown',
          email: r.email,
          phone: r.phone,
          tier: r.loyalty_tier || 'NEWBIE',
          score: r.loyalty_score || 0,
          platforms: pInfo?.platforms || [],
          tags: r.tags || [],
          sentiment: Number(r.sentiment_score) || 0,
          lastInteraction,
          conversations: convCountMap.get(r.id) || 0,
          revenue: revenueMap.get(r.id) || 0,
        };
      });

      // Sort by lastInteraction (newest first) as default
      assembled.sort((a, b) => b.lastInteraction.getTime() - a.lastInteraction.getTime());

      setContacts(assembled);
    } catch (err) {
      console.error('Failed to load contacts:', err);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDuplicateCount() {
    if (!tenant || !brand) return;
    try {
      const { count, error } = await supabase
        .from('identity_match_queue')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('brand_id', brand.id)
        .eq('status', 'PENDING');
      if (!error && count !== null) {
        setDuplicateCount(count);
      }
    } catch {
      // silently ignore
    }
  }

  async function handleMergeDuplicates() {
    if (!tenant || !brand || merging) return;
    setMerging(true);
    try {
      // Run identity match for each selected contact (or all if none selected)
      const targets = selected.length > 0 ? selected : contacts.map(c => c.id);
      const results = await Promise.allSettled(
        targets.map(contactId =>
          loyaltyApi.identityMatch(tenant.id, brand.id, contactId)
        )
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      await loadDuplicateCount();
      await loadContacts();
    } catch (err) {
      console.error('Merge duplicates failed:', err);
    } finally {
      setMerging(false);
    }
  }

  function handleExportCSV() {
    if (exporting) return;
    setExporting(true);
    try {
      const rows = filtered.map(c => [
        c.name,
        c.email || '',
        c.phone || '',
        c.tier,
        c.score,
        c.platforms.join(';'),
        c.tags.join(';'),
        c.sentiment,
        c.lastInteraction.toISOString(),
        c.conversations,
        c.revenue,
      ]);
      const header = ['Name', 'Email', 'Phone', 'Tier', 'Score', 'Platforms', 'Tags', 'Sentiment', 'Last Interaction', 'Conversations', 'Revenue'];
      const csvContent = [header, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const filtered = contacts.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase());
    const matchTier = tierFilter === 'all' || c.tier === tierFilter;
    const matchPlatform = platformFilter.length === 0 || platformFilter.some(p => c.platforms.includes(p));
    return matchSearch && matchTier && matchPlatform;
  });

  function toggleSelect(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const sentimentColor = (s: number) => s > 0.3 ? 'text-green-400' : s > -0.3 ? 'text-amber-400' : 'text-red-400';
  const sentimentDot = (s: number) => s > 0.3 ? 'bg-green-400' : s > -0.3 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="p-4 md:p-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#F0F2FF]">Contacts</h1>
          <p className="text-xs text-[#8B90A7] mt-0.5">{contacts.length} total contacts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)}><Upload className="w-3.5 h-3.5" /> Import CSV</Button>
          <Button variant="secondary" size="sm" onClick={handleExportCSV} disabled={exporting}><Download className="w-3.5 h-3.5" /> {exporting ? 'Exporting...' : 'Export CSV'}</Button>
          <Button variant="secondary" size="sm" onClick={handleMergeDuplicates} disabled={merging}><Merge className="w-3.5 h-3.5" /> {merging ? 'Merging...' : 'Merge Duplicates'} {duplicateCount > 0 && <Badge variant="warning" className="ml-1">{duplicateCount}</Badge>}</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4B5068]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..." className="h-9 w-full pl-9 pr-3 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] placeholder:text-[#4B5068] focus:outline-none focus:border-blue-500" />
        </div>

        <div className="flex gap-1 p-1 bg-[#111318] rounded-lg border border-[#1E2130]">
          {['all', 'ADVOCATE', 'FAN', 'NEWBIE'].map(t => (
            <button key={t} onClick={() => setTierFilter(t)} className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${tierFilter === t ? 'bg-[#1A1C24] text-[#F0F2FF]' : 'text-[#8B90A7] hover:text-[#F0F2FF]'}`}>
              {t === 'all' ? 'All tiers' : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {['INSTAGRAM', 'FACEBOOK', 'TIKTOK'].map(p => (
            <button key={p} onClick={() => setPlatformFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])} className={`p-1.5 rounded-lg border transition-colors ${platformFilter.includes(p) ? 'bg-blue-500/20 border-blue-500/30' : 'border-[#2A2E42] hover:border-[#2A2E42]'}`}>
              <PlatformIcon platform={p} size={14} />
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.length > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 slide-up">
          <span className="text-xs text-blue-400 font-medium">{selected.length} selected</span>
          <div className="h-3 w-px bg-blue-500/30" />
          <button className="text-xs text-[#8B90A7] hover:text-[#F0F2FF] flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Add tag</button>
          <button className="text-xs text-[#8B90A7] hover:text-[#F0F2FF] flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> Start broadcast</button>
          <button className="text-xs text-[#8B90A7] hover:text-[#F0F2FF] flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Export</button>
          <button className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
          <button onClick={() => setSelected([])} className="ml-auto text-[#4B5068] hover:text-[#F0F2FF]"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          <span className="ml-3 text-sm text-[#8B90A7]">Loading contacts...</span>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="bg-[#111318] border border-[#1E2130] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-[#1E2130]">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" onChange={e => setSelected(e.target.checked ? filtered.map(c => c.id) : [])} checked={selected.length === filtered.length && filtered.length > 0} className="rounded border-[#2A2E42] bg-[#1A1C24]" />
                </th>
                {['Contact', 'Platforms', 'Tier', 'Tags', 'Last Interaction', 'Conversations', 'Revenue', 'Sentiment', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(contact => (
                <tr key={contact.id} className={`border-b border-[#1E2130] hover:bg-[#1A1C24] transition-colors cursor-pointer ${selected.includes(contact.id) ? 'bg-blue-500/5' : ''}`} onClick={() => navigate(`/contacts/${contact.id}`)}>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(contact.id)} onChange={() => toggleSelect(contact.id)} className="rounded border-[#2A2E42] bg-[#1A1C24]" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-400/30 flex items-center justify-center text-xs font-bold text-blue-400">
                        {contact.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#F0F2FF]">{contact.name}</p>
                        <p className="text-[10px] text-[#4B5068]">{contact.email || 'No email'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {contact.platforms.map(p => <PlatformIcon key={p} platform={p} size={14} />)}
                    </div>
                  </td>
                  <td className="px-4 py-3"><LoyaltyBadge tier={contact.tier} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.slice(0, 2).map(t => (
                        <span key={t} className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#222530] text-[#8B90A7] border border-[#2A2E42]">{t}</span>
                      ))}
                      {contact.tags.length > 2 && <span className="text-[10px] text-[#4B5068]">+{contact.tags.length - 2}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#8B90A7]">{formatDistanceToNow(contact.lastInteraction)} ago</td>
                  <td className="px-4 py-3 text-sm text-[#F0F2FF]">{contact.conversations}</td>
                  <td className="px-4 py-3 text-sm font-medium text-green-400">${contact.revenue.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${sentimentDot(contact.sentiment)}`} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button className="w-7 h-7 flex items-center justify-center rounded text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#222530]"><MessageSquare className="w-3.5 h-3.5" /></button>
                      <button className="w-7 h-7 flex items-center justify-center rounded text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#222530]"><ExternalLink className="w-3.5 h-3.5" /></button>
                      <button className="w-7 h-7 flex items-center justify-center rounded text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#222530]"><MoreVertical className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {filtered.length === 0 && (
            <EmptyState
              icon={<Search className="w-8 h-8" />}
              title="No contacts found"
              description="Try adjusting your search or filters"
            />
          )}
        </div>
      )}

      {/* CSV Import Modal */}
      <Modal
        open={showImportModal}
        onClose={closeImportModal}
        title="Import Contacts from CSV"
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={closeImportModal}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleImport}
              disabled={importing || csvAllRows.length === 0}
            >
              {importing ? 'Importing...' : `Import ${csvAllRows.length > 0 ? csvAllRows.length : ''} Contacts`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* File input */}
          <div>
            <label className="block text-xs font-medium text-[#8B90A7] mb-1.5">Select CSV File</label>
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 border-dashed border-[#2A2E42] hover:border-blue-500/50 transition-colors">
              <FileUp className="w-5 h-5 text-[#4B5068]" />
              <span className="text-sm text-[#8B90A7]">{csvFile ? csvFile.name : 'Click to choose a .csv file'}</span>
              <input type="file" accept=".csv" className="hidden" onChange={handleCsvFileChange} />
            </label>
          </div>

          {/* Preview */}
          {csvHeaders.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[#8B90A7] mb-1.5">Preview (first 5 rows)</p>
              <div className="overflow-x-auto rounded-lg border border-[#2A2E42]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#2A2E42] bg-[#111318]">
                      {csvHeaders.map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreviewRows.map((row, i) => (
                      <tr key={i} className="border-b border-[#1E2130]">
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-1.5 text-[#8B90A7] whitespace-nowrap max-w-[120px] truncate">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Column mapping */}
          {csvHeaders.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[#8B90A7] mb-1.5">Map CSV Columns to Contact Fields</p>
              <div className="grid grid-cols-2 gap-2">
                {csvHeaders.map(header => (
                  <div key={header} className="flex items-center gap-2">
                    <span className="text-xs text-[#F0F2FF] w-28 truncate flex-shrink-0" title={header}>{header}</span>
                    <span className="text-[#4B5068]">→</span>
                    <select
                      value={columnMap[header] || ''}
                      onChange={e => setColumnMap(prev => ({ ...prev, [header]: e.target.value }))}
                      className="flex-1 h-7 rounded-lg bg-[#111318] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Skip</option>
                      {CONTACT_FIELDS.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div className={`flex items-start gap-2 p-3 rounded-xl text-xs ${importResult.error ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}>
              {importResult.error
                ? <><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>Error: {importResult.error}</span></>
                : <><span className="text-lg leading-none">✓</span><span>Successfully imported {importResult.count} contact{importResult.count !== 1 ? 's' : ''}!</span></>
              }
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
