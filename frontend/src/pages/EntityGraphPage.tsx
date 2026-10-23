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
  Maximize2,
  Sliders,
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { alertService } from '../services/api';
import type { GraphNode, InvestigationGraphData, DemoManifest } from '../services/api';

const NODE_COLORS: Record<string, { bg: string; border: string; text: string; glow: string; fill: string; ring: string }> = {
  alert: { bg: '#881337', border: '#f43f5e', text: '#fecdd3', glow: 'rgba(244, 63, 94, 0.65)', fill: '#f43f5e', ring: '#fda4af' },
  host: { bg: '#0369a1', border: '#38bdf8', text: '#bae6fd', glow: 'rgba(56, 189, 248, 0.65)', fill: '#38bdf8', ring: '#7dd3fc' },
  user: { bg: '#6b21a8', border: '#a855f7', text: '#e9d5ff', glow: 'rgba(168, 85, 247, 0.65)', fill: '#a855f7', ring: '#c084fc' },
  ip: { bg: '#0f766e', border: '#2dd4bf', text: '#ccfbf1', glow: 'rgba(45, 212, 191, 0.65)', fill: '#2dd4bf', ring: '#5eead4' },
  rule: { bg: '#92400e', border: '#f59e0b', text: '#fef3c7', glow: 'rgba(245, 158, 11, 0.65)', fill: '#f59e0b', ring: '#fcd34d' },
  mitre: { bg: '#047857', border: '#10b981', text: '#d1fae5', glow: 'rgba(16, 185, 129, 0.65)', fill: '#10b981', ring: '#6ee7b7' },
  cve: { bg: '#9f1239', border: '#fb7185', text: '#ffe4e6', glow: 'rgba(251, 113, 133, 0.65)', fill: '#fb7185', ring: '#f43f5e' },
  evidence: { bg: '#854d0e', border: '#eab308', text: '#fef9c3', glow: 'rgba(234, 179, 8, 0.65)', fill: '#eab308', ring: '#fde047' },
  analysis: { bg: '#86198f', border: '#d946ef', text: '#fae8ff', glow: 'rgba(217, 70, 239, 0.65)', fill: '#d946ef', ring: '#f0abfc' },
  claim: { bg: '#1e293b', border: '#ffffff', text: '#ffffff', glow: 'rgba(255, 255, 255, 0.85)', fill: '#ffffff', ring: '#e2e8f0' },
};

const PROVENANCE_LABELS: Record<string, { label: string; badge: string }> = {
  observed: { label: 'Observed Telemetry', badge: 'text-rose-400 bg-rose-950/70 border-rose-800/40' },
  retrieved: { label: 'Retrieved Knowledge', badge: 'text-purple-400 bg-purple-950/70 border-purple-800/40' },
  knowledge_base: { label: 'Security Knowledge Corpus', badge: 'text-emerald-400 bg-emerald-950/70 border-emerald-800/40' },
  inferred: { label: 'AI Model Inference', badge: 'text-amber-400 bg-amber-950/70 border-amber-800/40' },
};

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  cluster?: string;
}

interface Viewport {
  x: number;
  y: number;
  zoom: number;
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

  // Synchronous viewport ref + state
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const viewportRef = useRef<Viewport>(viewport);
  viewportRef.current = viewport;

  const isDraggingCanvasRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  const [neighborhoodHops, setNeighborhoodHops] = useState<number>(0);
  const [controlsOpen, setControlsOpen] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [sizeByDegree, setSizeByDegree] = useState<boolean>(true);
  const [clusterByScenario, setClusterByScenario] = useState<boolean>(true);
  const [edgeOpacity, setEdgeOpacity] = useState<number>(0.35);

  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 750,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const hasAutoFittedRef = useRef<boolean>(false);

  // ResizeObserver for dynamic canvas sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 50 && height > 50) {
          setContainerDimensions((prev) => {
            const dx = (width - prev.width) / 2;
            const dy = (height - prev.height) / 2;
            setViewport((v) => {
              const nv = { ...v, x: v.x + dx, y: v.y + dy };
              viewportRef.current = nv;
              return nv;
            });
            return { width, height };
          });
        }
      }
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Load manifest & graph
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    hasAutoFittedRef.current = false;
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
    setNeighborhoodHops(0);
    hasAutoFittedRef.current = false;
    if (sc) {
      setSearchParams({ scenario: sc });
    } else {
      setSearchParams({});
    }
  };

  // Node counts by type
  const nodeCountsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    (graphData?.nodes || []).forEach((n) => {
      counts[n.type] = (counts[n.type] || 0) + 1;
    });
    return counts;
  }, [graphData]);

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

  const selectedNeighborIds = useMemo(() => {
    const s = new Set<string>();
    if (!selectedNode) return s;
    s.add(selectedNode.id);
    selectedNodeNeighbors.forEach((item) => s.add(item.node.id));
    return s;
  }, [selectedNode, selectedNodeNeighbors]);

  // Force-directed node positions simulation with meaningful clustering
  const [positions, setPositions] = useState<Record<string, Point>>({});

  // Fit to View calculation
  const fitToView = useCallback(
    (customPositions?: Record<string, Point>) => {
      const posMap = customPositions || positions;
      const xs = Object.values(posMap).map((p) => p.x);
      const ys = Object.values(posMap).map((p) => p.y);
      if (xs.length === 0) return;

      const cw = containerDimensions.width || 1200;
      const ch = containerDimensions.height || 750;

      const minX = Math.min(...xs) - 24;
      const maxX = Math.max(...xs) + 24;
      const minY = Math.min(...ys) - 24;
      const maxY = Math.max(...ys) + 24;

      const graphWidth = Math.max(maxX - minX, 100);
      const graphHeight = Math.max(maxY - minY, 100);

      const scaleX = (cw - 140) / graphWidth;
      const scaleY = (ch - 140) / graphHeight;
      const targetScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.25), 1.35);

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      const nextViewport: Viewport = {
        zoom: targetScale,
        x: cw / 2 - centerX * targetScale,
        y: ch / 2 - centerY * targetScale,
      };
      viewportRef.current = nextViewport;
      setViewport(nextViewport);
    },
    [positions, containerDimensions]
  );

  // Stable Layout simulation: centered at (0, 0)
  useEffect(() => {
    if (filteredNodes.length === 0) return;

    // 1. Identify cluster assignment for each node
    const clusterMap: Record<string, string> = {};
    const clusterMembers: Record<string, string[]> = {};

    filteredNodes.forEach((node) => {
      const attrs = node.attributes || {};
      const sc =
        (attrs.scenario_id as string) ||
        (Array.isArray(attrs.scenarios) && attrs.scenarios[0]) ||
        (node.type === 'alert' && (attrs.scenario_id as string)) ||
        'general-env';

      clusterMap[node.id] = sc;
      if (!clusterMembers[sc]) clusterMembers[sc] = [];
      clusterMembers[sc].push(node.id);
    });

    // 2. Position cluster centroids around (0, 0) in an organic constellation ring
    const clusterKeys = Object.keys(clusterMembers);
    const numClusters = clusterKeys.length;
    const clusterCentroids: Record<string, { x: number; y: number }> = {};
    const ringRadius = 320;

    clusterKeys.forEach((key, idx) => {
      if (key === 'general-env') {
        clusterCentroids[key] = { x: 0, y: 0 };
      } else {
        const angle = (idx / numClusters) * 2 * Math.PI - Math.PI / 2;
        clusterCentroids[key] = {
          x: Math.cos(angle) * ringRadius,
          y: Math.sin(angle) * ringRadius,
        };
      }
    });

    // 3. Seed initial positions around their cluster centroids
    const current: Record<string, Point> = {};
    filteredNodes.forEach((node, i) => {
      const c = clusterCentroids[clusterMap[node.id]] || { x: 0, y: 0 };
      const angle = (i * 1.37) % (2 * Math.PI);
      const rad = 25 + ((i * 19) % 75);

      current[node.id] = {
        x: c.x + Math.cos(angle) * rad,
        y: c.y + Math.sin(angle) * rad,
        vx: 0,
        vy: 0,
        cluster: clusterMap[node.id],
      };
    });

    // 4. Stable Force Relaxation (120 iterations with velocity damping)
    for (let iter = 0; iter < 120; iter++) {
      const alpha = Math.max(1 - iter / 120, 0.1);

      // Force A: Cluster Gravity + Global Centering
      filteredNodes.forEach((node) => {
        const p = current[node.id];
        if (!p) return;
        const c = clusterCentroids[p.cluster || 'general-env'] || { x: 0, y: 0 };
        if (clusterByScenario) {
          p.vx += (c.x - p.x) * 0.05 * alpha;
          p.vy += (c.y - p.y) * 0.05 * alpha;
        }
        p.vx += (0 - p.x) * 0.015 * alpha;
        p.vy += (0 - p.y) * 0.015 * alpha;
      });

      // Force B: Spring Links
      filteredEdges.forEach((edge) => {
        const p1 = current[edge.source];
        const p2 = current[edge.target];
        if (!p1 || !p2) return;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy) || 1;

        const sameCluster = p1.cluster === p2.cluster;
        const idealDist = sameCluster ? 45 : 120;
        const force = (dist - idealDist) * (sameCluster ? 0.06 : 0.02) * alpha;

        p1.vx += (dx / dist) * force;
        p1.vy += (dy / dist) * force;
        p2.vx -= (dx / dist) * force;
        p2.vy -= (dy / dist) * force;
      });

      // Force C: Repulsion + Collision Prevention
      for (let i = 0; i < filteredNodes.length; i++) {
        const p1 = current[filteredNodes[i].id];
        if (!p1) continue;

        for (let j = i + 1; j < filteredNodes.length; j++) {
          const p2 = current[filteredNodes[j].id];
          if (!p2) continue;

          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.hypot(dx, dy) || 0.1;

          if (dist < 36) {
            const push = (36 - dist) * 0.25;
            p1.x -= (dx / dist) * push;
            p1.y -= (dy / dist) * push;
            p2.x += (dx / dist) * push;
            p2.y += (dy / dist) * push;
          } else if (dist < 140) {
            const rep = ((140 - dist) / 140) * 3.5 * alpha;
            p1.vx -= (dx / dist) * rep;
            p1.vy -= (dy / dist) * rep;
            p2.vx += (dx / dist) * rep;
            p2.vy += (dy / dist) * rep;
          }
        }
      }

      // Update positions with damping
      filteredNodes.forEach((node) => {
        const p = current[node.id];
        if (!p) return;
        p.vx *= 0.8;
        p.vy *= 0.8;
        p.x += p.vx;
        p.y += p.vy;
      });
    }

    setPositions(current);

    // Compute immediate center fit to view
    const xs = Object.values(current).map((p) => p.x);
    const ys = Object.values(current).map((p) => p.y);
    if (xs.length > 0) {
      const minX = Math.min(...xs) - 24;
      const maxX = Math.max(...xs) + 24;
      const minY = Math.min(...ys) - 24;
      const maxY = Math.max(...ys) + 24;

      const gw = Math.max(maxX - minX, 100);
      const gh = Math.max(maxY - minY, 100);
      const cw = containerDimensions.width || 1200;
      const ch = containerDimensions.height || 750;

      const scale = Math.min(Math.max(Math.min((cw - 140) / gw, (ch - 140) / gh), 0.25), 1.35);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      const nv: Viewport = {
        zoom: scale,
        x: cw / 2 - cx * scale,
        y: ch / 2 - cy * scale,
      };
      viewportRef.current = nv;
      setViewport(nv);
    }
  }, [filteredNodes, filteredEdges, clusterByScenario]);

  // High-performance Native Wheel Zoom Listener with { passive: false }
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const current = viewportRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.min(Math.max(current.zoom * factor, 0.15), 3.0);

      const graphX = (mouseX - current.x) / current.zoom;
      const graphY = (mouseY - current.y) / current.zoom;

      const nextViewport: Viewport = {
        zoom: newZoom,
        x: mouseX - graphX * newZoom,
        y: mouseY - graphY * newZoom,
      };

      viewportRef.current = nextViewport;
      setViewport(nextViewport);
    };

    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  // Canvas pan / drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.graph-node')) return;
    isDraggingCanvasRef.current = true;
    dragStartRef.current = {
      x: e.clientX - viewportRef.current.x,
      y: e.clientY - viewportRef.current.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvasRef.current) {
      const nextViewport: Viewport = {
        ...viewportRef.current,
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      };
      viewportRef.current = nextViewport;
      setViewport(nextViewport);
    } else if (draggingNodeId && positions[draggingNodeId]) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { x: panX, y: panY, zoom: z } = viewportRef.current;
      const x = (e.clientX - rect.left - panX) / z;
      const y = (e.clientY - rect.top - panY) / z;
      setPositions((prev) => ({
        ...prev,
        [draggingNodeId]: { ...prev[draggingNodeId], x, y },
      }));
    }
  };

  const handleMouseUp = () => {
    isDraggingCanvasRef.current = false;
    setDraggingNodeId(null);
  };

  const handleZoomButton = (direction: 'in' | 'out') => {
    const rect = containerRef.current?.getBoundingClientRect();
    const mouseX = (rect?.width || 1200) / 2;
    const mouseY = (rect?.height || 750) / 2;
    const current = viewportRef.current;
    const factor = direction === 'in' ? 1.25 : 0.8;
    const newZoom = Math.min(Math.max(current.zoom * factor, 0.15), 3.0);
    const graphX = (mouseX - current.x) / current.zoom;
    const graphY = (mouseY - current.y) / current.zoom;
    const nextViewport: Viewport = {
      zoom: newZoom,
      x: mouseX - graphX * newZoom,
      y: mouseY - graphY * newZoom,
    };
    viewportRef.current = nextViewport;
    setViewport(nextViewport);
  };

  const resetView = () => {
    fitToView();
    setSelectedNode(null);
    setNeighborhoodHops(0);
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />;
      case 'host':
        return <Server className="w-3.5 h-3.5 text-blue-400" />;
      case 'user':
        return <User className="w-3.5 h-3.5 text-purple-400" />;
      case 'ip':
        return <Globe className="w-3.5 h-3.5 text-teal-400" />;
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
    <div className="space-y-3 flex flex-col h-[calc(100vh-100px)]">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <Network className="w-5 h-5 text-cyan-400" />
              Obsidian Entity Graph
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/40 text-cyan-300">
              TOPOLOGICAL CLUSTER EXPLORER
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
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

      {/* Main Graph Canvas + Inspector Flex Wrapper */}
      <div className="relative flex-1 min-h-[500px] rounded-xl border border-zinc-800/90 bg-[#07090f] overflow-hidden flex">
        {/* Graph Canvas Container (Occupies 100% full width and height) */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="flex-1 relative h-full w-full overflow-hidden select-none cursor-grab active:cursor-grabbing flex flex-col"
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
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-500">{filteredNodes.length} nodes</span>
                  {controlsOpen ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
                </div>
              </div>

              {controlsOpen && (
                <div className="p-3 space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {/* Filters Section */}
                  <div>
                    <div className="text-[10px] uppercase text-zinc-400 font-bold mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Filter className="w-3 h-3 text-cyan-400" />
                        <span>Filters</span>
                      </span>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="text-[9px] text-zinc-500 hover:text-zinc-300"
                        >
                          Clear
                        </button>
                      )}
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
                          className={`px-2 py-1 rounded capitalize transition-colors ${
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
                          <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e]" />
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
                          <span className="w-2.5 h-2.5 rounded-full bg-[#2dd4bf]" />
                          <span>IP Address</span>
                        </span>
                        <span className="text-zinc-500 text-[10px]">{nodeCountsByType.ip || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                          <span>MITRE ATT&CK</span>
                        </span>
                        <span className="text-zinc-500 text-[10px]">{nodeCountsByType.mitre || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#fb7185]" />
                          <span>NVD / CVE</span>
                        </span>
                        <span className="text-zinc-500 text-[10px]">{nodeCountsByType.cve || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                          <span>Rule / Trigger</span>
                        </span>
                        <span className="text-zinc-500 text-[10px]">{nodeCountsByType.rule || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Display & Physics Section */}
                  <div className="border-t border-zinc-800/80 pt-2.5 space-y-2">
                    <div className="text-[10px] uppercase text-zinc-400 font-bold flex items-center gap-1">
                      <Sliders className="w-3 h-3 text-pink-400" />
                      <span>Display & Physics</span>
                    </div>

                    <label className="flex items-center justify-between text-[11px] text-zinc-300 cursor-pointer">
                      <span>Show Labels</span>
                      <input
                        type="checkbox"
                        checked={showLabels}
                        onChange={(e) => setShowLabels(e.target.checked)}
                        className="rounded border-zinc-700 text-pink-500 focus:ring-0 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between text-[11px] text-zinc-300 cursor-pointer">
                      <span>Size by Degree</span>
                      <input
                        type="checkbox"
                        checked={sizeByDegree}
                        onChange={(e) => setSizeByDegree(e.target.checked)}
                        className="rounded border-zinc-700 text-pink-500 focus:ring-0 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between text-[11px] text-zinc-300 cursor-pointer">
                      <span>Cluster by Scenario</span>
                      <input
                        type="checkbox"
                        checked={clusterByScenario}
                        onChange={(e) => setClusterByScenario(e.target.checked)}
                        className="rounded border-zinc-700 text-pink-500 focus:ring-0 cursor-pointer"
                      />
                    </label>

                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px] text-zinc-400">
                        <span>Edge Opacity</span>
                        <span>{Math.round(edgeOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="0.9"
                        step="0.05"
                        value={edgeOpacity}
                        onChange={(e) => setEdgeOpacity(parseFloat(e.target.value))}
                        className="w-full accent-pink-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Floating Canvas Navigation & Zoom Toolbar (Top-Right) */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-[#0c101a]/90 backdrop-blur-md border border-zinc-800 rounded-lg p-1 text-zinc-400 shadow-xl">
            <button
              onClick={() => fitToView()}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-cyan-400 transition-colors"
              title="Fit to View (Fit all visible entities in viewport)"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleZoomButton('in')}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleZoomButton('out')}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={resetView}
              className="p-1.5 rounded hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            {selectedNode && (
              <button
                onClick={() => {
                  setSelectedNode(null);
                  setNeighborhoodHops(0);
                }}
                className="p-1.5 rounded hover:bg-rose-950/60 hover:text-rose-400 transition-colors border-l border-zinc-800 pl-2"
                title="Clear Selection"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Graph Legend Overlay */}
          <div className="absolute bottom-3 left-3 z-20 hidden md:flex flex-wrap items-center gap-3 px-3 py-1.5 rounded-lg bg-[#0c101a]/90 backdrop-blur-md border border-zinc-800 text-[10px] font-mono text-zinc-400 pointer-events-auto">
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
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
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

          {/* Status Bar Overlay */}
          <div className="absolute bottom-3 right-3 z-20 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0c101a]/90 backdrop-blur-md border border-zinc-800 text-[10px] font-mono text-zinc-400">
            <span>Visible: {filteredNodes.length} nodes</span>
            <span className="text-zinc-600">|</span>
            <span>{filteredEdges.length} edges</span>
            <span className="text-zinc-600">|</span>
            <span>Zoom: {Math.round(viewport.zoom * 100)}%</span>
            {selectedScenario && (
              <>
                <span className="text-zinc-600">|</span>
                <span className="text-cyan-400 uppercase">{selectedScenario}</span>
              </>
            )}
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
          ) : filteredNodes.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 p-6 text-center">
              <Search className="w-8 h-8 text-zinc-600 mb-1" />
              <span className="text-sm font-semibold text-zinc-300">No matching entities found</span>
              <p className="text-xs text-zinc-500 max-w-sm">
                No graph nodes match your search query &quot;{searchQuery}&quot; or selected filter.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                  setNeighborhoodHops(0);
                }}
                className="px-3 py-1.5 text-xs font-mono rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-cyan-400 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <svg
              ref={svgRef}
              className="w-full h-full block flex-1"
              style={{ width: '100%', height: '100%', touchAction: 'none' }}
            >
              {/* Grid Background Pattern */}
              <defs>
                <pattern id="grid-dots" width="32" height="32" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.1" fill="#334155" opacity="0.35" />
                </pattern>
              </defs>

              {/* Viewport Transform Group (Zoom and Pan applied here, keeping SVG 100% full bleed) */}
              <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
                {/* Infinite Grid Plane */}
                <rect x="-16000" y="-16000" width="32000" height="32000" fill="url(#grid-dots)" />

                {/* Edges */}
                <g className="edges">
                  {filteredEdges.map((edge) => {
                    const p1 = positions[edge.source];
                    const p2 = positions[edge.target];
                    if (!p1 || !p2) return null;

                    const isConnectedToSelected =
                      selectedNode && (edge.source === selectedNode.id || edge.target === selectedNode.id);

                    const isDimmed = selectedNode && !isConnectedToSelected;

                    const strokeColor = isConnectedToSelected
                      ? '#38bdf8'
                      : isDimmed
                      ? '#1e293b'
                      : '#334155';

                    const strokeWidth = isConnectedToSelected ? 2.5 : 1;
                    const strokeOpacity = isConnectedToSelected ? 0.95 : isDimmed ? 0.15 : edgeOpacity;

                    return (
                      <g key={edge.id}>
                        <line
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          strokeOpacity={strokeOpacity}
                          strokeLinecap="round"
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
                    const radius = sizeByDegree ? Math.min(Math.max(13 + degree * 2.2, 14), 28) : 16;
                    const isSelected = selectedNode?.id === node.id;
                    const isNeighbor = selectedNeighborIds.has(node.id) && !isSelected;
                    const isDimmed = selectedNode && !isSelected && !isNeighbor;

                    // Adaptive label visibility:
                    // At low zoom (< 0.65), only render high-degree hubs or selected node to prevent visual clutter
                    const shouldShowLabel =
                      showLabels && (viewport.zoom >= 0.65 || degree >= 4 || isSelected || isNeighbor);

                    return (
                      <g
                        key={node.id}
                        className="graph-node cursor-pointer transition-opacity duration-150"
                        opacity={isDimmed ? 0.3 : 1}
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
                        {/* Selection Halo Ring */}
                        {isSelected && (
                          <circle
                            r={radius + 8}
                            fill="none"
                            stroke={style.ring}
                            strokeWidth="2.5"
                            strokeDasharray="5 4"
                            opacity="0.9"
                          />
                        )}

                        {/* Neighbor Accent Ring */}
                        {isNeighbor && (
                          <circle
                            r={radius + 4}
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="1.5"
                            opacity="0.65"
                          />
                        )}

                        {/* Main Node Circle */}
                        <circle
                          r={radius}
                          fill={style.bg}
                          stroke={isSelected ? '#ffffff' : style.border}
                          strokeWidth={isSelected ? 2.5 : 1.8}
                          filter="drop-shadow(0 2px 6px rgba(0,0,0,0.6))"
                        />

                        {/* Inner Degree Pulse Ring if High Degree Hub */}
                        {degree >= 3 && (
                          <circle
                            r={radius * 0.45}
                            fill={style.border}
                            opacity={isSelected ? 0.6 : 0.3}
                          />
                        )}

                        {/* Label Text */}
                        {shouldShowLabel && (
                          <text
                            y={radius + 12}
                            textAnchor="middle"
                            fill={isSelected ? '#38bdf8' : isNeighbor ? '#e2e8f0' : '#94a3b8'}
                            fontSize="9"
                            fontFamily="monospace"
                            fontWeight={isSelected ? '700' : '500'}
                            className="pointer-events-none select-none drop-shadow-sm"
                          >
                            {node.label.length > 24 ? `${node.label.slice(0, 24)}...` : node.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
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
                  onClick={() => {
                    setSelectedNode(null);
                    setNeighborhoodHops(0);
                  }}
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

              {/* Scenario Membership */}
              {Boolean(selectedNode.attributes?.scenario_id) && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Associated Scenario</span>
                  <div className="flex items-center justify-between p-2 rounded bg-cyan-950/40 border border-cyan-800/40 text-[11px] font-mono">
                    <span className="text-cyan-300 font-semibold">{String(selectedNode.attributes?.scenario_id).toUpperCase()}</span>
                    <button
                      onClick={() => handleScenarioChange(String(selectedNode.attributes?.scenario_id))}
                      className="text-[10px] text-cyan-400 hover:underline"
                    >
                      Filter Scenario
                    </button>
                  </div>
                </div>
              )}

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

              {/* Connected Relationships (1-Hop & 2-Hop) */}
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
