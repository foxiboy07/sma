import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Node, Edge, addEdge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, Connection, BackgroundVariant,
  NodeTypes, Handle, Position, MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  ArrowLeft, Save, Play, Pause, Undo2, Redo2, Download,
  AlertTriangle, CheckCircle2, X, ChevronDown, Plus, Trash2,
  Zap, MessageSquare, Brain, GitBranch, Clock, RefreshCw,
  Code2, Webhook, ShoppingBag, Tag, Settings2, Variable
} from 'lucide-react';
import { Button, Badge, Toggle, Modal } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { flowEngineApi } from '../lib/api';

// Node type colors
const NODE_COLORS = {
  TRIGGER: '#8B5CF6',
  SEND_MESSAGE: '#3B82F6',
  SEND_DM_CARD: '#3B82F6',
  AI_STEP: '#14B8A6',
  ACTION_BLOCK: '#22C55E',
  CUSTOM_CODE: '#EC4899',
  CONDITION: '#F59E0B',
  SUPER_RANDOMIZER: '#F59E0B',
  SMART_DELAY: '#F59E0B',
  FRICTION_RECOVERY: '#EF4444',
  TIKTOK_SHOP_PRODUCT: '#22C55E',
  OUTBOUND_WEBHOOK: '#22C55E',
};

const NODE_ICONS: Record<string, React.ReactNode> = {
  TRIGGER: <Zap className="w-3.5 h-3.5" />,
  SEND_MESSAGE: <MessageSquare className="w-3.5 h-3.5" />,
  SEND_DM_CARD: <MessageSquare className="w-3.5 h-3.5" />,
  AI_STEP: <Brain className="w-3.5 h-3.5" />,
  ACTION_BLOCK: <Settings2 className="w-3.5 h-3.5" />,
  CUSTOM_CODE: <Code2 className="w-3.5 h-3.5" />,
  CONDITION: <GitBranch className="w-3.5 h-3.5" />,
  SUPER_RANDOMIZER: <GitBranch className="w-3.5 h-3.5" />,
  SMART_DELAY: <Clock className="w-3.5 h-3.5" />,
  FRICTION_RECOVERY: <RefreshCw className="w-3.5 h-3.5" />,
  TIKTOK_SHOP_PRODUCT: <ShoppingBag className="w-3.5 h-3.5" />,
  OUTBOUND_WEBHOOK: <Webhook className="w-3.5 h-3.5" />,
};

const NODE_LABELS: Record<string, string> = {
  TRIGGER: 'Trigger',
  SEND_MESSAGE: 'Send Message',
  SEND_DM_CARD: 'Send DM Card',
  AI_STEP: 'AI Step',
  ACTION_BLOCK: 'Action Block',
  CUSTOM_CODE: 'Custom Code',
  CONDITION: 'Condition',
  SUPER_RANDOMIZER: 'Super Randomizer',
  SMART_DELAY: 'Smart Delay',
  FRICTION_RECOVERY: 'Friction Recovery',
  TIKTOK_SHOP_PRODUCT: 'TikTok Shop Product',
  OUTBOUND_WEBHOOK: 'Outbound Webhook',
};

// Custom Node Component
function FlowNode({ data, selected }: { data: Record<string, unknown>; selected: boolean }) {
  const type = data.nodeType as string;
  const color = NODE_COLORS[type as keyof typeof NODE_COLORS] || '#3B82F6';

  return (
    <div className={`relative rounded-xl bg-[#1A1C24] border transition-all duration-150 w-60 ${selected ? 'border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.3)]' : 'border-[#2A2E42]'}`}>
      {/* Top handle */}
      {type !== 'TRIGGER' && (
        <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-[#0A0B0F]" />
      )}

      {/* Left color stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl" style={{ backgroundColor: color }} />

      {/* Header */}
      <div className="pl-4 pr-3 pt-3 pb-2 border-b border-[#1E2130]">
        <div className="flex items-center gap-2">
          <span style={{ color }}>{NODE_ICONS[type]}</span>
          <span className="text-[10px] text-[#8B90A7] uppercase tracking-wider font-medium">{NODE_LABELS[type]}</span>
        </div>
        <p className="text-sm font-semibold text-[#F0F2FF] mt-0.5 truncate">{data.label as string}</p>
      </div>

      {/* Body */}
      <div className="pl-4 pr-3 py-2">
        {data.preview ? (
          <p className="text-xs text-[#8B90A7] line-clamp-2">{data.preview as string}</p>
        ) : (
          <p className="text-xs text-[#4B5068] italic">Click to configure</p>
        )}
      </div>

      {/* Bottom handle */}
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-[#0A0B0F]" />

      {/* Extra handles for condition/randomizer */}
      {type === 'CONDITION' && (
        <>
          <Handle id="true" type="source" position={Position.Bottom} style={{ left: '33%' }} className="!w-3 !h-3 !bg-green-500 !border-2 !border-[#0A0B0F]" />
          <Handle id="false" type="source" position={Position.Bottom} style={{ left: '66%' }} className="!w-3 !h-3 !bg-red-500 !border-2 !border-[#0A0B0F]" />
        </>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  flowNode: FlowNode,
};


const NODE_PALETTE = [
  { group: 'TRIGGERS', items: ['TRIGGER'] },
  { group: 'MESSAGES', items: ['SEND_MESSAGE', 'SEND_DM_CARD', 'TIKTOK_SHOP_PRODUCT'] },
  { group: 'LOGIC', items: ['CONDITION', 'SUPER_RANDOMIZER', 'SMART_DELAY'] },
  { group: 'AI', items: ['AI_STEP', 'FRICTION_RECOVERY'] },
  { group: 'INTEGRATIONS', items: ['ACTION_BLOCK', 'OUTBOUND_WEBHOOK', 'CUSTOM_CODE'] },
];

let nodeCounter = 100;

export function FlowBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [flowName, setFlowName] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'PAUSED'>('DRAFT');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<null | { steps: { label: string; ok: boolean; detail: string }[] }>(null);
  const [loading, setLoading] = useState(true);

  // Load flow data from Supabase
  useEffect(() => {
    if (!id || !tenant) return;

    async function loadFlow() {
      setLoading(true);
      try {
        // Fetch flow metadata
        const { data: flow, error: flowError } = await supabase
          .from('flows')
          .select('name, status')
          .eq('id', id)
          .single();

        if (flowError) throw flowError;
        if (flow) {
          setFlowName(flow.name || '');
          setStatus(flow.status || 'DRAFT');
        }

        // Fetch flow nodes
        const { data: dbNodes, error: nodesError } = await supabase
          .from('flow_nodes')
          .select('*')
          .eq('flow_id', id);

        if (nodesError) throw nodesError;

        const rfNodes: Node[] = (dbNodes || []).map((n: any) => {
          const rfId = n.id;
          const configPreview = n.config && Object.keys(n.config).length > 0
            ? JSON.stringify(n.config)
            : '';
          return {
            id: rfId,
            type: 'flowNode',
            position: { x: Number(n.position_x), y: Number(n.position_y) },
            data: {
              nodeType: n.node_type,
              label: n.label || NODE_LABELS[n.node_type] || '',
              preview: configPreview,
              config: n.config,
              dbId: n.id,
            },
          };
        });

        setNodes(rfNodes);

        // Fetch flow edges
        const { data: dbEdges, error: edgesError } = await supabase
          .from('flow_edges')
          .select('*')
          .eq('flow_id', id);

        if (edgesError) throw edgesError;

        const rfEdges: Edge[] = (dbEdges || []).map((e: any) => ({
          id: e.id,
          source: e.source_node_id,
          target: e.target_node_id,
          type: 'smoothstep',
          label: e.edge_label || undefined,
          markerEnd: { type: MarkerType.ArrowClosed },
          data: { dbId: e.id, conditionConfig: e.condition_config },
        }));

        setEdges(rfEdges);
      } catch (err) {
        console.error('Failed to load flow:', err);
      } finally {
        setLoading(false);
      }
    }

    loadFlow();
  }, [id, tenant, setNodes, setEdges]);

  // panelConfig holds the live field values for whichever node is open in the properties panel
  const [panelConfig, setPanelConfig] = useState<Record<string, any>>({});

  // Whenever the selected node changes, seed panelConfig from node.data.config (or defaults)
  useEffect(() => {
    if (!selectedNode) { setPanelConfig({}); return; }
    const cfg = (selectedNode.data?.config as Record<string, any>) || {};
    const type = selectedNode.data?.nodeType as string;

    if (type === 'CONDITION') {
      setPanelConfig({
        conditionType: cfg.conditionType || 'Check Contact Field',
        field: cfg.field || 'email',
        operator: cfg.operator || 'equals',
        value: cfg.value || '',
        keyword: cfg.keyword || '',
        semanticMatch: cfg.semanticMatch || false,
        tier: cfg.tier || 'NEWBIE',
        tags: cfg.tags || [],
        tagInput: '',
      });
    } else if (type === 'SEND_MESSAGE') {
      setPanelConfig({
        message: cfg.message || selectedNode.data?.preview as string || '',
        buttons: cfg.buttons || [],
        askQuestion: cfg.askQuestion || false,
        questionFieldName: cfg.questionFieldName || '',
        questionValidation: cfg.questionValidation || 'text',
      });
    } else if (type === 'SMART_DELAY') {
      setPanelConfig({
        delayValue: cfg.delayValue ?? 30,
        delayUnit: cfg.delayUnit || 'minutes',
        only24hWindow: cfg.only24hWindow || false,
        queueIfOutside: cfg.queueIfOutside || false,
      });
    } else if (type === 'AI_STEP') {
      setPanelConfig({
        knowledgeBase: cfg.knowledgeBase || 'Product FAQ',
        strictness: cfg.strictness || 'BALANCED',
        ifUnsure: cfg.ifUnsure || 'Hand off to human',
        collectInput: cfg.collectInput || false,
        inputFieldName: cfg.inputFieldName || '',
        inputValidation: cfg.inputValidation || 'text',
        saveResponseTo: cfg.saveResponseTo || '',
        maxRetries: cfg.maxRetries ?? 2,
      });
    } else if (type === 'TRIGGER') {
      setPanelConfig({
        keywords: cfg.keywords || ['price', 'how much', 'link'],
        keywordInput: '',
        semanticMatch: cfg.semanticMatch || false,
      });
    } else {
      setPanelConfig({ ...cfg });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id]);

  // Helper: update a single key in panelConfig
  function pc(key: string, val: any) {
    setPanelConfig(prev => ({ ...prev, [key]: val }));
  }

  // Save panelConfig back to the selected node
  function saveNodeConfig(labelOverride?: string) {
    if (!selectedNode) return;
    const type = selectedNode.data?.nodeType as string;

    // Build a clean config (strip UI-only keys like tagInput / keywordInput)
    const { tagInput: _ti, keywordInput: _ki, ...cleanConfig } = panelConfig;

    // Build a human-readable preview string
    let preview = '';
    if (type === 'SEND_MESSAGE') {
      preview = cleanConfig.message ? cleanConfig.message.slice(0, 80) : '';
    } else if (type === 'CONDITION') {
      const ct = cleanConfig.conditionType;
      if (ct === 'Check Contact Field') preview = `${cleanConfig.field} ${cleanConfig.operator} "${cleanConfig.value}"`;
      else if (ct === 'Check Message Content') preview = `Message contains: "${cleanConfig.keyword}"`;
      else if (ct === 'Check Loyalty Tier') preview = `Tier is ${cleanConfig.tier}`;
      else if (ct === 'Check Tag') preview = `Has tag: ${(cleanConfig.tags || []).join(', ')}`;
    } else if (type === 'SMART_DELAY') {
      preview = `Wait ${cleanConfig.delayValue} ${cleanConfig.delayUnit}${cleanConfig.only24hWindow ? ' (24h window)' : ''}`;
    } else if (type === 'AI_STEP') {
      preview = `KB: ${cleanConfig.knowledgeBase} · ${cleanConfig.strictness}${cleanConfig.collectInput ? ' · Collects input' : ''}`;
    } else if (type === 'TRIGGER') {
      preview = (cleanConfig.keywords || []).join(', ');
    }

    const newLabel = labelOverride ?? (selectedNode.data?.label as string);

    setNodes(ns => ns.map(n => {
      if (n.id !== selectedNode.id) return n;
      return { ...n, data: { ...n.data, label: newLabel, preview, config: cleanConfig } };
    }));

    // If this is a CONDITION node, label its outgoing edges Yes/No
    if (type === 'CONDITION') {
      setEdges(eds => eds.map(e => {
        if (e.source !== selectedNode.id) return e;
        if (e.sourceHandle === 'true') return { ...e, label: 'Yes' };
        if (e.sourceHandle === 'false') return { ...e, label: 'No' };
        return e;
      }));
    }

    setSaveState('unsaved');
    // Sync selectedNode reference so subsequent saves reflect latest data
    setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, label: newLabel, preview, config: cleanConfig } } : prev);
  }

  // Compute 24h window warning for SMART_DELAY
  function delayExceeds24h(): boolean {
    const v = Number(panelConfig.delayValue) || 0;
    const u = panelConfig.delayUnit || 'minutes';
    if (u === 'days') return v >= 1;
    if (u === 'hours') return v >= 24;
    if (u === 'minutes') return v >= 1440;
    return false;
  }

  const onConnect = useCallback((params: Connection) => {
    // Auto-label edges coming from condition true/false handles
    let label: string | undefined;
    if (params.sourceHandle === 'true') label = 'Yes';
    else if (params.sourceHandle === 'false') label = 'No';
    setEdges(eds => addEdge({ ...params, type: 'smoothstep', label, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
    setSaveState('unsaved');
  }, [setEdges]);

  function addNode(type: string) {
    const id = `node-${++nodeCounter}`;
    setNodes(prev => [...prev, {
      id,
      type: 'flowNode',
      position: { x: 200 + Math.random() * 200, y: 200 + Math.random() * 200 },
      data: { nodeType: type, label: NODE_LABELS[type], preview: '', config: {} },
    }]);
    setSaveState('unsaved');
  }

  // Save flow to Supabase
  async function saveFlow() {
    if (!id || !tenant) return;
    setSaveState('saving');

    try {
      // Separate existing nodes (loaded from DB, have dbId) from new nodes (no dbId)
      const existingNodes = nodes.filter(n => n.data?.dbId);
      const newNodes = nodes.filter(n => !n.data?.dbId);

      // Upsert existing nodes
      if (existingNodes.length > 0) {
        const nodeUpserts = existingNodes.map((n) => ({
          id: n.data!.dbId as string,
          flow_id: id,
          tenant_id: tenant.id,
          node_type: n.data!.nodeType as string,
          label: n.data!.label as string || null,
          position_x: n.position.x,
          position_y: n.position.y,
          config: (n.data!.config as Record<string, unknown>) || {},
        }));
        const { error: upsertError } = await supabase
          .from('flow_nodes')
          .upsert(nodeUpserts, { onConflict: 'id' });
        if (upsertError) throw upsertError;
      }

      // Insert new nodes
      if (newNodes.length > 0) {
        const newNodeInserts = newNodes.map((n) => ({
          flow_id: id,
          tenant_id: tenant.id,
          node_type: n.data!.nodeType as string,
          label: n.data!.label as string || null,
          position_x: n.position.x,
          position_y: n.position.y,
          config: (n.data!.config as Record<string, unknown>) || {},
        }));
        const { data: inserted, error: insertError } = await supabase
          .from('flow_nodes')
          .insert(newNodeInserts)
          .select();
        if (insertError) throw insertError;

        // Map newly inserted DB IDs back to ReactFlow nodes
        if (inserted && inserted.length === newNodes.length) {
          const newNodesMap = new Map<string, string>();
          inserted.forEach((dbNode: any, i: number) => {
            newNodesMap.set(newNodes[i].id, dbNode.id);
          });

          // Update ReactFlow nodes with their DB IDs and update edge source/target refs
          const idUpdates = new Map<string, string>();
          setNodes(nds => nds.map(n => {
            const dbId = newNodesMap.get(n.id);
            if (dbId) {
              idUpdates.set(n.id, dbId);
              return { ...n, id: dbId, data: { ...n.data, dbId } };
            }
            return n;
          }));

          // Update edges that reference the old temp IDs to use the new DB IDs
          setEdges(eds => eds.map(e => {
            const newSource = idUpdates.get(e.source) || e.source;
            const newTarget = idUpdates.get(e.target) || e.target;
            if (newSource !== e.source || newTarget !== e.target) {
              return { ...e, source: newSource, target: newTarget };
            }
            return e;
          }));
        }
      }

      // Delete nodes that were removed from the canvas
      const currentDbIds = new Set(nodes.map(n => (n.data?.dbId as string) || '').filter(Boolean));
      const { data: allDbNodes } = await supabase
        .from('flow_nodes')
        .select('id')
        .eq('flow_id', id);
      if (allDbNodes) {
        const toDelete = allDbNodes.filter((n: any) => !currentDbIds.has(n.id)).map((n: any) => n.id);
        if (toDelete.length > 0) {
          await supabase.from('flow_nodes').delete().in('id', toDelete);
        }
      }

      // Delete edges that were removed from the canvas
      const { data: allDbEdges } = await supabase
        .from('flow_edges')
        .select('id')
        .eq('flow_id', id);

      const currentEdgeDbIds = new Set(edges.map(e => (e.data?.dbId as string) || '').filter(Boolean));
      if (allDbEdges) {
        const edgesToDelete = allDbEdges.filter((e: any) => !currentEdgeDbIds.has(e.id)).map((e: any) => e.id);
        if (edgesToDelete.length > 0) {
          await supabase.from('flow_edges').delete().in('id', edgesToDelete);
        }
      }

      // Upsert existing edges (those with dbId)
      const existingEdges = edges.filter(e => e.data?.dbId);
      if (existingEdges.length > 0) {
        const edgeUpserts = existingEdges.map((e) => ({
          id: e.data!.dbId as string,
          flow_id: id,
          tenant_id: tenant.id,
          source_node_id: e.source,
          target_node_id: e.target,
          edge_label: (e.label as string) || null,
          condition_config: (e.data!.conditionConfig as Record<string, unknown>) || {},
        }));
        const { error: edgeError } = await supabase
          .from('flow_edges')
          .upsert(edgeUpserts, { onConflict: 'id' });
        if (edgeError) throw edgeError;
      }

      // Insert brand new edges (no dbId)
      const newEdges = edges.filter(e => !e.data?.dbId);
      if (newEdges.length > 0) {
        const newEdgeInserts = newEdges.map((e) => ({
          flow_id: id,
          tenant_id: tenant.id,
          source_node_id: e.source,
          target_node_id: e.target,
          edge_label: (e.label as string) || null,
          condition_config: {},
        }));
        const { data: insertedEdges, error: edgeInsertError } = await supabase
          .from('flow_edges')
          .insert(newEdgeInserts)
          .select();
        if (edgeInsertError) throw edgeInsertError;

        // Update ReactFlow edges with DB IDs
        if (insertedEdges && insertedEdges.length === newEdges.length) {
          setEdges(eds => eds.map((e) => {
            if (!e.data?.dbId) {
              const match = insertedEdges.find((ie: any) =>
                ie.source_node_id === e.source && ie.target_node_id === e.target
              );
              if (match) {
                return { ...e, data: { ...e.data, dbId: match.id } };
              }
            }
            return e;
          }));
        }
      }

      // Update flow metadata
      const { error: flowError } = await supabase
        .from('flows')
        .update({
          name: flowName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (flowError) throw flowError;

      setSaveState('saved');
    } catch (err) {
      console.error('Failed to save flow:', err);
      setSaveState('unsaved');
    }
  }

  async function runTest() {
    if (!id) return;
    setTestRunning(true);
    try {
      const result = await flowEngineApi.validate(id);
      const steps = (result?.steps || []).map((s: any) => ({
        label: s.label || s.node_type || 'Step',
        ok: s.ok !== false,
        detail: s.detail || s.message || '',
      }));
      setTestResults({ steps });
    } catch (err: any) {
      setTestResults({
        steps: [{ label: 'Validation failed', ok: false, detail: err.message || 'Unknown error' }],
      });
    } finally {
      setTestRunning(false);
    }
  }

  const validationErrors = [
    ...(nodes.length < 2 ? [{ type: 'error', msg: 'Flow needs at least a trigger and one action node' }] : []),
  ];
  const validationWarnings = [
    { type: 'warning', msg: 'Smart Delay may push contacts past 24h window — add Message Tag' },
  ];

  // Ctrl+S keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (saveState === 'unsaved' || saveState === 'saving') {
          saveFlow();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveState, nodes, edges, flowName]);

  return (
    <div className="flex flex-col h-screen bg-[#0A0B0F]">
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0A0B0F]/80">
          <div className="flex items-center gap-2 text-[#8B90A7]">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading flow...</span>
          </div>
        </div>
      )}
      {/* Builder Topbar */}
      <div className="h-13 flex items-center justify-between px-4 bg-[#111318] border-b border-[#1E2130] flex-shrink-0 z-20" style={{ height: 52 }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/flows')} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8B90A7] hover:text-[#F0F2FF] hover:bg-[#1A1C24] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <input
            value={flowName}
            onChange={e => { setFlowName(e.target.value); setSaveState('unsaved'); }}
            className="text-base font-semibold text-[#F0F2FF] bg-transparent border-none outline-none hover:text-blue-400 focus:text-[#F0F2FF] transition-colors min-w-[140px]"
          />
          <Badge variant={status === 'ACTIVE' ? 'success' : status === 'PAUSED' ? 'warning' : 'default'}>
            {status.charAt(0) + status.slice(1).toLowerCase()}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {/* Multiplayer avatars (shown when other users are editing) */}
          {false && (
          <div className="flex items-center gap-1">
            {['S', 'J'].map((l, i) => (
              <div key={i} className="w-7 h-7 rounded-full border-2 border-[#0A0B0F] flex items-center justify-center text-xs font-bold text-white -ml-1 first:ml-0"
                style={{ backgroundColor: ['#3B82F6', '#22C55E'][i] }}>
                {l}
              </div>
            ))}
            <span className="text-xs text-[#8B90A7] ml-1">2 editing</span>
          </div>
          )}

          {/* 24H Window indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-xs text-green-400 font-medium">24H OK</span>
          </div>

          <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8B90A7] hover:text-[#F0F2FF] hover:bg-[#1A1C24]"><Undo2 className="w-4 h-4" /></button>
          <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8B90A7] hover:text-[#F0F2FF] hover:bg-[#1A1C24]"><Redo2 className="w-4 h-4" /></button>
          <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8B90A7] hover:text-[#F0F2FF] hover:bg-[#1A1C24]"><Download className="w-4 h-4" /></button>

          <button
            onClick={() => setShowValidation(!showValidation)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${validationErrors.length > 0 ? 'bg-red-500/10 border border-red-500/20 text-red-400' : validationWarnings.length > 0 ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}
          >
            {validationErrors.length > 0 ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Validate {validationErrors.length > 0 ? `(${validationErrors.length})` : ''}
          </button>

          <Button variant="secondary" size="sm" onClick={() => setShowTest(true)}>Test Flow</Button>

          <span className="text-xs text-[#4B5068]">
            {saveState === 'saved' ? '✓ Saved' : saveState === 'saving' ? 'Saving...' : '⬤ Unsaved'}
          </span>

          {saveState === 'unsaved' && (
            <Button variant="secondary" size="sm" onClick={saveFlow}>
              <Save className="w-3.5 h-3.5 mr-1" /> Save
            </Button>
          )}

          <Button
            variant="primary" size="sm"
            onClick={async () => {
              const newStatus = status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
              setStatus(newStatus);
              if (id) {
                try {
                  await supabase
                    .from('flows')
                    .update({ status: newStatus, updated_at: new Date().toISOString() })
                    .eq('id', id);
                } catch (err) {
                  console.error('Failed to update flow status:', err);
                  setStatus(status); // revert on error
                }
              }
            }}
          >
            {status === 'ACTIVE' ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Publish</>}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Node Palette */}
        <div className="w-52 bg-[#111318] border-r border-[#1E2130] overflow-y-auto flex-shrink-0 p-3">
          <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-widest mb-3">Add Nodes</p>
          <div className="space-y-4">
            {NODE_PALETTE.map(group => (
              <div key={group.group}>
                <p className="text-[10px] text-[#4B5068] uppercase tracking-wider mb-1.5">{group.group}</p>
                <div className="space-y-1">
                  {group.items.map(type => (
                    <button
                      key={type}
                      onClick={() => addNode(type)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-[#8B90A7] hover:bg-[#1A1C24] hover:text-[#F0F2FF] transition-colors group"
                    >
                      <span className="flex items-center" style={{ color: NODE_COLORS[type as keyof typeof NODE_COLORS] }}>
                        {NODE_ICONS[type]}
                      </span>
                      {NODE_LABELS[type]}
                      <Plus className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={e => { onNodesChange(e); setSaveState('unsaved'); }}
            onEdgesChange={e => { onEdgesChange(e); setSaveState('unsaved'); }}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[16, 16]}
            defaultEdgeOptions={{ type: 'smoothstep', style: { stroke: '#2A2E42' } }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1E2130" />
            <Controls className="bottom-4 left-4" />
            <MiniMap className="bottom-4 right-4" nodeColor={(n) => NODE_COLORS[(n.data?.nodeType as keyof typeof NODE_COLORS)] || '#2A2E42'} />
          </ReactFlow>
        </div>

        {/* Node Properties Panel */}
        {selectedNode && (
          <div className="w-80 bg-[#111318] border-l border-[#1E2130] overflow-y-auto flex-shrink-0 slide-in-right">
            <div className="flex items-center justify-between p-4 border-b border-[#1E2130]">
              <div className="flex items-center gap-2">
                <span style={{ color: NODE_COLORS[(selectedNode.data?.nodeType as keyof typeof NODE_COLORS)] }}>
                  {NODE_ICONS[selectedNode.data?.nodeType as string]}
                </span>
                <span className="text-sm font-semibold text-[#F0F2FF]">{NODE_LABELS[selectedNode.data?.nodeType as string]}</span>
              </div>
              <button onClick={() => setSelectedNode(null)} className="text-[#4B5068] hover:text-[#F0F2FF]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* ── Node name (all types) ── */}
              <div>
                <label className="text-xs font-medium text-[#8B90A7] block mb-1">Node name</label>
                <input
                  value={panelConfig.nodeName ?? (selectedNode.data?.label as string ?? '')}
                  onChange={e => pc('nodeName', e.target.value)}
                  className="h-9 w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] px-3 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* ══════════════════════════════════════════════════
                  TRIGGER
              ══════════════════════════════════════════════════ */}
              {selectedNode.data?.nodeType === 'TRIGGER' && (
                <div>
                  <label className="text-xs font-medium text-[#8B90A7] block mb-1">Keywords</label>
                  <div className="flex flex-wrap gap-1 p-2 rounded-lg bg-[#1A1C24] border border-[#2A2E42] min-h-[40px]">
                    {(panelConfig.keywords || []).map((kw: string) => (
                      <span key={kw} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs">
                        {kw}
                        <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => pc('keywords', panelConfig.keywords.filter((k: string) => k !== kw))} />
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input
                      value={panelConfig.keywordInput || ''}
                      onChange={e => pc('keywordInput', e.target.value)}
                      onKeyDown={e => {
                        if ((e.key === 'Enter' || e.key === ',') && panelConfig.keywordInput?.trim()) {
                          e.preventDefault();
                          const kw = panelConfig.keywordInput.trim().replace(/,$/, '');
                          if (kw && !(panelConfig.keywords || []).includes(kw)) {
                            setPanelConfig(prev => ({ ...prev, keywords: [...(prev.keywords || []), kw], keywordInput: '' }));
                          }
                        }
                      }}
                      placeholder="Type keyword + Enter"
                      className="flex-1 h-8 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2.5 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => {
                        const kw = (panelConfig.keywordInput || '').trim();
                        if (kw && !(panelConfig.keywords || []).includes(kw)) {
                          setPanelConfig(prev => ({ ...prev, keywords: [...(prev.keywords || []), kw], keywordInput: '' }));
                        }
                      }}
                      className="h-8 px-2.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/30"
                    >Add</button>
                  </div>
                  <div className="mt-2">
                    <Toggle
                      checked={panelConfig.semanticMatch || false}
                      onChange={v => pc('semanticMatch', v)}
                      label="Semantic matching (match similar meaning)"
                      size="sm"
                    />
                  </div>
                </div>
              )}

              {/* ══════════════════════════════════════════════════
                  SEND_MESSAGE — message + buttons + variable helper + ask-question
              ══════════════════════════════════════════════════ */}
              {selectedNode.data?.nodeType === 'SEND_MESSAGE' && (() => {
                const msg: string = panelConfig.message || '';
                const buttons: { label: string; action: string; value: string }[] = panelConfig.buttons || [];
                const charLimit = 1000;
                const variables = ['{{contact.name}}', '{{contact.email}}', '{{flow.keyword}}', '{{brand.name}}'];

                return (
                  <div className="space-y-3">
                    {/* Message textarea */}
                    <div>
                      <label className="text-xs font-medium text-[#8B90A7] block mb-1">Message content</label>
                      <textarea
                        value={msg}
                        onChange={e => pc('message', e.target.value)}
                        maxLength={charLimit}
                        className="w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] p-3 focus:outline-none focus:border-blue-500 resize-y min-h-[100px]"
                        placeholder="Hi {{contact.name}}! Thanks for reaching out..."
                      />
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] text-[#4B5068]">Press variable button below to insert</p>
                        <span className={`text-[10px] font-medium ${msg.length > charLimit * 0.9 ? 'text-amber-400' : 'text-[#4B5068]'}`}>{msg.length}/{charLimit}</span>
                      </div>
                    </div>

                    {/* Variable insertion helpers */}
                    <div>
                      <p className="text-[10px] text-[#8B90A7] font-medium mb-1.5 flex items-center gap-1"><Variable className="w-3 h-3" /> Insert variable</p>
                      <div className="flex flex-wrap gap-1">
                        {variables.map(v => (
                          <button
                            key={v}
                            onClick={() => pc('message', msg + v)}
                            className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 text-[10px] hover:bg-blue-500/25 font-mono"
                          >{v}</button>
                        ))}
                      </div>
                    </div>

                    {/* Quick-reply buttons */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-[#8B90A7]">Quick Reply Buttons</label>
                        {buttons.length < 3 && (
                          <button
                            onClick={() => pc('buttons', [...buttons, { label: 'Button ' + (buttons.length + 1), action: 'custom', value: '' }])}
                            className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300"
                          ><Plus className="w-3 h-3" /> Add Button</button>
                        )}
                      </div>
                      {buttons.length === 0 && (
                        <p className="text-[10px] text-[#4B5068] italic">No buttons. Up to 3 quick replies allowed.</p>
                      )}
                      <div className="space-y-2">
                        {buttons.map((btn, i) => (
                          <div key={i} className="p-2.5 rounded-lg bg-[#0A0B0F] border border-[#1E2130] space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                value={btn.label}
                                onChange={e => pc('buttons', buttons.map((b, j) => j === i ? { ...b, label: e.target.value } : b))}
                                placeholder="Button label"
                                className="flex-1 h-7 rounded bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2 focus:outline-none focus:border-blue-500"
                              />
                              <button onClick={() => pc('buttons', buttons.filter((_, j) => j !== i))} className="text-[#4B5068] hover:text-red-400">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <select
                              value={btn.action}
                              onChange={e => pc('buttons', buttons.map((b, j) => j === i ? { ...b, action: e.target.value } : b))}
                              className="h-7 w-full rounded bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2 appearance-none"
                            >
                              <option value="custom">Custom action</option>
                              <option value="open_url">Open URL</option>
                              <option value="trigger_flow">Trigger another flow</option>
                            </select>
                            <input
                              value={btn.value}
                              onChange={e => pc('buttons', buttons.map((b, j) => j === i ? { ...b, value: e.target.value } : b))}
                              placeholder={btn.action === 'open_url' ? 'https://...' : btn.action === 'trigger_flow' ? 'Flow ID or name' : 'Action payload'}
                              className="h-7 w-full rounded bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Message preview */}
                    {(msg || buttons.length > 0) && (
                      <div>
                        <p className="text-[10px] text-[#8B90A7] font-medium mb-1.5">Preview</p>
                        <div className="p-3 rounded-lg bg-[#0A0B0F] border border-[#1E2130]">
                          {msg && <p className="text-xs text-[#F0F2FF] whitespace-pre-wrap">{msg}</p>}
                          {buttons.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {buttons.map((btn, i) => (
                                <span key={i} className="px-3 py-1 rounded-full border border-blue-500/40 text-xs text-blue-400 bg-blue-500/10">{btn.label || 'Button'}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Ask question / collect input */}
                    <div className="pt-1 border-t border-[#1E2130]">
                      <Toggle
                        checked={panelConfig.askQuestion || false}
                        onChange={v => pc('askQuestion', v)}
                        label="Collect user response to this message"
                        size="sm"
                      />
                      {panelConfig.askQuestion && (
                        <div className="mt-3 space-y-2 pl-1">
                          <div>
                            <label className="text-[10px] text-[#8B90A7] block mb-1">Save response to field</label>
                            <input
                              value={panelConfig.questionFieldName || ''}
                              onChange={e => pc('questionFieldName', e.target.value)}
                              placeholder="e.g. user_email"
                              className="h-7 w-full rounded bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-[#8B90A7] block mb-1">Validation type</label>
                            <select
                              value={panelConfig.questionValidation || 'text'}
                              onChange={e => pc('questionValidation', e.target.value)}
                              className="h-7 w-full rounded bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2 appearance-none"
                            >
                              <option value="text">Any text</option>
                              <option value="email">Email address</option>
                              <option value="phone">Phone number</option>
                              <option value="number">Number</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ══════════════════════════════════════════════════
                  CONDITION
              ══════════════════════════════════════════════════ */}
              {selectedNode.data?.nodeType === 'CONDITION' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-[#8B90A7] block mb-1">Condition type</label>
                    <select
                      value={panelConfig.conditionType || 'Check Contact Field'}
                      onChange={e => pc('conditionType', e.target.value)}
                      className="h-9 w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] px-3 appearance-none focus:outline-none focus:border-blue-500"
                    >
                      <option>Check Contact Field</option>
                      <option>Check Message Content</option>
                      <option>Check Loyalty Tier</option>
                      <option>Check Tag</option>
                    </select>
                  </div>

                  {panelConfig.conditionType === 'Check Contact Field' && (
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] text-[#8B90A7] block mb-1">Field</label>
                        <select
                          value={panelConfig.field || 'email'}
                          onChange={e => pc('field', e.target.value)}
                          className="h-8 w-full rounded bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2 appearance-none focus:outline-none focus:border-blue-500"
                        >
                          <option value="email">Email</option>
                          <option value="phone">Phone</option>
                          <option value="loyalty_score">Loyalty Score</option>
                          <option value="sentiment_score">Sentiment Score</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-[#8B90A7] block mb-1">Operator</label>
                        <select
                          value={panelConfig.operator || 'equals'}
                          onChange={e => pc('operator', e.target.value)}
                          className="h-8 w-full rounded bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2 appearance-none focus:outline-none focus:border-blue-500"
                        >
                          <option value="equals">Equals</option>
                          <option value="not_equals">Not equals</option>
                          <option value="contains">Contains</option>
                          <option value="greater_than">Greater than</option>
                          <option value="less_than">Less than</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-[#8B90A7] block mb-1">Value</label>
                        <input
                          value={panelConfig.value || ''}
                          onChange={e => pc('value', e.target.value)}
                          placeholder="Comparison value"
                          className="h-8 w-full rounded bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {panelConfig.conditionType === 'Check Message Content' && (
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] text-[#8B90A7] block mb-1">Keyword or phrase</label>
                        <input
                          value={panelConfig.keyword || ''}
                          onChange={e => pc('keyword', e.target.value)}
                          placeholder="e.g. price, buy now"
                          className="h-8 w-full rounded bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <Toggle
                        checked={panelConfig.semanticMatch || false}
                        onChange={v => pc('semanticMatch', v)}
                        label="Semantic matching (match similar meaning)"
                        size="sm"
                      />
                    </div>
                  )}

                  {panelConfig.conditionType === 'Check Loyalty Tier' && (
                    <div>
                      <label className="text-[10px] text-[#8B90A7] block mb-1">Loyalty tier</label>
                      <select
                        value={panelConfig.tier || 'NEWBIE'}
                        onChange={e => pc('tier', e.target.value)}
                        className="h-8 w-full rounded bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2 appearance-none focus:outline-none focus:border-blue-500"
                      >
                        <option value="NEWBIE">NEWBIE</option>
                        <option value="FAN">FAN</option>
                        <option value="ADVOCATE">ADVOCATE</option>
                      </select>
                    </div>
                  )}

                  {panelConfig.conditionType === 'Check Tag' && (
                    <div>
                      <label className="text-[10px] text-[#8B90A7] block mb-1">Tags (all must match)</label>
                      <div className="flex flex-wrap gap-1 p-2 rounded bg-[#1A1C24] border border-[#2A2E42] min-h-[36px] mb-1.5">
                        {(panelConfig.tags || []).map((t: string) => (
                          <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px]">
                            {t}
                            <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => pc('tags', panelConfig.tags.filter((x: string) => x !== t))} />
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          value={panelConfig.tagInput || ''}
                          onChange={e => pc('tagInput', e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && panelConfig.tagInput?.trim()) {
                              e.preventDefault();
                              const t = panelConfig.tagInput.trim();
                              if (t && !(panelConfig.tags || []).includes(t)) {
                                setPanelConfig(prev => ({ ...prev, tags: [...(prev.tags || []), t], tagInput: '' }));
                              }
                            }
                          }}
                          placeholder="Tag name + Enter"
                          className="flex-1 h-7 rounded bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2 focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={() => {
                            const t = (panelConfig.tagInput || '').trim();
                            if (t && !(panelConfig.tags || []).includes(t)) {
                              setPanelConfig(prev => ({ ...prev, tags: [...(prev.tags || []), t], tagInput: '' }));
                            }
                          }}
                          className="h-7 px-2 rounded bg-amber-500/20 text-amber-400 text-xs hover:bg-amber-500/30"
                        >Add</button>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 p-3 rounded-lg bg-[#0A0B0F] border border-[#1E2130]">
                    <p className="text-[10px] text-[#8B90A7]">
                      The <span className="text-green-400 font-medium">green handle</span> routes contacts where the condition is <strong>true (Yes)</strong>.{' '}
                      The <span className="text-red-400 font-medium">red handle</span> routes <strong>false (No)</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* ══════════════════════════════════════════════════
                  SMART_DELAY
              ══════════════════════════════════════════════════ */}
              {selectedNode.data?.nodeType === 'SMART_DELAY' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-[#8B90A7] block mb-1">Delay</label>
                      <input
                        type="number"
                        min={1}
                        value={panelConfig.delayValue ?? 30}
                        onChange={e => pc('delayValue', Number(e.target.value))}
                        className="h-9 w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] px-3 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-[#8B90A7] block mb-1">Unit</label>
                      <select
                        value={panelConfig.delayUnit || 'minutes'}
                        onChange={e => pc('delayUnit', e.target.value)}
                        className="h-9 w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] px-3 appearance-none focus:outline-none focus:border-blue-500"
                      >
                        <option value="minutes">minutes</option>
                        <option value="hours">hours</option>
                        <option value="days">days</option>
                      </select>
                    </div>
                  </div>

                  <Toggle
                    checked={panelConfig.only24hWindow || false}
                    onChange={v => pc('only24hWindow', v)}
                    label="Send within 24h window only"
                    size="sm"
                  />

                  {panelConfig.only24hWindow && (
                    <Toggle
                      checked={panelConfig.queueIfOutside || false}
                      onChange={v => pc('queueIfOutside', v)}
                      label="If outside window, queue for next window"
                      size="sm"
                    />
                  )}

                  {delayExceeds24h() && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <p className="text-xs font-medium text-amber-400">24H Window Warning</p>
                      </div>
                      <p className="text-xs text-[#8B90A7]">
                        This delay ({panelConfig.delayValue} {panelConfig.delayUnit}) will push contacts past their 24h messaging window.
                        {!panelConfig.only24hWindow && ' Enable "Send within 24h window only" or add a Message Tag to the downstream node.'}
                      </p>
                      {!panelConfig.only24hWindow && (
                        <button className="text-xs text-blue-400 hover:text-blue-300 mt-1.5 font-medium">Add Message Tag →</button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════════════
                  AI_STEP
              ══════════════════════════════════════════════════ */}
              {selectedNode.data?.nodeType === 'AI_STEP' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-[#8B90A7] block mb-1">Knowledge Base</label>
                    <select
                      value={panelConfig.knowledgeBase || 'Product FAQ'}
                      onChange={e => pc('knowledgeBase', e.target.value)}
                      className="h-9 w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] px-3 appearance-none focus:outline-none focus:border-blue-500"
                    >
                      <option>Product FAQ</option>
                      <option>Shipping Policy</option>
                      <option>Returns Policy</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#8B90A7] block mb-2">Strictness</label>
                    <div className="flex gap-1 p-1 bg-[#0A0B0F] rounded-lg border border-[#1E2130]">
                      {['STRICT', 'BALANCED', 'CREATIVE'].map(s => (
                        <button
                          key={s}
                          onClick={() => pc('strictness', s)}
                          className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-colors ${panelConfig.strictness === s ? 'bg-[#1A1C24] text-[#F0F2FF]' : 'text-[#4B5068] hover:text-[#F0F2FF]'}`}
                        >{s}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#8B90A7] block mb-1">If unsure</label>
                    <select
                      value={panelConfig.ifUnsure || 'Hand off to human'}
                      onChange={e => pc('ifUnsure', e.target.value)}
                      className="h-9 w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] px-3 appearance-none focus:outline-none focus:border-blue-500"
                    >
                      <option>Hand off to human</option>
                      <option>Ask clarifying question</option>
                      <option>Send fallback message</option>
                    </select>
                  </div>

                  {/* Collect User Input */}
                  <div className="pt-1 border-t border-[#1E2130]">
                    <Toggle
                      checked={panelConfig.collectInput || false}
                      onChange={v => pc('collectInput', v)}
                      label="Collect user input (AI asks a question and waits)"
                      size="sm"
                    />
                    {panelConfig.collectInput && (
                      <div className="mt-3 space-y-2 pl-1">
                        <div>
                          <label className="text-[10px] text-[#8B90A7] block mb-1">Input field name</label>
                          <input
                            value={panelConfig.inputFieldName || ''}
                            onChange={e => pc('inputFieldName', e.target.value)}
                            placeholder="e.g. custom_order_id"
                            className="h-7 w-full rounded bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2 focus:outline-none focus:border-blue-500"
                          />
                          <p className="text-[10px] text-[#4B5068] mt-0.5">Saved to contact's custom_fields</p>
                        </div>
                        <div>
                          <label className="text-[10px] text-[#8B90A7] block mb-1">Validation type</label>
                          <select
                            value={panelConfig.inputValidation || 'text'}
                            onChange={e => pc('inputValidation', e.target.value)}
                            className="h-7 w-full rounded bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2 appearance-none"
                          >
                            <option value="text">Any text</option>
                            <option value="email">Email address</option>
                            <option value="phone">Phone number</option>
                            <option value="number">Number</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-[#8B90A7] block mb-1">Save response to</label>
                          <input
                            value={panelConfig.saveResponseTo || ''}
                            onChange={e => pc('saveResponseTo', e.target.value)}
                            placeholder="contact field name"
                            className="h-7 w-full rounded bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#8B90A7] block mb-1">Max retries before fallback</label>
                          <input
                            type="number"
                            min={0}
                            max={5}
                            value={panelConfig.maxRetries ?? 2}
                            onChange={e => pc('maxRetries', Number(e.target.value))}
                            className="h-7 w-24 rounded bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ══════════════════════════════════════════════════
                  SUPER_RANDOMIZER (existing, kept functional)
              ══════════════════════════════════════════════════ */}
              {selectedNode.data?.nodeType === 'SUPER_RANDOMIZER' && (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-[#8B90A7]">Paths</label>
                      <span className="text-[10px] text-green-400 font-medium">100% ✓</span>
                    </div>
                    <div className="space-y-2">
                      {[{ label: 'Path A', pct: 60, conv: '34%' }, { label: 'Path B', pct: 40, conv: '28%' }].map((path, i) => (
                        <div key={i} className="p-2 rounded-lg bg-[#0A0B0F] border border-[#1E2130]">
                          <div className="flex items-center justify-between mb-1">
                            <input defaultValue={path.label} className="text-xs font-medium text-[#F0F2FF] bg-transparent border-none outline-none" />
                            <div className="flex items-center gap-2">
                              <input type="number" defaultValue={path.pct} className="w-12 h-6 text-center rounded bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF]" />
                              <span className="text-xs text-[#4B5068]">%</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex-1 h-1 bg-[#2A2E42] rounded-full mr-2">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${path.pct}%` }} />
                            </div>
                            <span className="text-[10px] text-green-400">{path.conv} conv</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" className="w-full">
                    Pick Winner
                  </Button>
                </div>
              )}

              {/* ── Save / Delete ── */}
              <div className="pt-3 border-t border-[#1E2130] flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() => saveNodeConfig(panelConfig.nodeName || undefined)}
                >Save Node</Button>
                <Button variant="danger" size="sm" onClick={() => {
                  setNodes(ns => ns.filter(n => n.id !== selectedNode.id));
                  setSelectedNode(null);
                }}>Delete</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Validation Panel */}
      {showValidation && (
        <div className="absolute bottom-0 left-52 right-0 bg-[#111318] border-t border-[#1E2130] p-4 z-10 slide-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#F0F2FF]">Validation</h3>
            <button onClick={() => setShowValidation(false)}><X className="w-4 h-4 text-[#4B5068]" /></button>
          </div>
          <div className="space-y-2">
            {validationErrors.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-red-400">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {e.msg}
              </div>
            ))}
            {validationWarnings.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {w.msg}
              </div>
            ))}
            {validationErrors.length === 0 && validationWarnings.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Flow is valid and ready to publish
              </div>
            )}
          </div>
        </div>
      )}

      {/* Test Panel Modal */}
      <Modal open={showTest} onClose={() => { setShowTest(false); setTestResults(null); }} title="Test Flow" maxWidth="max-w-md">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[#8B90A7] block mb-1">Simulated input</label>
            <input
              value={testInput}
              onChange={e => setTestInput(e.target.value)}
              placeholder="e.g. what's the price?"
              className="h-9 w-full rounded-lg bg-[#111318] border border-[#2A2E42] text-sm text-[#F0F2FF] px-3 focus:outline-none focus:border-blue-500"
            />
          </div>
          <Button variant="primary" loading={testRunning} onClick={runTest} className="w-full">
            Simulate
          </Button>
          {testResults && (
            <div className="space-y-2 mt-4">
              <p className="text-xs font-semibold text-[#8B90A7] uppercase tracking-wider">Execution trace</p>
              {testResults.steps.map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-[#111318] border border-[#1E2130]">
                  {s.ok ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> : <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />}
                  <div>
                    <p className="text-xs font-medium text-[#F0F2FF]">{s.label}</p>
                    <p className="text-[10px] text-[#8B90A7]">{s.detail}</p>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-[#4B5068] text-center mt-2">No actual messages sent — simulation only</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
