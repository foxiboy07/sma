import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Link2, FileText, Trash2, AlertCircle, CheckCircle2, Clock, ChevronRight, Brain, Send, X, Plus } from 'lucide-react';
import { Button, Badge, Card, Modal, EmptyState, Progress, Select } from '../components/ui';
import { KBDocument, KBIndexStatus, KBStrictness } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { kbApi } from '../lib/api';

export function KnowledgeBasePage() {
  const { tenant, brand } = useAuth();
  const [docs, setDocs] = useState<KBDocument[]>([]);
  const [selected, setSelected] = useState<KBDocument | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showURLModal, setShowURLModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [dragging, setDragging] = useState(false);
  const [testQ, setTestQ] = useState('');
  const [testResult, setTestResult] = useState<null | { answer: string; chunks: { text: string; score: number; doc: string }[]; tier: string; cost: string }>(null);
  const [testing, setTesting] = useState(false);

  const loadDocs = useCallback(async () => {
    if (!tenant?.id || !brand?.id) return;
    setLoadingDocs(true);
    try {
      const data = await kbApi.documents(tenant.id, brand.id);
      const mapped: KBDocument[] = (data.documents ?? data ?? []).map((d: any) => ({
        id: d.id,
        tenant_id: d.tenant_id,
        brand_id: d.brand_id,
        name: d.name,
        source_type: d.source_type,
        source_url: d.source_url,
        index_status: d.index_status,
        chunk_count: d.chunk_count ?? 0,
        strictness: d.strictness ?? 'BALANCED',
        error_message: d.error_message,
        created_at: d.created_at,
      }));
      setDocs(mapped);
      setSelected(prev => {
        if (prev && mapped.some(d => d.id === prev.id)) return prev;
        return mapped[0] ?? null;
      });
    } catch (err) {
      console.error('Failed to load knowledge base documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  }, [tenant?.id, brand?.id]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const statusIcon = (s: KBIndexStatus) => ({
    INDEXED: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
    PENDING: <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />,
    FAILED: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
  }[s]);

  async function runTest() {
    if (!testQ.trim() || !brand?.id) return;
    setTesting(true);
    try {
      const data = await kbApi.test(brand.id, testQ);
      setTestResult({
        answer: data.answer ?? data.response ?? '',
        chunks: (data.chunks ?? data.sources ?? []).map((c: any) => ({
          text: c.text ?? c.content ?? '',
          score: c.score ?? c.similarity ?? 0,
          doc: c.doc ?? c.document_name ?? c.source ?? '',
        })),
        tier: data.tier ?? 'TIER_1',
        cost: data.cost ?? '$0.0003',
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
    try {
      await kbApi.upload(tenant.id, brand.id, name, 'PDF', content);
      await loadDocs();
    } catch (err) {
      console.error('PDF upload failed:', err);
    }
    setShowUploadModal(false);
  }

  async function handleAddUrl(name: string, url: string) {
    if (!tenant?.id || !brand?.id) return;
    try {
      await kbApi.upload(tenant.id, brand.id, name, 'URL', '', url);
      await loadDocs();
    } catch (err) {
      console.error('URL add failed:', err);
    }
    setShowURLModal(false);
    setUrlInput('');
  }

  async function handleDelete(docId: string) {
    try {
      await kbApi.deleteDocument(docId);
      setDocs(prev => prev.filter(d => d.id !== docId));
      setSelected(prev => prev?.id === docId ? null : prev);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }

  function handleStrictnessChange(docId: string, strictness: KBStrictness) {
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, strictness } : d));
    setSelected(prev => prev?.id === docId ? { ...prev, strictness } : prev);
  }

  return (
    <div className="flex h-full">
      {/* Left: Document list */}
      <div className="w-72 flex flex-col border-r border-[#1E2130] bg-[#111318] flex-shrink-0">
        <div className="p-4 border-b border-[#1E2130]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-sm font-semibold text-[#F0F2FF]">AI Knowledge Base</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" className="flex-1" onClick={() => setShowUploadModal(true)}>
              <Upload className="w-3.5 h-3.5" /> Upload PDF
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowURLModal(true)}>
              <Link2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {docs.length === 0 ? (
            <EmptyState icon={<Brain className="w-6 h-6" />} title="No documents" description="Upload a PDF or add a URL" action={<Button variant="primary" size="sm" onClick={() => setShowUploadModal(true)}>Upload</Button>} />
          ) : (
            <div className="space-y-1">
              {docs.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => setSelected(doc)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${selected?.id === doc.id ? 'bg-blue-500/10 border border-blue-500/30' : 'hover:bg-[#1A1C24] border border-transparent'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${doc.source_type === 'PDF' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {doc.source_type === 'PDF' ? <FileText className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#F0F2FF] truncate">{doc.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {statusIcon(doc.index_status)}
                      <span className="text-[10px] text-[#8B90A7]">
                        {doc.index_status === 'INDEXED' ? `${doc.chunk_count} chunks` :
                         doc.index_status === 'PENDING' ? 'Indexing...' : 'Failed'}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Document detail */}
      {selected ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-bold text-[#F0F2FF]">{selected.name}</h2>
                  <Badge variant={selected.index_status === 'INDEXED' ? 'success' : selected.index_status === 'PENDING' ? 'warning' : 'danger'}>
                    {selected.index_status}
                  </Badge>
                </div>
                <p className="text-xs text-[#8B90A7]">
                  {selected.source_type} · Added {formatDistanceToNow(new Date(selected.created_at))} ago
                  {selected.index_status === 'INDEXED' && ` · ${selected.chunk_count} chunks indexed`}
                </p>
              </div>
              <button className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-500/10" onClick={() => handleDelete(selected.id)}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Strictness */}
            <Card className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#F0F2FF]">Strictness Mode</h3>
              </div>
              <div className="flex gap-1 p-1 bg-[#0A0B0F] rounded-lg border border-[#1E2130]">
                {(['STRICT', 'BALANCED', 'CREATIVE'] as KBStrictness[]).map(s => (
                  <button
                    key={s}
                    className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${selected.strictness === s ? 'bg-[#1A1C24] text-[#F0F2FF]' : 'text-[#4B5068] hover:text-[#F0F2FF]'}`}
                    onClick={() => handleStrictnessChange(selected.id, s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#8B90A7] mt-2">
                {selected.strictness === 'STRICT' ? 'Only answers if similarity score > 0.75. Otherwise hands off to human.' :
                 selected.strictness === 'BALANCED' ? 'Answers with confidence disclaimer if score 0.50–0.75.' :
                 'Answers even with low retrieval confidence.'}
              </p>
            </Card>

            {/* Error state */}
            {selected.index_status === 'FAILED' && (
              <Card className="mb-4 border-red-500/20 bg-red-500/5">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <p className="text-sm font-medium">Indexing failed</p>
                </div>
                <p className="text-xs text-[#8B90A7] mt-1">{selected.error_message}</p>
                <Button variant="secondary" size="sm" className="mt-3">Retry</Button>
              </Card>
            )}

            {/* Chunk preview */}
            {selected.index_status === 'INDEXED' && (
              <Card className="mb-4">
                <h3 className="text-sm font-semibold text-[#F0F2FF] mb-3">Indexed Chunks ({selected.chunk_count})</h3>
                <p className="text-xs text-[#8B90A7]">Use the Test Knowledge Base panel below to query chunks and see their similarity scores.</p>
              </Card>
            )}

            {/* Test Panel */}
            <Card>
              <h3 className="text-sm font-semibold text-[#F0F2FF] mb-3">Test Knowledge Base</h3>
              <div className="flex gap-2 mb-4">
                <input
                  value={testQ}
                  onChange={e => setTestQ(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runTest()}
                  placeholder="Ask a test question..."
                  className="flex-1 h-9 rounded-lg bg-[#111318] border border-[#2A2E42] text-sm text-[#F0F2FF] placeholder:text-[#4B5068] px-3 focus:outline-none focus:border-blue-500"
                />
                <Button variant="primary" size="sm" loading={testing} onClick={runTest}>
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>

              {testResult && (
                <div className="space-y-3 slide-up">
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-xs font-medium text-blue-400">AI Response</span>
                      <Badge variant="info" className="ml-auto text-[10px]">{testResult.tier}</Badge>
                      <span className="text-[10px] text-[#4B5068] font-mono">{testResult.cost}</span>
                    </div>
                    <p className="text-xs text-[#F0F2FF]">{testResult.answer}</p>
                  </div>

                  <div>
                    <p className="text-[10px] text-[#4B5068] uppercase tracking-wider mb-1.5">Chunks Used</p>
                    {testResult.chunks.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[#111318] border border-[#1E2130] mb-1.5">
                        <span className="text-[10px] font-mono text-green-400 flex-shrink-0">#{i + 1} ({c.score})</span>
                        <p className="text-[10px] text-[#8B90A7] line-clamp-2">{c.text}</p>
                        <span className="text-[9px] text-[#4B5068] flex-shrink-0">{c.doc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState icon={<FileText className="w-8 h-8" />} title="Select a document" description="Choose a document from the left panel to view its details" />
        </div>
      )}

      {/* Upload Modal */}
      <Modal open={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload PDF Document">
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault(); setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = () => handleUploadPdf(file.name.replace('.pdf', ''), reader.result as string);
              reader.readAsDataURL(file);
            }
          }}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${dragging ? 'border-blue-500 bg-blue-500/10' : 'border-[#2A2E42] hover:border-[#4B5068]'}`}
        >
          <Upload className="w-8 h-8 text-[#4B5068] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#F0F2FF] mb-1">Drag & drop your PDF</p>
          <p className="text-xs text-[#8B90A7] mb-4">or click to browse · Max 50MB</p>
          <label className="cursor-pointer">
            <input type="file" accept=".pdf" className="hidden" onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = () => handleUploadPdf(file.name.replace('.pdf', ''), reader.result as string);
                reader.readAsDataURL(file);
              }
            }} />
            <span className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600">Browse files</span>
          </label>
        </div>
      </Modal>

      {/* URL Modal */}
      <Modal open={showURLModal} onClose={() => setShowURLModal(false)} title="Add URL" footer={
        <>
          <Button variant="ghost" onClick={() => setShowURLModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={() => handleAddUrl(urlInput, urlInput)} disabled={!urlInput}>Add URL</Button>
        </>
      }>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[#8B90A7] block mb-1">URL</label>
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://example.com/faq" className="h-9 w-full rounded-lg bg-[#111318] border border-[#2A2E42] text-sm text-[#F0F2FF] placeholder:text-[#4B5068] px-3 focus:outline-none focus:border-blue-500" />
          </div>
          <p className="text-xs text-[#8B90A7]">The page will be fetched and its text content will be chunked and indexed for AI retrieval.</p>
        </div>
      </Modal>
    </div>
  );
}
