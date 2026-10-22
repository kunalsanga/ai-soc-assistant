import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Network,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowRight,
  ShieldAlert,
  Server,
  User,
  Globe,
  FileCode,
  Target,
  Bug,
  Sparkles,
  HelpCircle,
  ExternalLink,
  Info,
  X,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { alertService } from '../services/api';
import type { GraphNode, InvestigationGraphData, DemoManifest } from '../services/api';

const NODE_COLORS: Record<string, { bg: string; border: string; text: string; glow: string; fill: string }> = {
  alert: { bg: '#831843', border: '#ec4899', text: '#fbcfe8', glow: 'rgba(236, 72, 153, 0.75)', fill: '#ec4899' },
  host: { bg: '#075985', border: '#38bdf8', text: '#bae6fd', glow: 'rgba(56, 189, 248, 0.75)', fill: '#38bdf8' },
  user: { bg: '#581c87', border: '#a855f7', text: '#e9d5ff', glow: 'rgba(168, 85, 247, 0.75)', fill: '#a855f7' },
  ip: { bg: '#155e75', border: '#06b6d4', text: '#cffafe', glow: 'rgba(6, 182, 212, 0.75)', fill: '#06b6d4' },
  rule: { bg: '#78350f', border: '#f59e0b', text: '#fef3c7', glow: 'rgba(245, 158, 11, 0.75)', fill: '#f59e0b' },
  mitre: { bg: '#065f46', border: '#22c55e', text: '#bbf7d0', glow: 'rgba(34, 197, 94, 0.75)', fill: '#22c55e' },
  cve: { bg: '#881337', border: '#f43f5e', text: '#fecdd3', glow: 'rgba(244, 63, 94, 0.75)', fill: '#f43f5e' },
  evidence: { bg: '#713f12', border: '#eab308', text: '#fef08a', glow: 'rgba(234, 179, 8, 0.75)', fill: '#eab308' },
  analysis: { bg: '#701a75', border: '#d946ef', text: '#f5d0fe', glow: 'rgba(217, 70, 239, 0.75)', fill: '#d946ef' },
  claim: { bg: '#1e293b', border: '#ffffff', text: '#ffffff', glow: 'rgba(255, 255, 255, 0.85)', fill: '#ffffff' },
};

const PROVENANCE_LABELS: Record<string, { label: string; badge: string }> = {
  observed: { label: 'Observed Telemetry', badge: 'text-pink-400 bg-pink-950/70 border-pink-800/40' },
  retrieved: { label: 'Retrieved Knowledge', badge: 'text-purple-400 bg-purple-950/70 border-purple-800/40' },
  knowledge_base: { label: 'Security Knowledge Corpus', badge: 'text-emerald-400 bg-emerald-950/70 border-emerald-800/40' },
  inferred: { label: 'AI Model Inference', badge: 'text-amber-400 bg-amber-950/70 border-amber-800/40' },
};

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export const EntityGraphPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const alertIdParam = searchParams.get('alertId');
  const scenarioParam = searchParams.get('scenario');

  const [graphData, setGraphData] = useState<InvestigationGraphData | null>(null);
  const [manifest, setManifest] = useState<DemoManifest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedScenario, setSelectedScenario] = useState<string>(scenarioParam || '');
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [neighborhoodHops, setNeighborhoodHops] = useState<number>(0);
  const [controlsOpen, setControlsOpen] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [sizeByDegree, setSizeByDegree] = useState<boolean>(true);

  const nodeCountsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    (graphData?.nodes || []).forEach((n) => {
      counts[n.type] = (counts[n.type] || 0) + 1;
    });
    return counts;
  }, [graphData]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load manifest & graph
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [graphRes, manifestRes] = await Promise.all([
        alertIdParam
          ? alertService.getInvestigationGraph(alertIdParam)
          : alertService.getGlobalGraph(selectedScenario || undefined, 60),
        alertService.getDemoManifest().catch(() => null),
      ]);
      setGraphData(graphRes);
      if (manifestRes) setManifest(manifestRes);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Failed to load entity graph from backend.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [alertIdParam, selectedScenario]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update URL on scenario change
  const handleScenarioChange = (sc: string) => {
    setSelectedScenario(sc);
    setSelectedNode(null);
    if (sc) {
      setSearchParams({ scenario: sc });
    } else {
      setSearchParams({});
    }
  };

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    if (!graphData?.nodes) return [];
    let list = graphData.nodes;

    // Filter by type
    if (filterType !== 'all') {
      if (filterType === 'telemetry') {
        list = list.filter((n) => ['host', 'user', 'ip', 'rule', 'alert'].includes(n.type));
      } else if (filterType === 'knowledge') {
        list = list.filter((n) => ['mitre', 'cve', 'evidence'].includes(n.type));
      } else if (filterType === 'ai') {
        list = list.filter((n) => ['analysis', 'claim'].includes(n.type));
      } else {
        list = list.filter((n) => n.type === filterType);
      }
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((n) => n.label.toLowerCase().includes(q) || n.type.toLowerCase().includes(q));
    }

    // Filter by neighborhood if requested
    if (selectedNode && neighborhoodHops > 0) {
      const hops = neighborhoodHops;
      const connected = new Set<string>([selectedNode.id]);
      for (let h = 0; h < hops; h++) {
        const currentSet = new Set(connected);
        graphData.edges.forEach((e) => {
          if (currentSet.has(e.source)) connected.add(e.target);
          if (currentSet.has(e.target)) connected.add(e.source);
        });
      }
      list = list.filter((n) => connected.has(n.id));
    }

    return list;
  }, [graphData, filterType, searchQuery, selectedNode, neighborhoodHops]);

  const activeNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(() => {
    if (!graphData?.edges) return [];
    return graphData.edges.filter((e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target));
  }, [graphData, activeNodeIds]);

  // Force-directed node positions simulation
  const [positions, setPositions] = useState<Record<string, Point>>({});

  useEffect(() => {
    if (filteredNodes.length === 0) return;

    const width = 1000;
    const height = 700;
    const initial: Record<string, Point> = {};

    filteredNodes.forEach((node, i) => {
      if (positions[node.id]) {
        initial[node.id] = { ...positions[node.id] };
      } else {
        // Organic radial layout
        const angle = (i / filteredNodes.length) * 2 * Math.PI;
        const radius = 180 + (i % 4) * 80;
        initial[node.id] = {
          x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
          y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
          vx: 0,
          vy: 0,
        };
      }
    });

    // Run 50 iterations of gentle relaxation
    for (let iter = 0; iter < 50; iter++) {
      // Repulsion between all nodes
      for (let i = 0; i < filteredNodes.length; i++) {
        const n1 = filteredNodes[i];
        const p1 = initial[n1.id];
        if (!p1) continue;

        for (let j = i + 1; j < filteredNodes.length; j++) {
          const n2 = filteredNodes[j];
          const p2 = initial[n2.id];
          if (!p2) continue;

          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);

          if (dist < 260) {
            const force = (260 - dist) / dist * 0.12;
            p1.x -= dx * force;
            p1.y -= dy * force;
            p2.x += dx * force;
            p2.y += dy * force;
          }
        }
      }

      // Attraction along edges
      filteredEdges.forEach((edge) => {
        const p1 = initial[edge.source];
        const p2 = initial[edge.target];
        if (!p1 || !p2) return;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const idealDist = 120;
        const force = (dist - idealDist) * 0.05;
        p1.x += (dx / dist) * force;
        p1.y += (dy / dist) * force;
        p2.x -= (dx / dist) * force;
        p2.y -= (dy / dist) * force;
      });
    }

    setPositions(initial);
  }, [filteredNodes.length, filteredEdges.length]);

  // Canvas pan / drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.graph-node')) return;
    setIsDraggingCanvas(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    } else if (draggingNodeId && positions[draggingNodeId]) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      setPositions((prev) => ({
        ...prev,
        [draggingNodeId]: { ...prev[draggingNodeId], x, y },
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
    setDraggingNodeId(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((z) => Math.min(Math.max(z * factor, 0.35), 2.8));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNode(null);
    setNeighborhoodHops(0);
  };

  // Node Degree calculation
  const nodeDegrees = useMemo(() => {
    const deg: Record<string, number> = {};
    if (!graphData?.edges) return deg;
    graphData.edges.forEach((e) => {
      deg[e.source] = (deg[e.source] || 0) + 1;
      deg[e.target] = (deg[e.target] || 0) + 1;
    });
    return deg;
  }, [graphData]);

  // Connected entities for selected node
  const selectedNodeNeighbors = useMemo(() => {
    if (!selectedNode || !graphData) return [];
    const neighbors: { node: GraphNode; relationship: string; direction: 'outgoing' | 'incoming' }[] = [];
    const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]));

    graphData.edges.forEach((e) => {
      if (e.source === selectedNode.id) {
        const targetNode = nodeMap.get(e.target);
        if (targetNode) neighbors.push({ node: targetNode, relationship: e.relationship, direction: 'outgoing' });
      } else if (e.target === selectedNode.id) {
        const sourceNode = nodeMap.get(e.source);
        if (sourceNode) neighbors.push({ node: sourceNode, relationship: e.relationship, direction: 'incoming' });
      }
    });
    return neighbors;
  }, [selectedNode, graphData]);

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />;
      case 'host':
        return <Server className="w-3.5 h-3.5 text-blue-400" />;
      case 'user':
        return <User className="w-3.5 h-3.5 text-purple-400" />;
      case 'ip':
        return <Globe className="w-3.5 h-3.5 text-cyan-400" />;
      case 'rule':
        return <FileCode className="w-3.5 h-3.5 text-amber-400" />;
      case 'mitre':
        return <Target className="w-3.5 h-3.5 text-emerald-400" />;
      case 'cve':
        return <Bug className="w-3.5 h-3.5 text-rose-400" />;
      case 'analysis':
        return <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <Network className="w-5 h-5 text-cyan-400" />
              Obsidian Entity Graph
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/40 text-cyan-300">
              FORCE-DIRECTED RELATIONSHIP EXPLORER
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Interactive multi-hop topological graph connecting alerts, hosts, users, RFC 5737 IPs, MITRE ATT&CK techniques, and CVEs.
          </p>
        </div>

        {/* Global Controls & Scenario Selector */}
        <div className="flex items-center gap-2">
          {manifest?.scenarios && (
            <select
              value={selectedScenario}
              onChange={(e) => handleScenarioChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#0c101a] border border-zinc-800 text-xs text-zinc-200 font-mono focus:border-cyan-500/50 focus:outline-none"
            >
              <option value="">All Scenarios ({graphData?.node_count ?? 0} Nodes)</option>
              {manifest.scenarios.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.id.toUpperCase()}: {sc.title.slice(0, 36)}...
                </option>
              ))}
            </select>
          )}

          <button
            onClick={loadData}
            title="Refresh graph from database"
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Canvas + Inspector Flex Wrapper */}
      <div className="relative flex-1 min-h-[720px] h-[calc(100vh-175px)] rounded-xl border border-zinc-800/90 bg-[#07090f] overflow-hidden flex">
        {/* Graph Canvas Container (Occupies 100% when no inspector, or flex-1 with inspector) */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          className="flex-1 relative h-full overflow-hidden select-none cursor-grab active:cursor-grabbing flex flex-col"
        >
          {/* Obsidian-Style Floating Settings Panel on Top-Left */}
          <div className="absolute top-3 left-3 z-30 pointer-events-auto">
            <div className="rounded-xl bg-[#0e111a]/95 backdrop-blur-md border border-zinc-800/90 shadow-2xl overflow-hidden font-mono text-xs w-64 transition-all">
              <div
                onClick={() => setControlsOpen(!controlsOpen)}
                className="flex items-center justify-between p-2.5 px-3 bg-[#131722] hover:bg-[#181d2b] cursor-pointer border-b border-zinc-800 text-zinc-300"
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Settings className="w-3.5 h-3.5 text-pink-400" />
                  <span>Graph view</span>
                </div>
                <span className="text-[10px] text-zinc-500">{controlsOpen ? '▼' : '▶'}</span>
              </div>

              {controlsOpen && (
                <div className="p-3 space-y-3 max-h-[460px] overflow-y-auto">
                  {/* Filters Section */}
                  <div>
                    <div className="text-[10px] uppercase text-zinc-400 font-bold mb-1.5 flex items-center justify-between">
                      <span>Filters</span>
                    </div>
                    {/* Search */}
                    <div className="relative mb-2">
                      <Search className="w-3 h-3 text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search node or label..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-6 pr-2 py-1 rounded bg-[#080a10] border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:border-cyan-500/50 focus:outline-none"
                      />
                    </div>
                    {/* Entity Type Filter */}
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      {['all', 'telemetry', 'knowledge', 'ai'].map((t) => (
                        <button
                          key={t}
                          onClick={() => setFilterType(t)}
                          className={`px-2 py-1 rounded capitalize ${
                            filterType === t
                              ? 'bg-pink-950 text-pink-300 border border-pink-700/60 font-semibold'
                              : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Groups Section (Obsidian Colors) */}
                  <div className="border-t border-zinc-800/80 pt-2.5">
                    <div className="text-[10px] uppercase text-zinc-400 font-bold mb-1.5">Color Groups</div>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#ec4899]" />
                          <span>Alert Telemetry</span>
                        </span>
                        <span className="text-zinc-500 text-[10px]">{nodeCountsByType.alert || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
                          <span>Host / Agent</span>
                        </span>
                        <span className="text-zinc-500 text-[10px]">{nodeCountsByType.host || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7]" />
                          <span>User Account</span>
                        </span>
                        <span className="text-zinc-500 text-[10px]">{nodeCountsByType.user || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]" />
                          <span>IP Address</span>
                        </span>
                        <span className="text-zinc-500 text-[10px]">{nodeCountsByType.ip || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
                          <span>MITRE ATT&CK</span>
                        </span>
                        <span className="text-zinc-500 text-[10px]">{nodeCountsByType.mitre || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e]" />
                          <span>NVD / CVE</span>
                        </span>
                        <span className="text-zinc-500 text-[10px]">{nodeCountsByType.cve || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]" />
                          <span>Retrieved Evidence</span>
                        </span>
                        <span className="text-zinc-500 text-[10px]">{nodeCountsByType.evidence || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Display & Physics Section */}
                  <div className="border-t border-zinc-800/80 pt-2.5 space-y-2">
                    <div className="text-[10px] uppercase text-zinc-400 font-bold">Display & Physics</div>
                    <label className="flex items-center justify-between text-[11px] text-zinc-300 cursor-pointer">
                      <span>Show Labels</span>
                      <input
                        type="checkbox"
                        checked={showLabels}
                        onChange={(e) => setShowLabels(e.target.checked)}
                        className="rounded border-zinc-700 text-pink-500 focus:ring-0"
                      />
                    </label>
                    <label className="flex items-center justify-between text-[11px] text-zinc-300 cursor-pointer">
                      <span>Size by Degree</span>
                      <input
                        type="checkbox"
                        checked={sizeByDegree}
                        onChange={(e) => setSizeByDegree(e.target.checked)}
                        className="rounded border-zinc-700 text-pink-500 focus:ring-0"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Canvas Floating Zoom & Layout Controls */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-[#0c101a]/90 backdrop-blur border border-zinc-800 rounded-lg p-1 text-zinc-400">
            <button
              onClick={() => setZoom((z) => Math.min(z * 1.2, 2.8))}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z / 1.2, 0.35))}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={resetView}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              title="Reset Zoom & Pan"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Graph Legend Overlay */}
          <div className="absolute bottom-3 left-3 z-20 hidden md:flex flex-wrap items-center gap-3 px-3 py-1.5 rounded-lg bg-[#0c101a]/90 backdrop-blur border border-zinc-800 text-[10px] font-mono text-zinc-400 pointer-events-auto">
            <span className="text-zinc-500 font-semibold uppercase">Legend:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Alert</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>Host</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>User</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
              <span>IP Address</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Rule</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>ATT&CK</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span>CVE</span>
            </div>
          </div>

          {/* Stats Bar Overlay */}
          <div className="absolute bottom-3 right-3 z-20 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0c101a]/90 backdrop-blur border border-zinc-800 text-[10px] font-mono text-zinc-400">
            <span>Visible: {filteredNodes.length} nodes</span>
            <span className="text-zinc-600">|</span>
            <span>{filteredEdges.length} edges</span>
            <span className="text-zinc-600">|</span>
            <span>Zoom: {Math.round(zoom * 100)}%</span>
          </div>

          {/* SVG Canvas Render */}
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
              <span className="text-xs font-mono text-zinc-400">Computing Obsidian Force-Directed Topology...</span>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-2 p-6 text-center">
              <Info className="w-8 h-8 text-rose-400 mb-2" />
              <span className="text-sm font-semibold text-zinc-200">Failed to render entity graph</span>
              <span className="text-xs font-mono text-zinc-500 max-w-md">{error}</span>
            </div>
          ) : (
            <svg
              className="w-full h-full flex-1"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
              }}
            >
              {/* Grid Dots */}
              <defs>
                <pattern id="grid-dots" width="30" height="30" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="0.8" fill="#1e293b" opacity="0.6" />
                </pattern>
              </defs>
              <rect x="-2000" y="-2000" width="6000" height="6000" fill="url(#grid-dots)" />

              {/* Edges */}
              <g className="edges">
                {filteredEdges.map((edge) => {
                  const p1 = positions[edge.source];
                  const p2 = positions[edge.target];
                  if (!p1 || !p2) return null;

                  const isConnectedToSelected =
                    selectedNode && (edge.source === selectedNode.id || edge.target === selectedNode.id);

                  return (
                    <g key={edge.id}>
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke={isConnectedToSelected ? '#06b6d4' : '#1e293b'}
                        strokeWidth={isConnectedToSelected ? 2 : 1}
                        strokeOpacity={isConnectedToSelected ? 0.9 : 0.45}
                      />
                    </g>
                  );
                })}
              </g>

              {/* Nodes */}
              <g className="nodes">
                {filteredNodes.map((node) => {
                  const pos = positions[node.id];
                  if (!pos) return null;

                  const style = NODE_COLORS[node.type] || NODE_COLORS.alert;
                  const degree = nodeDegrees[node.id] || 1;
                  const radius = sizeByDegree ? Math.min(Math.max(12 + degree * 2.2, 14), 28) : 16;
                  const isSelected = selectedNode?.id === node.id;

                  return (
                    <g
                      key={node.id}
                      className="graph-node cursor-pointer transition-transform duration-100"
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(node);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggingNodeId(node.id);
                      }}
                    >
                      {/* Selection Glow Ring */}
                      {isSelected && (
                        <circle
                          r={radius + 7}
                          fill="none"
                          stroke={style.border}
                          strokeWidth="2.5"
                          strokeDasharray="4 3"
                          className="animate-spin"
                          opacity="0.85"
                        />
                      )}

                      {/* Main Node Circle */}
                      <circle
                        r={radius}
                        fill={style.bg}
                        stroke={style.border}
                        strokeWidth={isSelected ? 3 : 1.8}
                        filter="drop-shadow(0 2px 8px rgba(0,0,0,0.5))"
                      />

                      {/* Inner Degree Pulse if high degree */}
                      {degree > 3 && (
                        <circle
                          r={radius * 0.45}
                          fill={style.border}
                          opacity="0.25"
                        />
                      )}

                      {/* Label Text */}
                      {showLabels && (
                        <text
                          y={radius + 12}
                          textAnchor="middle"
                          fill={isSelected ? '#38bdf8' : '#94a3b8'}
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight={isSelected ? '600' : '400'}
                          className="pointer-events-none select-none"
                        >
                          {node.label.length > 22 ? `${node.label.slice(0, 22)}...` : node.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>

        {/* Right-Hand Contextual Inspector (Only shown when an entity is selected) */}
        {selectedNode && (
          <aside
            aria-label="Entity Inspector"
            className="w-80 lg:w-96 shrink-0 h-full border-l border-zinc-800/90 bg-[#0c101a]/95 backdrop-blur-md p-4 flex flex-col overflow-y-auto z-30 shadow-2xl animate-in slide-in-from-right-4 duration-200"
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                    {getNodeIcon(selectedNode.type)}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                      {selectedNode.type} Entity
                    </span>
                    <h3 className="text-xs font-semibold text-zinc-100 break-words max-w-[200px]">
                      {selectedNode.label}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  title="Close inspector"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Provenance Badge */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Provenance</span>
                <div>
                  <span
                    className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded border ${
                      PROVENANCE_LABELS[selectedNode.provenance]?.badge || 'text-zinc-400 bg-zinc-900 border-zinc-800'
                    }`}
                  >
                    {PROVENANCE_LABELS[selectedNode.provenance]?.label || selectedNode.provenance}
                  </span>
                </div>
              </div>

              {/* Attributes Card */}
              {selectedNode.attributes && Object.keys(selectedNode.attributes).length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Attributes</span>
                  <div className="rounded-lg bg-[#07090e] border border-zinc-800/80 p-2.5 space-y-1.5 text-xs font-mono">
                    {Object.entries(selectedNode.attributes).map(([k, v]) => (
                      <div key={k} className="flex justify-between items-start gap-2 border-b border-zinc-900/60 pb-1 last:border-0 last:pb-0">
                        <span className="text-zinc-500 text-[10px] uppercase">{k}:</span>
                        <span className="text-zinc-200 text-right text-[11px] break-all">{String(v ?? 'N/A')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Connected Relationships (1-Hop) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">
                    Connected ({selectedNodeNeighbors.length})
                  </span>
                  <button
                    onClick={() => setNeighborhoodHops((h) => (h === 0 ? 1 : h === 1 ? 2 : 0))}
                    className="text-[10px] font-mono text-cyan-400 hover:underline"
                  >
                    {neighborhoodHops === 0 ? 'Focus 1-Hop' : neighborhoodHops === 1 ? 'Focus 2-Hop' : 'Show All'}
                  </button>
                </div>
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {selectedNodeNeighbors.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedNode(item.node)}
                      className="p-2 rounded bg-zinc-900/60 hover:bg-zinc-800/60 border border-zinc-800/70 cursor-pointer transition-colors text-xs"
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                        <span>{item.relationship}</span>
                        <span className="text-zinc-600">{item.direction}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-zinc-200 mt-0.5 truncate">
                        {getNodeIcon(item.node.type)}
                        <span className="truncate">{item.node.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contextual Navigation Actions */}
              <div className="pt-2 border-t border-zinc-800 space-y-2">
                {selectedNode.type === 'alert' && (
                  <Link
                    to={`/investigations/${selectedNode.attributes?.id ?? selectedNode.id.replace('alert-', '')}`}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800/60 text-xs font-mono text-cyan-300 transition-colors"
                  >
                    <span>Investigate Alert</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}

                {selectedNode.type === 'mitre' && (
                  <Link
                    to={`/knowledge?q=${encodeURIComponent(String(selectedNode.attributes?.technique_id || selectedNode.label))}`}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/60 text-xs font-mono text-emerald-300 transition-colors"
                  >
                    <span>Explore ATT&CK Technique</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}

                {selectedNode.type === 'cve' && (
                  <Link
                    to={`/knowledge?q=${encodeURIComponent(String(selectedNode.attributes?.cve_id || selectedNode.label))}`}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-800/60 text-xs font-mono text-rose-300 transition-colors"
                  >
                    <span>Inspect NVD / CVE</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default EntityGraphPage;
