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
  AlertTriangle, CheckCircle2, X, ChevronDown, Plus,
  Zap, MessageSquare, Brain, GitBranch, Clock, RefreshCw,
  Code2, Webhook, ShoppingBag, Tag, Settings2
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

  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => addEdge({ ...params, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }, eds));
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
              <div>
                <label className="text-xs font-medium text-[#8B90A7] block mb-1">Node name</label>
                <input
                  defaultValue={selectedNode.data?.label as string}
                  className="h-9 w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] px-3 focus:outline-none focus:border-blue-500"
                />
              </div>

              {selectedNode.data?.nodeType === 'TRIGGER' && (
                <div>
                  <label className="text-xs font-medium text-[#8B90A7] block mb-1">Keywords</label>
                  <div className="flex flex-wrap gap-1 p-2 rounded-lg bg-[#1A1C24] border border-[#2A2E42] min-h-[40px]">
                    {['price', 'how much', 'link'].map(kw => (
                      <span key={kw} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs">
                        {kw} <X className="w-2.5 h-2.5 cursor-pointer" />
                      </span>
                    ))}
                  </div>
                  <div className="mt-2">
                    <Toggle checked={false} onChange={() => {}} label="Semantic matching (match similar meaning)" size="sm" />
                  </div>
                </div>
              )}

              {selectedNode.data?.nodeType === 'SEND_MESSAGE' && (
                <div>
                  <label className="text-xs font-medium text-[#8B90A7] block mb-1">Message content</label>
                  <textarea
                    defaultValue="Hi {{contact.name}}! Thanks for reaching out..."
                    className="w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] p-3 focus:outline-none focus:border-blue-500 resize-y min-h-[100px]"
                  />
                  <p className="text-[10px] text-[#4B5068] mt-1">Use {'{{contact.name}}'}, {'{{flow.keyword}}'} for personalization</p>
                </div>
              )}

              {selectedNode.data?.nodeType === 'AI_STEP' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-[#8B90A7] block mb-1">Knowledge Base</label>
                    <select className="h-9 w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] px-3 appearance-none">
                      <option>Product FAQ</option>
                      <option>Shipping Policy</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#8B90A7] block mb-2">Strictness</label>
                    <div className="flex gap-1 p-1 bg-[#0A0B0F] rounded-lg border border-[#1E2130]">
                      {['STRICT', 'BALANCED', 'CREATIVE'].map(s => (
                        <button key={s} className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-colors ${s === 'BALANCED' ? 'bg-[#1A1C24] text-[#F0F2FF]' : 'text-[#4B5068] hover:text-[#F0F2FF]'}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#8B90A7] block mb-1">If unsure</label>
                    <select className="h-9 w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] px-3 appearance-none">
                      <option>Hand off to human</option>
                      <option>Ask clarifying question</option>
                      <option>Send fallback message</option>
                    </select>
                  </div>
                </div>
              )}

              {selectedNode.data?.nodeType === 'SMART_DELAY' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-[#8B90A7] block mb-1">Delay</label>
                      <input type="number" defaultValue="30" className="h-9 w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] px-3 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-[#8B90A7] block mb-1">Unit</label>
                      <select className="h-9 w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] px-3 appearance-none">
                        <option>minutes</option>
                        <option>hours</option>
                        <option>days</option>
                      </select>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <p className="text-xs font-medium text-amber-400">24H Window Warning</p>
                    </div>
                    <p className="text-xs text-[#8B90A7]">This delay may push ~34% of contacts past their 24h window. Add a Message Tag to the downstream message node.</p>
                    <button className="text-xs text-blue-400 hover:text-blue-300 mt-1.5 font-medium">Add Message Tag →</button>
                  </div>
                </div>
              )}

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

              <div className="pt-3 border-t border-[#1E2130] flex gap-2">
                <Button variant="primary" size="sm" className="flex-1">Save Node</Button>
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
