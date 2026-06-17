import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload, Link2, FileText, Trash2, AlertCircle, CheckCircle2, Clock,
  Brain, Send, X, Plus, Search, RefreshCw, BarChart3, BookOpen,
  Zap, Shield, ChevronRight, Eye, Copy, Settings2, MessageSquare,
  Sparkles, Database, ToggleLeft, ExternalLink, Loader2, Type,
  HelpCircle, Globe, File, ChevronDown, Edit2, Save, RotateCw,
  LayoutGrid, List, AlertTriangle, Info, FileUp
} from 'lucide-react';
import { Button, Badge, Card, Modal, EmptyState, Progress, Select, Input, Toggle, Textarea, Tabs } from '../components/ui';
import { KBDocument, KBIndexStatus, KBStrictness, KBSourceType } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { kbApi } from '../lib/api';

// ---- Chunk type for viewer ----
interface KBChunk {
  id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  document_id: string;
}

export function KnowledgeBasePage() {
  const { tenant, brand } = useAuth();
  const [docs, setDocs] = useState<KBDocument[]>([]);
  const [chunks, setChunks] = useState<KBChunk[]>([]);
  const [selected, setSelected] = useState<KBDocument | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState<KBSourceType>('URL');
  const [showAddTextModal, setShowAddTextModal] = useState(false);
  const [showAddQAModal, setShowAddQAModal] = useState(false);
  const [showChunkViewer, setShowChunkViewer] = useState(false);

  // Upload form state
  const [urlInput, setUrlInput] = useState('');
  const [urlName, setUrlName] = useState('');
  const [urlDepth, setUrlDepth] = useState(1);
  const [textInput, setTextInput] = useState('');
  const [textName, setTextName] = useState('');
  const [textStrictness, setTextStrictness] = useState<KBStrictness>('BALANCED');
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [qaStrictness, setQaStrictness] = useState<KBStrictness>('STRICT');
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  // AI Playground
  const [testQ, setTestQ] = useState('');
  const [testResult, setTestResult] = useState<null | {
    answer: string;
    chunks: { text: string; score: number; doc: string }[];
    tier: string; cost: string;
    action: string;
  }>(null);
  const [testing, setTesting] = useState(false);

  // Stats
  const [totalChunks, setTotalChunks] = useState(0);
  const [indexedCount, setIndexedCount] = useState(0);

  // Edit state
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadDocs = useCallback(async () => {
    if (!tenant?.id || !brand?.id) return;
    setLoadingDocs(true);
    try {
      const raw = await kbApi.documents(tenant.id, brand.id);
      const mapped: KBDocument[] = (raw?.documents ?? raw ?? []).map((d: any) => ({
        id: d.id, tenant_id: d.tenantId ?? d.tenant_id ?? tenant.id,
        brand_id: d.brandId ?? d.brand_id ?? brand.id,
        name: d.name, source_type: d.sourceType ?? d.source_type,
        source_url: d.sourceUrl ?? d.source_url,
        index_status: d.indexStatus ?? d.index_status,
        chunk_count: d.chunkCount ?? d.chunk_count ?? 0,
        strictness: d.strictness ?? 'BALANCED',
        error_message: d.errorMessage ?? d.error_message,
        content_preview: d.contentPreview ?? d.content_preview,
        auto_reindex: d.autoReindex ?? d.auto_reindex ?? false,
        last_indexed_at: d.lastIndexedAt ?? d.last_indexed_at,
        qa_question: d.qaQuestion ?? d.qa_question,
        qa_answer: d.qaAnswer ?? d.qa_answer,
        crawl_depth: d.crawlDepth ?? d.crawl_depth ?? 1,
        created_at: d.createdAt ?? d.created_at,
      }));
      setDocs(mapped);
      setTotalChunks(mapped.reduce((sum, d) => sum + (d.index_status === 'INDEXED' ? d.chunk_count : 0), 0));
      setIndexedCount(mapped.filter(d => d.index_status === 'INDEXED').length);
      setSelected(prev => {
        if (prev && mapped.some(d => d.id === prev.id)) {
          return mapped.find(d => d.id === prev.id) || null;
        }
        return mapped[0] ?? null;
      });
    } catch (err) {
      console.error('Failed to load KB documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  }, [tenant?.id, brand?.id]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  // Load chunks when a document is selected and chunk viewer is open
  useEffect(() => {
    if (selected && showChunkViewer) loadChunks();
  }, [selected?.id, showChunkViewer]);

  async function loadChunks() {
    if (!selected) return;
    setLoadingChunks(true);
    // Chunk viewer endpoint to be wired in a future iteration
    setChunks([]);
    setLoadingChunks(false);
  }

  const statusConfig = (s: KBIndexStatus) => ({
    INDEXED: { icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />, label: 'Indexed', color: 'green' },
    PENDING: { icon: <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />, label: 'Indexing', color: 'amber' },
    FAILED: { icon: <AlertCircle className="w-3.5 h-3.5 text-red-400" />, label: 'Failed', color: 'red' },
  }[s]);

  const sourceTypeConfig = (t: KBSourceType) => ({
    URL: { icon: <Globe className="w-4 h-4" />, bg: 'bg-blue-500/15 text-blue-400', label: 'Website' },
    PDF: { icon: <FileText className="w-4 h-4" />, bg: 'bg-red-500/15 text-red-400', label: 'PDF' },
    TEXT: { icon: <Type className="w-4 h-4" />, bg: 'bg-teal-500/15 text-teal-400', label: 'Text' },
    QA: { icon: <HelpCircle className="w-4 h-4" />, bg: 'bg-amber-500/15 text-amber-400', label: 'Q&A' },
  }[t]);

  async function runTest() {
    if (!testQ.trim() || !brand?.id) return;
    setTesting(true);
    try {
      const data = await kbApi.test(brand.id, testQ);
      setTestResult({
        answer: data.answer ?? data.response ?? '',
        chunks: (data.chunks ?? data.sources ?? []).map((c: any) => ({
          text: c.text ?? c.content ?? c.content_preview ?? '',
          score: c.score ?? c.similarity ?? 0,
          doc: c.doc ?? c.document_name ?? c.document ?? '',
        })),
        tier: data.tier ?? data.recommended_tier ?? 'TIER_1',
        cost: data.cost ?? '$0.0003',
        action: data.action ?? 'answer',
      });
    } catch (err) {
      console.error('KB test failed:', err);
      setTestResult(null);
    } finally {
      setTesting(false);
    }
  }

  async function handleUploadPdf(name: string, content: string) {
    if (!tenant?.id || !brand?.id) return;
    setUploading(true);
    try {
      await kbApi.upload(tenant.id, brand.id, name, 'PDF', content);
      await loadDocs();
    } catch (err) { console.error('PDF upload failed:', err); }
    setUploading(false);
    setShowUploadModal(false);
  }

  async function handleAddUrl() {
    if (!tenant?.id || !brand?.id || !urlInput.trim()) return;
    setUploading(true);
    try {
      await kbApi.upload(tenant.id, brand.id, urlName || urlInput, 'URL', '', urlInput, textStrictness);
      await loadDocs();
    } catch (err) { console.error('URL add failed:', err); }
    setUploading(false);
    resetUrlForm();
  }

  async function handleAddText() {
    if (!tenant?.id || !brand?.id || !textInput.trim()) return;
    setUploading(true);
    try {
      await kbApi.upload(tenant.id, brand.id, textName || 'Text Entry', 'TEXT', textInput, undefined, textStrictness);
      await loadDocs();
    } catch (err) { console.error('Text add failed:', err); }
    setUploading(false);
    resetTextForm();
  }

  async function handleAddQA() {
    if (!tenant?.id || !brand?.id || !qaQuestion.trim() || !qaAnswer.trim()) return;
    setUploading(true);
    try {
      await kbApi.upload(tenant.id, brand.id, qaQuestion, 'QA', qaAnswer, undefined, qaStrictness);
      await loadDocs();
    } catch (err) { console.error('Q&A add failed:', err); }
    setUploading(false);
    resetQAForm();
  }

  async function handleDelete(docId: string) {
    try {
      await kbApi.deleteDocument(docId);
    } catch {}
    setDocs(prev => prev.filter(d => d.id !== docId));
    if (selected?.id === docId) setSelected(null);
  }

  async function handleRetry(docId: string) {
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, index_status: 'PENDING' as KBIndexStatus, error_message: undefined } : d));
    setSelected(prev => prev?.id === docId ? { ...prev, index_status: 'PENDING' as KBIndexStatus, error_message: undefined } : prev);
  }

  async function handleStrictnessChange(docId: string, strictness: KBStrictness) {
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, strictness } : d));
    setSelected(prev => prev?.id === docId ? { ...prev, strictness } : prev);
  }

  async function handleAutoReindexToggle(docId: string, value: boolean) {
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, auto_reindex: value } : d));
    setSelected(prev => prev?.id === docId ? { ...prev, auto_reindex: value } : prev);
  }

  async function handleReindex(docId: string) {
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, index_status: 'PENDING' as KBIndexStatus, last_indexed_at: new Date().toISOString() } : d));
    setSelected(prev => prev?.id === docId ? { ...prev, index_status: 'PENDING' as KBIndexStatus, last_indexed_at: new Date().toISOString() } : prev);
  }

  async function handleRename(docId: string, newName: string) {
    if (!newName.trim()) return;
    setSavingEdit(true);
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, name: newName } : d));
    setSelected(prev => prev?.id === docId ? { ...prev, name: newName } : prev);
    setSavingEdit(false);
    setEditingName(false);
  }

  function resetUrlForm() { setShowUploadModal(false); setUrlInput(''); setUrlName(''); setUrlDepth(1); }
  function resetTextForm() { setShowAddTextModal(false); setTextInput(''); setTextName(''); setTextStrictness('BALANCED'); }
  function resetQAForm() { setShowAddQAModal(false); setQaQuestion(''); setQaAnswer(''); setQaStrictness('STRICT'); }

  const filteredDocs = docs.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.content_preview || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar */}
      <div className="flex-shrink-0 border-b border-[#1E2130] bg-[#111318] px-4 md:px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#F0F2FF]">AI Knowledge Base</h1>
              <p className="text-[11px] text-[#8B90A7]">Train your AI with product docs, FAQs, and brand knowledge</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
            </Button>
            <Button variant="secondary" size="sm" onClick={loadDocs}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Sources', value: docs.length, icon: <BookOpen className="w-3.5 h-3.5" />, color: 'text-blue-400' },
            { label: 'Indexed', value: indexedCount, icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'text-green-400' },
            { label: 'Chunks', value: totalChunks, icon: <Database className="w-3.5 h-3.5" />, color: 'text-teal-400' },
            { label: 'Coverage', value: docs.length > 0 ? `${Math.round(indexedCount / docs.length * 100)}%` : '—', icon: <BarChart3 className="w-3.5 h-3.5" />, color: 'text-amber-400' },
          ].map(stat => (
            <div key={stat.label} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#0A0B0F] border border-[#1E2130]">
              <div className={stat.color}>{stat.icon}</div>
              <div>
                <p className="text-lg font-bold text-[#F0F2FF] leading-tight">{stat.value}</p>
                <p className="text-[10px] text-[#4B5068]">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile document selector dropdown */}
      {docs.length > 0 && (
        <div className="md:hidden flex-shrink-0 px-4 py-2 border-b border-[#1E2130] bg-[#111318]">
          <select
            value={selected?.id ?? ''}
            onChange={e => setSelected(docs.find(d => d.id === e.target.value) ?? null)}
            className="w-full h-9 rounded-lg bg-[#0A0B0F] border border-[#1E2130] text-xs text-[#F0F2FF] px-3 focus:outline-none focus:border-blue-500/50"
          >
            {docs.map(d => (
              <option key={d.id} value={d.id}>{d.source_type === 'QA' ? d.qa_question || d.name : d.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Document list — hidden on mobile */}
        <div className="hidden md:flex w-80 flex-col border-r border-[#1E2130] bg-[#111318] flex-shrink-0">
          {/* Search + Add buttons */}
          <div className="p-3 border-b border-[#1E2130] space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#4B5068] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full h-8 rounded-lg bg-[#0A0B0F] border border-[#1E2130] text-xs text-[#F0F2FF] placeholder:text-[#4B5068] pl-9 pr-3 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { type: 'URL' as const, icon: <Globe className="w-3.5 h-3.5" />, label: 'URL', onClick: () => setShowUploadModal(true) },
                { type: 'PDF' as const, icon: <FileUp className="w-3.5 h-3.5" />, label: 'PDF', onClick: () => { setUploadType('PDF'); setShowUploadModal(true); } },
                { type: 'TEXT' as const, icon: <Type className="w-3.5 h-3.5" />, label: 'Text', onClick: () => setShowAddTextModal(true) },
                { type: 'QA' as const, icon: <HelpCircle className="w-3.5 h-3.5" />, label: 'Q&A', onClick: () => setShowAddQAModal(true) },
              ].map(btn => (
                <button key={btn.type} onClick={btn.onClick}
                  className="flex flex-col items-center gap-1 py-2 rounded-lg bg-[#0A0B0F] border border-[#1E2130] text-[#8B90A7] hover:text-[#F0F2FF] hover:border-blue-500/30 transition-all text-[10px] font-medium">
                  {btn.icon}
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Document List */}
          <div className="flex-1 overflow-y-auto p-2">
            {loadingDocs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-[#4B5068] animate-spin" />
              </div>
            ) : filteredDocs.length === 0 ? (
              <EmptyState
                icon={<Brain className="w-6 h-6" />}
                title={searchQuery ? 'No matches' : 'No sources yet'}
                description={searchQuery ? 'Try a different search' : 'Add a URL, PDF, text, or Q&A to train your AI'}
              />
            ) : (
              <div className="space-y-1">
                {filteredDocs.map(doc => {
                  const sc = statusConfig(doc.index_status);
                  const stc = sourceTypeConfig(doc.source_type);
                  return (
                    <button
                      key={doc.id}
                      onClick={() => setSelected(doc)}
                      className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-all duration-100 group ${
                        selected?.id === doc.id
                          ? 'bg-blue-500/10 border border-blue-500/30 shadow-sm shadow-blue-500/5'
                          : 'hover:bg-[#1A1C24] border border-transparent'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${stc.bg}`}>
                        {stc.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#F0F2FF] truncate">
                          {doc.source_type === 'QA' ? doc.qa_question || doc.name : doc.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {sc?.icon}
                          <span className="text-[10px] text-[#8B90A7]">
                            {doc.index_status === 'INDEXED' ? `${doc.chunk_count} chunks` :
                             doc.index_status === 'PENDING' ? 'Indexing...' : 'Failed'}
                          </span>
                          {doc.auto_reindex && (
                            <span className="text-[9px] text-teal-400 font-medium">Auto-sync</span>
                          )}
                          <span className="text-[10px] text-[#4B5068] ml-auto">
                            {formatDistanceToNow(new Date(doc.created_at), { addSuffix: false })}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Detail panel */}
        {selected ? (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
              {/* Document Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${sourceTypeConfig(selected.source_type).bg}`}>
                    {sourceTypeConfig(selected.source_type).icon}
                  </div>
                  <div>
                    {editingName ? (
                      <div className="flex items-center gap-2">
                        <input value={editNameValue} onChange={e => setEditNameValue(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleRename(selected.id, editNameValue)}
                          className="text-sm font-bold text-[#F0F2FF] bg-[#0A0B0F] border border-blue-500/40 rounded-lg px-2 py-1 focus:outline-none" autoFocus />
                        <Button variant="ghost" size="icon" onClick={() => handleRename(selected.id, editNameValue)}><Save className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditingName(false)}><X className="w-3.5 h-3.5" /></Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-[#F0F2FF]">
                          {selected.source_type === 'QA' ? selected.qa_question || selected.name : selected.name}
                        </h2>
                        <button onClick={() => { setEditingName(true); setEditNameValue(selected.name); }} className="text-[#4B5068] hover:text-[#F0F2FF]">
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant={selected.index_status === 'INDEXED' ? 'success' : selected.index_status === 'PENDING' ? 'warning' : 'danger'}>
                        {selected.index_status}
                      </Badge>
                      <Badge variant="default">{sourceTypeConfig(selected.source_type).label}</Badge>
                      {selected.source_url && (
                        <a href={selected.source_url} target="_blank" rel="noopener" className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5">
                          <ExternalLink className="w-2.5 h-2.5" /> Link
                        </a>
                      )}
                      <span className="text-[10px] text-[#4B5068]">
                        {formatDistanceToNow(new Date(selected.created_at))} ago
                      </span>
                      {selected.last_indexed_at && (
                        <span className="text-[10px] text-[#4B5068]">
                          Last indexed {formatDistanceToNow(new Date(selected.last_indexed_at))} ago
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="icon" onClick={() => handleReindex(selected.id)} title="Re-index">
                    <RotateCw className="w-4 h-4 text-[#8B90A7]" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => handleDelete(selected.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Content Preview / Q&A display */}
              {selected.source_type === 'QA' ? (
                <Card>
                  <div className="flex items-center gap-2 mb-3">
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-[#F0F2FF]">Q&A Pair</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider mb-1">Question</p>
                      <p className="text-sm text-[#F0F2FF]">{selected.qa_question}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20">
                      <p className="text-[10px] text-teal-400 font-semibold uppercase tracking-wider mb-1">Answer</p>
                      <p className="text-sm text-[#F0F2FF] leading-relaxed">{selected.qa_answer}</p>
                    </div>
                  </div>
                </Card>
              ) : selected.content_preview ? (
                <Card>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-[#8B90A7]" />
                      <h3 className="text-sm font-semibold text-[#F0F2FF]">Content Preview</h3>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(selected.content_preview || ''); }}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-[#8B90A7] leading-relaxed">{selected.content_preview}</p>
                </Card>
              ) : null}

              {/* Error / Pending States */}
              {selected.index_status === 'FAILED' && (
                <Card className="border-red-500/20 bg-red-500/5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-400">Indexing failed</p>
                      <p className="text-xs text-[#8B90A7] mt-1">{selected.error_message || 'An error occurred during indexing. Try re-indexing the document.'}</p>
                      <Button variant="secondary" size="sm" className="mt-3" onClick={() => handleRetry(selected.id)}>
                        <RotateCw className="w-3.5 h-3.5 mr-1" /> Retry indexing
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {selected.index_status === 'PENDING' && (
                <Card className="border-amber-500/20 bg-amber-500/5">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                    <div>
                      <p className="text-sm font-medium text-amber-400">Indexing in progress</p>
                      <p className="text-xs text-[#8B90A7] mt-0.5">Your document is being chunked and embedded. This may take a few minutes.</p>
                    </div>
                  </div>
                  <Progress value={60} color="bg-amber-400" className="mt-3" />
                </Card>
              )}

              {/* Settings Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strictness */}
                <Card>
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-teal-400" />
                    <h3 className="text-sm font-semibold text-[#F0F2FF]">Strictness</h3>
                  </div>
                  <div className="space-y-2">
                    {(['STRICT', 'BALANCED', 'CREATIVE'] as KBStrictness[]).map(s => (
                      <button key={s} onClick={() => handleStrictnessChange(selected.id, s)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${
                          selected.strictness === s ? 'border-teal-500/40 bg-teal-500/10' : 'border-[#1E2130] hover:border-[#2A2E42] hover:bg-[#1A1C24]'
                        }`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          selected.strictness === s ? 'bg-teal-500/20 text-teal-400' : 'bg-[#0A0B0F] text-[#4B5068]'
                        }`}>{s[0]}</div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium ${selected.strictness === s ? 'text-[#F0F2FF]' : 'text-[#8B90A7]'}`}>{s}</p>
                          <p className="text-[10px] text-[#4B5068]">
                            {s === 'STRICT' ? 'High confidence only (>75%)' : s === 'BALANCED' ? 'Medium+ confidence (>50%)' : 'Low confidence allowed'}
                          </p>
                        </div>
                        {selected.strictness === s && <CheckCircle2 className="w-4 h-4 text-teal-400 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                </Card>

                {/* Settings */}
                <Card>
                  <div className="flex items-center gap-2 mb-3">
                    <Settings2 className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-semibold text-[#F0F2FF]">Settings</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-[#F0F2FF]">Auto-sync</p>
                        <p className="text-[10px] text-[#4B5068]">Re-index automatically every 24h</p>
                      </div>
                      <Toggle checked={selected.auto_reindex} onChange={v => handleAutoReindexToggle(selected.id, v)} size="sm" />
                    </div>
                    {selected.source_type === 'URL' && (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-[#F0F2FF]">Crawl depth</p>
                          <p className="text-[10px] text-[#4B5068]">Pages deep to follow links</p>
                        </div>
                        <span className="text-xs font-bold text-[#F0F2FF] bg-[#0A0B0F] border border-[#1E2130] px-2 py-1 rounded">{selected.crawl_depth}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-[#F0F2FF]">Chunks</p>
                      <span className="text-xs text-[#8B90A7]">{selected.chunk_count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-[#F0F2FF]">Created</p>
                      <span className="text-xs text-[#8B90A7]">{new Date(selected.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {selected.index_status === 'INDEXED' && (
                    <Button variant="secondary" size="sm" className="w-full mt-3" onClick={() => setShowChunkViewer(true)}>
                      <Eye className="w-3.5 h-3.5 mr-1" /> View Chunks
                    </Button>
                  )}
                </Card>
              </div>

              {/* AI Playground */}
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-[#F0F2FF]">AI Playground</h3>
                  <span className="text-[10px] text-[#4B5068] ml-auto">Test how your AI responds</span>
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {['What is your return policy?', 'How much does shipping cost?', 'Do you have size guides?', 'What materials do you use?', 'Do you ship internationally?'].map(q => (
                      <button key={q} onClick={() => setTestQ(q)}
                        className="px-2.5 py-1 rounded-full bg-[#0A0B0F] border border-[#1E2130] text-[10px] text-[#8B90A7] hover:text-[#F0F2FF] hover:border-blue-500/30 transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={testQ} onChange={e => setTestQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && runTest()}
                      placeholder="Ask a question about your products or policies..."
                      className="flex-1 h-10 rounded-xl bg-[#0A0B0F] border border-[#1E2130] text-sm text-[#F0F2FF] placeholder:text-[#4B5068] px-4 focus:outline-none focus:border-blue-500/50 transition-colors" />
                    <Button variant="primary" loading={testing} onClick={runTest}><Send className="w-4 h-4" /></Button>
                  </div>
                  {testResult && (
                    <div className="space-y-3 slide-up">
                      <div className={`p-4 rounded-xl border ${
                        testResult.action === 'handoff' ? 'bg-red-500/10 border-red-500/20' :
                        testResult.action === 'answer_with_disclaimer' ? 'bg-amber-500/10 border-amber-500/20' :
                        'bg-gradient-to-br from-blue-500/10 to-teal-500/5 border-blue-500/20'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="w-4 h-4 text-blue-400" />
                          <span className="text-xs font-semibold text-blue-400">AI Response</span>
                          <Badge variant="info" className="ml-auto text-[10px]">{testResult.tier}</Badge>
                          <span className="text-[10px] text-[#4B5068] font-mono">{testResult.cost}</span>
                        </div>
                        <p className="text-sm text-[#F0F2FF] leading-relaxed">{testResult.answer || 'No response generated.'}</p>
                        {testResult.action === 'handoff' && (
                          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-red-400">
                            <AlertTriangle className="w-3 h-3" /> Confidence too low — would hand off to human
                          </div>
                        )}
                        {testResult.action === 'answer_with_disclaimer' && (
                          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-amber-400">
                            <Info className="w-3 h-3" /> Low confidence — would add disclaimer
                          </div>
                        )}
                      </div>
                      {testResult.chunks.length > 0 && (
                        <div>
                          <p className="text-[10px] text-[#4B5068] uppercase tracking-wider font-semibold mb-2">Sources ({testResult.chunks.length})</p>
                          <div className="space-y-2">
                            {testResult.chunks.map((c, i) => (
                              <div key={i} className="p-3 rounded-lg bg-[#0A0B0F] border border-[#1E2130]">
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-teal-400">#{i + 1}</span>
                                    <span className="text-[10px] text-[#4B5068]">{c.doc}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-16 h-1 bg-[#1E2130] rounded-full">
                                      <div className={`h-full rounded-full ${c.score > 0.75 ? 'bg-green-400' : c.score > 0.5 ? 'bg-amber-400' : 'bg-red-400'}`}
                                        style={{ width: `${Math.min(100, c.score * 100)}%` }} />
                                    </div>
                                    <span className="text-[10px] font-mono text-[#8B90A7]">{(c.score * 100).toFixed(0)}%</span>
                                  </div>
                                </div>
                                <p className="text-xs text-[#8B90A7] line-clamp-3">{c.text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>

              {/* How It Works */}
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-[#F0F2FF]">How It Works</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { step: '1', title: 'Train', desc: 'Upload URLs, PDFs, text, or Q&A pairs. Content is chunked and embedded.', icon: <Upload className="w-4 h-4 text-blue-400" /> },
                    { step: '2', title: 'Retrieve', desc: 'When a customer asks, relevant chunks are found by semantic similarity.', icon: <Search className="w-4 h-4 text-teal-400" /> },
                    { step: '3', title: 'Generate', desc: 'AI crafts a response using retrieved context and your brand persona.', icon: <MessageSquare className="w-4 h-4 text-amber-400" /> },
                  ].map(s => (
                    <div key={s.step} className="p-3 rounded-lg bg-[#0A0B0F] border border-[#1E2130]">
                      <div className="flex items-center gap-2 mb-2">{s.icon}<span className="text-xs font-bold text-[#F0F2FF]">{s.title}</span></div>
                      <p className="text-[10px] text-[#8B90A7] leading-relaxed">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-400/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-5">
                <Brain className="w-10 h-10 text-teal-400" />
              </div>
              <h3 className="text-lg font-bold text-[#F0F2FF] mb-2">Build Your Knowledge Base</h3>
              <p className="text-sm text-[#8B90A7] mb-5 leading-relaxed">
                Upload product catalogs, FAQs, shipping policies, and brand guidelines.
                Your AI will use this knowledge to answer customer questions accurately.
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
                <Button variant="primary" onClick={() => setShowUploadModal(true)}><Globe className="w-4 h-4 mr-1.5" /> Add URL</Button>
                <Button variant="secondary" onClick={() => setShowAddTextModal(true)}><Type className="w-4 h-4 mr-1.5" /> Add Text</Button>
                <Button variant="secondary" onClick={() => setShowAddQAModal(true)}><HelpCircle className="w-4 h-4 mr-1.5" /> Add Q&A</Button>
                <Button variant="secondary" onClick={() => { setUploadType('PDF'); setShowUploadModal(true); }}><FileUp className="w-4 h-4 mr-1.5" /> Upload PDF</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---- MODALS ---- */}

      {/* Add URL Modal */}
      <Modal open={showUploadModal} onClose={resetUrlForm} title="Add Website Source" footer={
        <>
          <Button variant="ghost" onClick={resetUrlForm}>Cancel</Button>
          <Button variant="primary" onClick={handleAddUrl} disabled={!urlInput.trim()} loading={uploading}>Add Source</Button>
        </>
      }>
        <div className="space-y-4">
          <Input label="Document name" value={urlName} onChange={e => setUrlName(e.target.value)} placeholder="e.g., Shipping Policy" />
          <Input label="URL" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://example.com/faq" leftIcon={<Globe className="w-3.5 h-3.5" />} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Crawl depth" value={String(urlDepth)} onChange={e => setUrlDepth(Number(e.target.value))}
              options={[{ value: '1', label: '1 page only' }, { value: '2', label: '2 levels deep' }, { value: '3', label: '3 levels deep' }]} />
            <Select label="Strictness" value={textStrictness} onChange={e => setTextStrictness(e.target.value as KBStrictness)}
              options={[{ value: 'STRICT', label: 'Strict' }, { value: 'BALANCED', label: 'Balanced' }, { value: 'CREATIVE', label: 'Creative' }]} />
          </div>
          <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20">
            <div className="flex items-center gap-2 mb-1"><Sparkles className="w-3.5 h-3.5 text-teal-400" /><p className="text-xs font-medium text-teal-400">How it works</p></div>
            <p className="text-[11px] text-[#8B90A7] leading-relaxed">The page will be fetched and its text content extracted, chunked, and embedded for semantic retrieval. Enable auto-sync to re-index automatically when content changes.</p>
          </div>
        </div>
      </Modal>

      {/* Add Text Modal */}
      <Modal open={showAddTextModal} onClose={resetTextForm} title="Add Text Knowledge" footer={
        <>
          <Button variant="ghost" onClick={resetTextForm}>Cancel</Button>
          <Button variant="primary" onClick={handleAddText} disabled={!textInput.trim()} loading={uploading}>Add Knowledge</Button>
        </>
      }>
        <div className="space-y-4">
          <Input label="Title" value={textName} onChange={e => setTextName(e.target.value)} placeholder="e.g., Brand Guidelines" />
          <Textarea label="Content" value={textInput} onChange={e => setTextInput(e.target.value)}
            placeholder="Paste your product information, policies, brand guidelines, or any text your AI should know about..."
            className="min-h-[160px]" />
          <div className="flex items-center justify-between text-xs text-[#4B5068]">
            <span>{textInput.length.toLocaleString()} characters</span>
            <span>Max 250,000 characters</span>
          </div>
          <Select label="Strictness" value={textStrictness} onChange={e => setTextStrictness(e.target.value as KBStrictness)}
            options={[{ value: 'STRICT', label: 'Strict — only high confidence answers' }, { value: 'BALANCED', label: 'Balanced — default' }, { value: 'CREATIVE', label: 'Creative — allow low confidence' }]} />
        </div>
      </Modal>

      {/* Add Q&A Modal */}
      <Modal open={showAddQAModal} onClose={resetQAForm} title="Add Q&A Pair" footer={
        <>
          <Button variant="ghost" onClick={resetQAForm}>Cancel</Button>
          <Button variant="primary" onClick={handleAddQA} disabled={!qaQuestion.trim() || !qaAnswer.trim()} loading={uploading}>Add Q&A</Button>
        </>
      }>
        <div className="space-y-4">
          <Input label="Question" value={qaQuestion} onChange={e => setQaQuestion(e.target.value)} placeholder="e.g., What is your return policy?" leftIcon={<HelpCircle className="w-3.5 h-3.5" />} />
          <Textarea label="Answer" value={qaAnswer} onChange={e => setQaAnswer(e.target.value)}
            placeholder="Write the exact answer your AI should give when this question is asked..."
            className="min-h-[100px]" />
          <Select label="Strictness" value={qaStrictness} onChange={e => setQaStrictness(e.target.value as KBStrictness)}
            options={[{ value: 'STRICT', label: 'Strict — only answer if this matches' }, { value: 'BALANCED', label: 'Balanced — default' }]} />
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-1"><HelpCircle className="w-3.5 h-3.5 text-amber-400" /><p className="text-xs font-medium text-amber-400">When to use Q&A</p></div>
            <p className="text-[11px] text-[#8B90A7] leading-relaxed">Q&A pairs give your AI exact answers for specific questions. Use them for common questions that need precise, consistent responses every time.</p>
          </div>
        </div>
      </Modal>

      {/* Chunk Viewer Modal */}
      <Modal open={showChunkViewer} onClose={() => setShowChunkViewer(false)} title={`Chunks — ${selected?.name || ''}`} maxWidth="max-w-2xl">
        {loadingChunks ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-[#4B5068] animate-spin" /></div>
        ) : chunks.length === 0 ? (
          <p className="text-xs text-[#4B5068] text-center py-8">No chunks found for this document.</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {chunks.map((chunk, i) => (
              <div key={chunk.id} className="p-3 rounded-lg bg-[#0A0B0F] border border-[#1E2130]">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-teal-400">Chunk #{chunk.chunk_index + 1}</span>
                    <span className="text-[10px] text-[#4B5068]">{chunk.token_count} tokens</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(chunk.content)}>
                    <Copy className="w-3 h-3 text-[#4B5068]" />
                  </Button>
                </div>
                <p className="text-xs text-[#8B90A7] leading-relaxed">{chunk.content}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
