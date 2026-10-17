import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShieldAlert,
  Server,
  User,
  Globe,
  FileCode,
  Target,
  Bug,
  FileText,
  Sparkles,
  HelpCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Filter,
  X,
  Layers,
} from 'lucide-react';
import type { GraphNode, InvestigationGraphData } from '../../services/api';

interface InvestigationGraphProps {
  data: InvestigationGraphData | null;
  loading?: boolean;
  onSelectNode?: (node: GraphNode) => void;
  onSearchKnowledge?: (identifier: string) => void;
}

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const NODE_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  alert: { bg: '#450a0a', border: '#ef4444', text: '#fca5a5', glow: 'rgba(239, 68, 68, 0.4)' },
  host: { bg: '#172554', border: '#3b82f6', text: '#93c5fd', glow: 'rgba(59, 130, 246, 0.4)' },
  user: { bg: '#3b0764', border: '#a855f7', text: '#d8b4fe', glow: 'rgba(168, 85, 247, 0.4)' },
  ip: { bg: '#083344', border: '#06b6d4', text: '#67e8f9', glow: 'rgba(6, 182, 212, 0.4)' },
  rule: { bg: '#451a03', border: '#f59e0b', text: '#fcd34d', glow: 'rgba(245, 158, 11, 0.4)' },
  mitre: { bg: '#022c22', border: '#10b981', text: '#6ee7b7', glow: 'rgba(16, 185, 129, 0.4)' },
  cve: { bg: '#4c0519', border: '#f43f5e', text: '#fda4af', glow: 'rgba(244, 63, 94, 0.4)' },
  evidence: { bg: '#2e1065', border: '#8b5cf6', text: '#c4b5fd', glow: 'rgba(139, 92, 246, 0.4)' },
  analysis: { bg: '#701a75', border: '#d946ef', text: '#f0abfc', glow: 'rgba(217, 70, 239, 0.4)' },
  claim: { bg: '#422006', border: '#eab308', text: '#fde047', glow: 'rgba(234, 179, 8, 0.4)' },
};

const PROVENANCE_LABELS: Record<string, { label: string; badge: string }> = {
  observed: { label: 'Observed Telemetry', badge: 'text-cyan-400 bg-cyan-950/70 border-cyan-800/40' },
  retrieved: { label: 'Retrieved Knowledge', badge: 'text-purple-400 bg-purple-950/70 border-purple-800/40' },
  knowledge_base: { label: 'Security Knowledge Corpus', badge: 'text-emerald-400 bg-emerald-950/70 border-emerald-800/40' },
  inferred: { label: 'AI Model Inference', badge: 'text-amber-400 bg-amber-950/70 border-amber-800/40' },
};

export const InvestigationGraph: React.FC<InvestigationGraphProps> = ({
  data,
  loading = false,
  onSelectNode,
  onSearchKnowledge,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  // Filtered nodes and edges
  const filteredNodes = useMemo(() => {
    if (!data?.nodes) return [];
    return data.nodes.filter((node) => {
      const matchesType =
        filterType === 'all' ||
        (filterType === 'telemetry' && ['host', 'user', 'ip', 'rule', 'alert'].includes(node.type)) ||
        (filterType === 'knowledge' && ['mitre', 'cve', 'evidence'].includes(node.type)) ||
        (filterType === 'ai' && ['analysis', 'claim'].includes(node.type)) ||
        node.type === filterType;

      const matchesSearch =
        !searchQuery ||
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.type.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesType && matchesSearch;
    });
  }, [data, filterType, searchQuery]);

  const activeNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(() => {
    if (!data?.edges) return [];
    return data.edges.filter(
      (edge) => activeNodeIds.has(edge.source) && activeNodeIds.has(edge.target)
    );
  }, [data, activeNodeIds]);

  // Node positions map for physics simulation
  const [positions, setPositions] = useState<Record<string, Point>>({});

  // Initialize node positions in a radial / force layout
  useEffect(() => {
    if (!data?.nodes || data.nodes.length === 0) return;

    const width = 800;
    const height = 550;
    const centerX = width / 2;
    const centerY = height / 2;

    const newPositions: Record<string, Point> = {};
    const alertNode = data.nodes.find((n) => n.type === 'alert');

    // Place alert in the center
    if (alertNode) {
      newPositions[alertNode.id] = { x: centerX, y: centerY, vx: 0, vy: 0 };
    }

    // Place remaining nodes in concentric rings by provenance/type
    const otherNodes = data.nodes.filter((n) => n.id !== alertNode?.id);
    const count = otherNodes.length;

    otherNodes.forEach((node, index) => {
      let radius = 220;
      if (['host', 'ip', 'user', 'rule'].includes(node.type)) radius = 160;
      else if (['analysis', 'claim'].includes(node.type)) radius = 240;
      else if (['evidence', 'mitre', 'cve'].includes(node.type)) radius = 300;

      const angle = (index / count) * 2 * Math.PI + (node.type === 'mitre' ? 0.4 : 0);
      newPositions[node.id] = {
        x: centerX + radius * Math.cos(angle) + (Math.random() - 0.5) * 40,
        y: centerY + radius * Math.sin(angle) + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
      };
    });

    setPositions(newPositions);
  }, [data]);

  // Pan & Zoom controls
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((z) => Math.min(Math.max(z * factor, 0.4), 2.5));
  };

  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).tagName === 'g') {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    } else if (draggingNodeId && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - pan.x) / zoom;
      const mouseY = (e.clientY - rect.top - pan.y) / zoom;
      setPositions((prev) => ({
        ...prev,
        [draggingNodeId]: {
          ...(prev[draggingNodeId] || { vx: 0, vy: 0 }),
          x: mouseX,
          y: mouseY,
        },
      }));
    }
  };

  const handleMouseUpCanvas = () => {
    setIsDraggingCanvas(false);
    setDraggingNodeId(null);
  };

  const handleNodeClick = (node: GraphNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode(node);
    if (onSelectNode) onSelectNode(node);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <ShieldAlert className="w-4 h-4 text-rose-400" />;
      case 'host':
        return <Server className="w-4 h-4 text-blue-400" />;
      case 'user':
        return <User className="w-4 h-4 text-purple-400" />;
      case 'ip':
        return <Globe className="w-4 h-4 text-cyan-400" />;
      case 'rule':
        return <FileCode className="w-4 h-4 text-amber-400" />;
      case 'mitre':
        return <Target className="w-4 h-4 text-emerald-400" />;
      case 'cve':
        return <Bug className="w-4 h-4 text-rose-400" />;
      case 'evidence':
        return <FileText className="w-4 h-4 text-violet-400" />;
      case 'analysis':
        return <Sparkles className="w-4 h-4 text-fuchsia-400" />;
      case 'claim':
        return <HelpCircle className="w-4 h-4 text-yellow-400" />;
      default:
        return <Layers className="w-4 h-4 text-zinc-400" />;
    }
  };

  if (loading) {
    return (
      <div className="card p-8 flex flex-col items-center justify-center min-h-[450px] space-y-3 bg-[#0a0d14]">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
        <span className="text-xs font-mono text-zinc-400">Synthesizing Obsidian Investigation Graph...</span>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="card p-8 flex flex-col items-center justify-center min-h-[450px] space-y-2 bg-[#0a0d14] text-center">
        <Layers className="w-8 h-8 text-zinc-600 mb-2" />
        <div className="text-sm font-semibold text-zinc-300">No Graph Data Available</div>
        <div className="text-xs text-zinc-500 max-w-sm">
          Run an AI analysis on this alert to populate knowledge provenance, attack techniques, and entity relationships.
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-zinc-800/80 bg-[#07090e] overflow-hidden select-none">
      {/* Top Controls Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto bg-[#0c101a]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-zinc-800">
          <Filter className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-[11px] font-mono text-zinc-400 mr-1">Filter:</span>
          {(['all', 'telemetry', 'knowledge', 'ai'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono capitalize transition-all ${
                filterType === t
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Node Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-2.5 py-1 text-xs font-mono bg-[#0c101a]/90 backdrop-blur-md border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 w-36 focus:w-48 transition-all"
            />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center bg-[#0c101a]/90 backdrop-blur-md rounded-lg border border-zinc-800 p-0.5">
            <button
              onClick={() => setZoom((z) => Math.min(z * 1.2, 2.5))}
              className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z * 0.8, 0.4))}
              className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={resetView}
              className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 rounded"
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDownCanvas}
        onMouseMove={handleMouseMoveCanvas}
        onMouseUp={handleMouseUpCanvas}
        className="w-full h-[550px] cursor-grab active:cursor-grabbing relative overflow-hidden"
      >
        <svg
          className="w-full h-full"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.05) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Edges */}
            {filteredEdges.map((edge) => {
              const src = positions[edge.source];
              const tgt = positions[edge.target];
              if (!src || !tgt) return null;

              const isHighlighted =
                selectedNode && (selectedNode.id === edge.source || selectedNode.id === edge.target);

              const isDashed = edge.provenance === 'inferred' || edge.relationship.includes('potential');

              return (
                <g key={edge.id} className="transition-all duration-300">
                  <line
                    x1={src.x}
                    y1={src.y}
                    x2={tgt.x}
                    y2={tgt.y}
                    stroke={isHighlighted ? '#06b6d4' : '#27272a'}
                    strokeWidth={isHighlighted ? 2.5 : 1.2}
                    strokeDasharray={isDashed ? '4,4' : undefined}
                    strokeOpacity={isHighlighted ? 0.9 : 0.6}
                  />
                  {/* Midpoint relationship tag */}
                  {zoom >= 0.8 && (
                    <text
                      x={(src.x + tgt.x) / 2}
                      y={(src.y + tgt.y) / 2 - 4}
                      fill={isHighlighted ? '#67e8f9' : '#71717a'}
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                      className="pointer-events-none select-none"
                    >
                      {edge.relationship.replace(/_/g, ' ')}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {filteredNodes.map((node) => {
              const pos = positions[node.id];
              if (!pos) return null;

              const colors = NODE_COLORS[node.type] || NODE_COLORS.alert;
              const isSelected = selectedNode?.id === node.id;
              const isAlert = node.type === 'alert';
              const radius = isAlert ? 28 : 20;

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={(e) => handleNodeClick(node, e)}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingNodeId(node.id);
                  }}
                  className="cursor-pointer group"
                >
                  {/* Selection / Pulse Halo */}
                  {isSelected && (
                    <circle
                      r={radius + 8}
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2"
                      strokeDasharray="4,3"
                      className="animate-spin"
                      style={{ animationDuration: '10s' }}
                    />
                  )}

                  {/* Node Outer Glow & Circle */}
                  <circle
                    r={radius}
                    fill={colors.bg}
                    stroke={isSelected ? '#22d3ee' : colors.border}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    style={{
                      filter: isSelected
                        ? 'drop-shadow(0 0 12px rgba(6, 182, 212, 0.7))'
                        : `drop-shadow(0 0 6px ${colors.glow})`,
                    }}
                    className="transition-all duration-200 group-hover:scale-110"
                  />

                  {/* Icon */}
                  <foreignObject
                    x={-radius / 2}
                    y={-radius / 2}
                    width={radius}
                    height={radius}
                    className="pointer-events-none"
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      {getNodeIcon(node.type)}
                    </div>
                  </foreignObject>

                  {/* Node Label Below */}
                  <text
                    y={radius + 14}
                    fill={isSelected ? '#ffffff' : '#d4d4d8'}
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="middle"
                    className="pointer-events-none select-none font-medium"
                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}
                  >
                    {node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Node Inspector Drawer */}
        {selectedNode && (
          <div className="absolute top-3 right-3 bottom-3 w-80 bg-[#0c101a]/95 backdrop-blur-md rounded-xl border border-zinc-700/80 p-4 z-30 shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center border"
                    style={{
                      backgroundColor: NODE_COLORS[selectedNode.type]?.bg,
                      borderColor: NODE_COLORS[selectedNode.type]?.border,
                    }}
                  >
                    {getNodeIcon(selectedNode.type)}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                      {selectedNode.type} NODE
                    </span>
                    <span className="text-xs font-bold text-zinc-100">{selectedNode.label}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Provenance Badge */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Provenance & Reality Status</span>
                <div
                  className={`px-2.5 py-1 rounded text-[11px] font-mono border flex items-center justify-between ${
                    PROVENANCE_LABELS[selectedNode.provenance]?.badge || 'text-zinc-300 bg-zinc-900 border-zinc-800'
                  }`}
                >
                  <span>{PROVENANCE_LABELS[selectedNode.provenance]?.label || selectedNode.provenance}</span>
                  <span className="capitalize text-[10px] opacity-80">{selectedNode.status || 'verified'}</span>
                </div>
              </div>

              {/* Attributes breakdown */}
              {selectedNode.attributes && Object.keys(selectedNode.attributes).length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Node Attributes</span>
                  <div className="space-y-1.5 bg-[#090d16] p-2.5 rounded-lg border border-zinc-800/80 text-xs">
                    {Object.entries(selectedNode.attributes).map(([k, v]) => (
                      <div key={k} className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-mono text-zinc-400 uppercase">{k}:</span>
                        <span className="font-mono text-zinc-200 break-words whitespace-pre-wrap text-[11px]">
                          {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Connected Relationships */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Connected Relationships</span>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {filteredEdges
                    .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                    .map((edge) => {
                      const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
                      const otherNode = data.nodes.find((n) => n.id === otherId);
                      const isOutgoing = edge.source === selectedNode.id;

                      return (
                        <div
                          key={edge.id}
                          className="px-2 py-1 rounded bg-zinc-900/60 border border-zinc-800 text-[10px] font-mono flex items-center justify-between text-zinc-300"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-cyan-400">{isOutgoing ? '→' : '←'}</span>
                            <span className="text-zinc-400">{edge.relationship.replace(/_/g, ' ')}</span>
                          </div>
                          <span className="text-zinc-200 truncate max-w-[90px]">{otherNode?.label || otherId}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Actions */}
            {selectedNode.type === 'mitre' && onSearchKnowledge && (
              <button
                onClick={() => {
                  const techId =
                    (selectedNode.attributes?.technique_id as string) ||
                    selectedNode.label.match(/T\d{4}(?:\.\d{3})?/)?.[0];
                  if (techId) onSearchKnowledge(techId);
                }}
                className="mt-4 w-full btn btn-primary flex items-center justify-center gap-2 text-xs py-2"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search in Knowledge Corpus</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Legend Footer */}
      <div className="px-4 py-2 bg-[#090d16] border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono text-zinc-400">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-rose-400" />
            <span>Alert</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-blue-400" />
            <span>Host</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 border border-cyan-400" />
            <span>IP</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-amber-400" />
            <span>Rule</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-400" />
            <span>ATT&CK / CVE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-500 border border-violet-400" />
            <span>Evidence</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-500 border border-fuchsia-400" />
            <span>AI Analysis / Claim</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-zinc-500">
          <span>Solid: Observed Fact</span>
          <span>Dashed: Inferred / Contextual</span>
          <span className="text-cyan-400 font-semibold">{data.node_count} Nodes, {data.edge_count} Edges</span>
        </div>
      </div>
    </div>
  );
};

export default InvestigationGraph;
