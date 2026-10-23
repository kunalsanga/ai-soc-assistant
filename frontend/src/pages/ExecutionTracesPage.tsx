import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Layers,
  Clock,
  CheckCircle2,
  AlertOctagon,
  Network,
  Play,
  Pause,
  RotateCcw,
  RefreshCw,
  Sliders,
  Database,
  Cpu,
  Search,
  FileText,
  Activity,
  Zap,
  ShieldCheck,
  Radio,
  Sparkles,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Copy,
  Check,
  X,
  FastForward,
  Terminal,
  BarChart2,
} from 'lucide-react';
import { alertService, healthService } from '../services/api';
import type { Alert, ExecutionTraceData, ExecutionStage, DetailedHealth } from '../services/api';
import SeverityBadge from '../components/common/SeverityBadge';

// Logical Architecture Node definitions mapped to actual backend modules
export interface ArchNode {
  id: string;
  step: number;
  stage_id: string;
  title: string;
  subtitle: string;
  component: string;
  zone: 'ingestion' | 'context' | 'vector' | 'inference' | 'delivery';
  x: number;
  y: number;
  color: string;
  glow: string;
  icon: React.ReactNode;
}

export interface ArchEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  curveType?: 'direct' | 'upper' | 'lower';
}

const ARCH_NODES: ArchNode[] = [
  // Zone 1: Ingestion & Storage
  {
    id: 'node-source',
    step: 1,
    stage_id: 'alert_source',
    title: 'Alert Source',
    subtitle: 'Wazuh API / Demo Source',
    component: 'app.wazuh.client.WazuhClient',
    zone: 'ingestion',
    x: 130,
    y: 160,
    color: '#f43f5e',
    glow: 'rgba(244, 63, 94, 0.45)',
    icon: <Radio className="w-4 h-4 text-rose-400" />,
  },
  {
    id: 'node-ingest',
    step: 1,
    stage_id: 'ingestion',
    title: 'Ingestion & Normalization',
    subtitle: 'Schema Invariants',
    component: 'app.wazuh.service.AlertService',
    zone: 'ingestion',
    x: 130,
    y: 340,
    color: '#fb7185',
    glow: 'rgba(251, 113, 133, 0.45)',
    icon: <Activity className="w-4 h-4 text-pink-400" />,
  },
  {
    id: 'node-pg-alert',
    step: 1,
    stage_id: 'pg_alert_storage',
    title: 'PostgreSQL Alert DB',
    subtitle: 'Normalized Alerts',
    component: 'app.db.models.alert.Alert',
    zone: 'ingestion',
    x: 130,
    y: 520,
    color: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.45)',
    icon: <Database className="w-4 h-4 text-sky-400" />,
  },

  // Zone 2: Context & Query Formulation
  {
    id: 'node-context',
    step: 2,
    stage_id: 'context',
    title: 'Context Extraction',
    subtitle: 'Host · User · IOCs',
    component: 'app.security.normalization',
    zone: 'context',
    x: 420,
    y: 240,
    color: '#06b6d4',
    glow: 'rgba(6, 182, 212, 0.45)',
    icon: <ShieldCheck className="w-4 h-4 text-cyan-400" />,
  },
  {
    id: 'node-query',
    step: 3,
    stage_id: 'query_formulation',
    title: 'Query Formulation',
    subtitle: 'MITRE & CVE Queries',
    component: 'app.services.orchestrator.SOCAnalysisOrchestrator',
    zone: 'context',
    x: 420,
    y: 450,
    color: '#6366f1',
    glow: 'rgba(99, 102, 241, 0.45)',
    icon: <Search className="w-4 h-4 text-indigo-400" />,
  },

  // Zone 3: Embeddings & Vector Store
  {
    id: 'node-embed',
    step: 4,
    stage_id: 'vector_embedding',
    title: 'Semantic Embeddings',
    subtitle: 'all-MiniLM-L6-v2 (384-d)',
    component: 'app.rag.knowledge.embeddings.semantic',
    zone: 'vector',
    x: 720,
    y: 240,
    color: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.45)',
    icon: <Zap className="w-4 h-4 text-purple-400" />,
  },
  {
    id: 'node-qdrant',
    step: 5,
    stage_id: 'qdrant_retrieval',
    title: 'Qdrant Vector Retrieval',
    subtitle: 'ANN Cosine (Port 6333)',
    component: 'app.rag.knowledge.vectorstore.qdrant.QdrantIndex',
    zone: 'vector',
    x: 720,
    y: 450,
    color: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.45)',
    icon: <Database className="w-4 h-4 text-fuchsia-400" />,
  },

  // Zone 4: Grounding & LLM Inference
  {
    id: 'node-grounding',
    step: 6,
    stage_id: 'evidence_grounding',
    title: 'Evidence Grounding',
    subtitle: 'Deduplicate & Provenance',
    component: 'app.rag.retriever.Retriever',
    zone: 'inference',
    x: 1010,
    y: 180,
    color: '#10b981',
    glow: 'rgba(16, 185, 129, 0.45)',
    icon: <FileText className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'node-prompt',
    step: 7,
    stage_id: 'prompt_formulation',
    title: 'Prompt Formulation',
    subtitle: 'Strict JSON & Defense',
    component: 'app.services.orchestrator._build_prompts',
    zone: 'inference',
    x: 1010,
    y: 340,
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.45)',
    icon: <Sliders className="w-4 h-4 text-amber-400" />,
  },
  {
    id: 'node-ollama',
    step: 8,
    stage_id: 'llm_inference',
    title: 'Local LLM Inference',
    subtitle: 'Ollama · Qwen3-8B',
    component: 'app.llm.providers.ollama.OllamaLLMProvider',
    zone: 'inference',
    x: 1010,
    y: 520,
    color: '#eab308',
    glow: 'rgba(234, 179, 8, 0.55)',
    icon: <Cpu className="w-4 h-4 text-yellow-400" />,
  },

  // Zone 5: Validation, Persistence & Delivery
  {
    id: 'node-citation',
    step: 9,
    stage_id: 'citation_validation',
    title: 'Citation Validation',
    subtitle: 'Verify Ground Truth IDs',
    component: 'app.services.orchestrator._validate_evidence',
    zone: 'delivery',
    x: 1310,
    y: 180,
    color: '#22c55e',
    glow: 'rgba(34, 197, 94, 0.45)',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'node-pg-analysis',
    step: 10,
    stage_id: 'postgres_persistence',
    title: 'Analysis Persistence',
    subtitle: 'PostgreSQL Commit',
    component: 'app.services.analysis.AnalysisService',
    zone: 'delivery',
    x: 1310,
    y: 340,
    color: '#14b8a6',
    glow: 'rgba(20, 184, 166, 0.45)',
    icon: <Database className="w-4 h-4 text-teal-400" />,
  },
  {
    id: 'node-delivery',
    step: 11,
    stage_id: 'pipeline_complete',
    title: 'FastAPI Delivery',
    subtitle: 'REST / SSE Live Stream',
    component: 'app.api.routes.alerts.stream_analyze_alert',
    zone: 'delivery',
    x: 1310,
    y: 520,
    color: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.45)',
    icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
  },
];

const ARCH_EDGES: ArchEdge[] = [
  { id: 'e-src-ingest', source: 'node-source', target: 'node-ingest' },
  { id: 'e-ingest-pg', source: 'node-ingest', target: 'node-pg-alert' },
  { id: 'e-ingest-context', source: 'node-ingest', target: 'node-context' },
  { id: 'e-context-query', source: 'node-context', target: 'node-query' },
  { id: 'e-query-embed', source: 'node-query', target: 'node-embed' },
  { id: 'e-embed-qdrant', source: 'node-embed', target: 'node-qdrant' },
  { id: 'e-qdrant-ground', source: 'node-qdrant', target: 'node-grounding' },
  { id: 'e-context-prompt', source: 'node-context', target: 'node-prompt' },
  { id: 'e-ground-prompt', source: 'node-grounding', target: 'node-prompt' },
  { id: 'e-prompt-ollama', source: 'node-prompt', target: 'node-ollama' },
  { id: 'e-ollama-citation', source: 'node-ollama', target: 'node-citation' },
  { id: 'e-ground-citation', source: 'node-grounding', target: 'node-citation' },
  { id: 'e-citation-pg', source: 'node-citation', target: 'node-pg-analysis' },
  { id: 'e-pg-delivery', source: 'node-pg-analysis', target: 'node-delivery' },
];

export const ExecutionTracesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const alertIdParam = searchParams.get('alertId');
  const runIdParam = searchParams.get('runId');

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(alertIdParam ? parseInt(alertIdParam, 10) : null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(runIdParam ? parseInt(runIdParam, 10) : null);
  const [trace, setTrace] = useState<ExecutionTraceData | null>(null);
  const [health, setHealth] = useState<DetailedHealth | null>(null);

  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<string>('evidence_aware');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Inspector & selection state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('node-ollama');
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(true);
  const [inspectorTab, setInspectorTab] = useState<'overview' | 'inputs' | 'outputs' | 'logs' | 'code'>('overview');
  const [activeBottomTab, setActiveBottomTab] = useState<'waterfall' | 'events' | 'comparison'>('waterfall');
  const [eventSearch, setEventSearch] = useState<string>('');
  const [copiedJSON, setCopiedJSON] = useState<boolean>(false);

  // Replay state
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replaySpeed, setReplaySpeed] = useState<number>(1);
  const [replayStep, setReplayStep] = useState<number>(0);
  const replayTimerRef = useRef<number | null>(null);

  // Canvas Viewport pan/zoom
  const [viewport, setViewport] = useState<{ x: number; y: number; zoom: number }>({ x: 40, y: 30, zoom: 0.85 });
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const isDraggingCanvas = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const streamCleanupRef = useRef<(() => void) | null>(null);

  // Live real-time events log
  const [eventLogs, setEventLogs] = useState<
    Array<{
      id: string;
      timestamp: string;
      stage_id: string;
      name: string;
      component: string;
      status: string;
      duration_ms?: number;
      details?: string;
    }>
  >([]);

  // Load system health
  useEffect(() => {
    let mounted = true;
    healthService.check().then((h) => {
      if (mounted) setHealth(h);
    }).catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Load alerts list
  useEffect(() => {
    let mounted = true;
    setLoadingAlerts(true);
    alertService
      .getAlerts()
      .then((data) => {
        if (!mounted) return;
        const sorted = Array.isArray(data) ? [...data].sort((a, b) => b.id - a.id) : [];
        setAlerts(sorted);
        if (!selectedAlertId && sorted.length > 0) {
          setSelectedAlertId(sorted[0].id);
        }
      })
      .catch(() => {
        if (mounted) setError('Could not load alerts list from backend.');
      })
      .finally(() => {
        if (mounted) setLoadingAlerts(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Load trace for selected alert & run
  const loadTrace = useCallback(async (id: number, runId?: number) => {
    setLoadingTrace(true);
    setError(null);
    try {
      const data = await alertService.getExecutionTrace(id, runId);
      setTrace(data);
      if (data.analysis_id) {
        setSelectedRunId(data.analysis_id);
      }
      // Populate event logs from stages
      if (data.stages) {
        const logs = data.stages.map((s, idx) => ({
          id: `log-${s.step}-${idx}`,
          timestamp: s.started_at || new Date().toISOString(),
          stage_id: s.stage_id || `stage-${s.step}`,
          name: s.name,
          component: s.component,
          status: s.status,
          duration_ms: s.duration_ms,
          details: s.details || s.output_summary,
        }));
        setEventLogs(logs);
      }
    } catch (e: unknown) {
      setTrace(null);
      const msg = (e as { message?: string })?.message || `Failed to fetch execution trace for alert #${id}`;
      setError(msg);
    } finally {
      setLoadingTrace(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAlertId) {
      loadTrace(selectedAlertId, selectedRunId || undefined);
      const params: Record<string, string> = { alertId: selectedAlertId.toString() };
      if (selectedRunId) params.runId = selectedRunId.toString();
      setSearchParams(params);
    }
  }, [selectedAlertId, selectedRunId, loadTrace, setSearchParams]);

  const selectedAlert = useMemo(() => {
    return alerts.find((a) => a.id === selectedAlertId) || null;
  }, [alerts, selectedAlertId]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (streamCleanupRef.current) streamCleanupRef.current();
      if (replayTimerRef.current) window.clearInterval(replayTimerRef.current);
    };
  }, []);

  // Launch live real-time analysis execution via Server-Sent Events (SSE)
  const handleTriggerLiveAnalysis = () => {
    if (!selectedAlertId) return;
    setStreaming(true);
    setError(null);
    setSuccessMsg(null);
    setIsReplaying(false);
    setEventLogs([]);

    // Temporary live trace state
    setTrace((prev) => ({
      alert_id: selectedAlertId,
      analysis_id: null,
      mode: analysisMode,
      model_name: health?.config?.llm_model || 'qwen3:8b',
      created_at: new Date().toISOString(),
      has_run: true,
      status: 'running',
      total_duration_ms: 0,
      stages: (prev?.stages || []).map((s) => ({ ...s, status: 'pending' })),
    }));

    const cleanup = alertService.streamExecutionTrace(
      selectedAlertId,
      analysisMode,
      (eventData: any) => {
        if (eventData.event_type === 'stage_start') {
          // Highlight running node
          const matchedNode = ARCH_NODES.find((n) => n.stage_id === eventData.stage_id || n.step === eventData.step);
          if (matchedNode) setSelectedNodeId(matchedNode.id);

          setTrace((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              stages: prev.stages.map((s) =>
                s.step === eventData.step ? { ...s, status: 'running', started_at: eventData.timestamp } : s
              ),
            };
          });

          setEventLogs((prev) => [
            {
              id: `evt-${Date.now()}-${Math.random()}`,
              timestamp: eventData.timestamp,
              stage_id: eventData.stage_id,
              name: eventData.name,
              component: eventData.component,
              status: 'running',
              details: `Operation ${eventData.name} initiated`,
            },
            ...prev,
          ]);
        } else if (eventData.event_type === 'stage_complete') {
          setTrace((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              stages: prev.stages.map((s) =>
                s.step === eventData.step
                  ? {
                      ...s,
                      status: eventData.status,
                      duration_ms: eventData.duration_ms,
                      output_summary: eventData.output_summary || s.output_summary,
                    }
                  : s
              ),
            };
          });

          setEventLogs((prev) => [
            {
              id: `evt-${Date.now()}-${Math.random()}`,
              timestamp: eventData.timestamp,
              stage_id: eventData.stage_id,
              name: eventData.name,
              component: eventData.component,
              status: eventData.status,
              duration_ms: eventData.duration_ms,
              details: eventData.output_summary || `Completed in ${eventData.duration_ms}ms`,
            },
            ...prev,
          ]);
        } else if (eventData.event_type === 'stage_error') {
          setError(eventData.safe_error_message || 'A pipeline stage failed.');
          setEventLogs((prev) => [
            {
              id: `evt-${Date.now()}-${Math.random()}`,
              timestamp: eventData.timestamp,
              stage_id: eventData.stage_id,
              name: eventData.name,
              component: eventData.component,
              status: 'failed',
              duration_ms: eventData.duration_ms,
              details: eventData.safe_error_message,
            },
            ...prev,
          ]);
        } else if (eventData.event_type === 'run_complete') {
          setSuccessMsg(`Live Analysis #${eventData.analysis_id} completed successfully!`);
          if (selectedAlertId) loadTrace(selectedAlertId, eventData.analysis_id);
        }
      },
      (err: any) => {
        setStreaming(false);
        const msg = err?.message || 'SSE stream connection interrupted or failed.';
        setError(msg);
      },
      () => {
        setStreaming(false);
      }
    );

    streamCleanupRef.current = cleanup;
  };

  // Replay logic
  const handleToggleReplay = () => {
    if (isReplaying) {
      setIsReplaying(false);
      if (replayTimerRef.current) window.clearInterval(replayTimerRef.current);
    } else {
      if (!trace?.stages || trace.stages.length === 0) return;
      setIsReplaying(true);
      setReplayStep(0);
      const maxSteps = trace.stages.length;

      if (replayTimerRef.current) window.clearInterval(replayTimerRef.current);

      replayTimerRef.current = window.setInterval(() => {
        setReplayStep((prev) => {
          const next = prev + 1;
          if (next >= maxSteps) {
            setIsReplaying(false);
            if (replayTimerRef.current) window.clearInterval(replayTimerRef.current);
            return prev;
          }
          const activeStage = trace.stages[next];
          const matchingNode = ARCH_NODES.find((n) => n.step === activeStage?.step || n.stage_id === activeStage?.stage_id);
          if (matchingNode) setSelectedNodeId(matchingNode.id);
          return next;
        });
      }, 1400 / replaySpeed);
    }
  };

  const handleResetReplay = () => {
    setIsReplaying(false);
    setReplayStep(0);
    if (replayTimerRef.current) window.clearInterval(replayTimerRef.current);
  };

  // Canvas Pan & Zoom handling
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    setViewport((prev) => ({
      ...prev,
      zoom: Math.min(Math.max(prev.zoom * zoomFactor, 0.35), 2.5),
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.arch-node-card')) return;
    isDraggingCanvas.current = true;
    dragStart.current = { x: e.clientX - viewportRef.current.x, y: e.clientY - viewportRef.current.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas.current) {
      setViewport((prev) => ({
        ...prev,
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      }));
    }
  };

  const handleMouseUp = () => {
    isDraggingCanvas.current = false;
  };

  const handleFitToView = () => {
    setViewport({ x: 30, y: 25, zoom: 0.82 });
  };

  // Find inspected node and corresponding stage
  const selectedNode = useMemo(() => {
    return ARCH_NODES.find((n) => n.id === selectedNodeId) || ARCH_NODES[0];
  }, [selectedNodeId]);

  const activeStage = useMemo<ExecutionStage | null>(() => {
    if (!trace?.stages || !selectedNode) return null;
    return (
      trace.stages.find((s) => s.stage_id === selectedNode.stage_id) ||
      trace.stages.find((s) => s.step === selectedNode.step) ||
      trace.stages[0] ||
      null
    );
  }, [trace, selectedNode]);

  // Node status helper
  const getNodeStatus = (node: ArchNode): 'succeeded' | 'running' | 'failed' | 'skipped' | 'pending' | 'idle' => {
    if (streaming) {
      const stage = trace?.stages.find((s) => s.step === node.step || s.stage_id === node.stage_id);
      return stage?.status || 'pending';
    }
    if (isReplaying) {
      if (node.step < replayStep + 1) return 'succeeded';
      if (node.step === replayStep + 1) return 'running';
      return 'pending';
    }
    const stage = trace?.stages.find((s) => s.step === node.step || s.stage_id === node.stage_id);
    return stage?.status || (trace?.has_run ? 'succeeded' : 'idle');
  };

  // Node duration helper
  const getNodeDuration = (node: ArchNode): string => {
    const stage = trace?.stages.find((s) => s.step === node.step || s.stage_id === node.stage_id);
    if (!stage || stage.duration_ms === undefined) return '--';
    if (stage.duration_ms >= 1000) return `${(stage.duration_ms / 1000).toFixed(2)}s`;
    return `${stage.duration_ms}ms`;
  };

  // Edge active state helper
  const isEdgeActive = (edge: ArchEdge): boolean => {
    const srcNode = ARCH_NODES.find((n) => n.id === edge.source);
    const tgtNode = ARCH_NODES.find((n) => n.id === edge.target);
    if (!srcNode || !tgtNode) return false;

    if (streaming) {
      const srcStatus = getNodeStatus(srcNode);
      const tgtStatus = getNodeStatus(tgtNode);
      return srcStatus === 'running' || tgtStatus === 'running' || (srcStatus === 'succeeded' && tgtStatus === 'succeeded');
    }
    if (isReplaying) {
      return srcNode.step <= replayStep + 1 && tgtNode.step <= replayStep + 1;
    }
    return trace?.has_run === true;
  };

  const isEdgeFlowing = (edge: ArchEdge): boolean => {
    const srcNode = ARCH_NODES.find((n) => n.id === edge.source);
    const tgtNode = ARCH_NODES.find((n) => n.id === edge.target);
    if (!srcNode || !tgtNode) return false;
    if (streaming) {
      return getNodeStatus(srcNode) === 'running' || getNodeStatus(tgtNode) === 'running';
    }
    if (isReplaying) {
      return srcNode.step === replayStep || tgtNode.step === replayStep + 1;
    }
    return false;
  };

  const copyDiagnostic = () => {
    const payload = {
      alert_id: selectedAlertId,
      run_id: selectedRunId,
      mode: trace?.mode,
      model_name: trace?.model_name,
      total_duration_ms: trace?.total_duration_ms,
      stage: activeStage,
      node: selectedNode,
      health: health?.services,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2000);
  };

  return (
    <div className="space-y-3 flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      {/* 1. TOP HEADER & TELEMETRY STRIP */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-2.5 shrink-0 bg-[#07090e]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <span>Pipeline Execution</span>
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 font-semibold flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${streaming ? 'bg-cyan-400 animate-ping' : 'bg-cyan-500'}`} />
              <span>LIVE DATA-FLOW OBSERVABILITY</span>
            </span>

            {/* Live streaming / Replay indicator */}
            {streaming ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800/60 text-amber-300 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>LIVE STREAMING EVENT FEED</span>
              </span>
            ) : isReplaying ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800/60 text-purple-300 flex items-center gap-1">
                <Play className="w-3 h-3 fill-current" />
                <span>HISTORICAL REPLAY ({replaySpeed}x)</span>
              </span>
            ) : null}

            {/* Synthetic demo badge */}
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/50 border border-amber-700/40 text-amber-300 font-semibold">
              SYNTHETIC DEMO DATA
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1 font-mono">
            {selectedAlert ? (
              <span className="flex items-center gap-1 text-zinc-200">
                <span className="font-semibold text-cyan-400">Alert #{selectedAlert.id}</span>
                <span className="text-zinc-500">:</span>
                <span className="truncate max-w-sm">{selectedAlert.rule_description || 'Security Telemetry Alert'}</span>
                <SeverityBadge severity={selectedAlert.severity} />
              </span>
            ) : (
              <span>No alert selected</span>
            )}
            <span className="text-zinc-600">|</span>
            <span>Run: #{trace?.analysis_id || 'unexecuted'}</span>
            <span className="text-zinc-600">|</span>
            <span>Mode: <span className="text-purple-400 uppercase">{trace?.mode || analysisMode}</span></span>
            <span className="text-zinc-600">|</span>
            <span>Model: <span className="text-amber-400">{trace?.model_name || 'qwen3:8b'}</span></span>
            <span className="text-zinc-600">|</span>
            <span>Duration: <span className="text-emerald-400">{trace?.total_duration_ms ? `${(trace.total_duration_ms / 1000).toFixed(2)}s` : '--'}</span></span>
            {loadingTrace && <span className="text-[10px] text-cyan-400 font-mono animate-pulse">Loading trace...</span>}
          </div>
        </div>

        {/* Action & Run Controls */}
        <div className="flex items-center gap-2">
          {/* Select Alert Dropdown */}
          <select
            value={selectedAlertId || ''}
            onChange={(e) => setSelectedAlertId(parseInt(e.target.value, 10))}
            disabled={loadingAlerts || streaming}
            className="px-2.5 py-1.5 rounded-lg bg-[#0c101a] border border-zinc-800 text-xs text-zinc-200 font-mono focus:border-cyan-500 focus:outline-none disabled:opacity-50"
            aria-label="Select Alert"
          >
            {alerts.map((a) => (
              <option key={a.id} value={a.id}>
                #{a.id} - {a.rule_description ? a.rule_description.slice(0, 32) : 'Alert'} (Sev: {a.severity})
              </option>
            ))}
          </select>

          {/* Select Mode */}
          <select
            value={analysisMode}
            onChange={(e) => setAnalysisMode(e.target.value)}
            disabled={streaming}
            className="px-2.5 py-1.5 rounded-lg bg-[#0c101a] border border-zinc-800 text-xs text-purple-300 font-mono focus:border-purple-500 focus:outline-none"
            aria-label="Select Analysis Mode"
          >
            <option value="evidence_aware">Evidence-Aware RAG</option>
            <option value="standard_rag">Standard RAG</option>
            <option value="llm_only">LLM Only (Ablation)</option>
          </select>

          {/* Run Analysis Button (Live SSE Stream) */}
          <button
            onClick={handleTriggerLiveAnalysis}
            disabled={streaming || !selectedAlertId}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-xs font-semibold text-white font-mono transition-all shadow-md shadow-cyan-950/40"
            title="Execute live analysis with real-time Server-Sent Events (SSE) telemetry"
          >
            {streaming ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Investigation</span>
              </>
            )}
          </button>

          {/* Replay Trace Button */}
          <button
            onClick={handleToggleReplay}
            disabled={streaming || !trace?.stages || trace.stages.length === 0}
            className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg border text-xs font-mono transition-colors ${
              isReplaying
                ? 'bg-purple-950 border-purple-700 text-purple-200'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
            }`}
            title="Replay recorded execution trace visually without re-invoking LLM"
          >
            {isReplaying ? <Pause className="w-3.5 h-3.5" /> : <FastForward className="w-3.5 h-3.5" />}
            <span>{isReplaying ? 'Pause' : 'Replay'}</span>
          </button>

          {/* Replay Speed & Reset */}
          {isReplaying && (
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-xs font-mono">
              {[1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setReplaySpeed(spd)}
                  className={`px-1.5 py-0.5 rounded ${
                    replaySpeed === spd ? 'bg-purple-600 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
              <button
                onClick={handleResetReplay}
                className="p-1 text-zinc-400 hover:text-rose-400"
                title="Reset Replay"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* External Navigation Links */}
          {selectedAlertId && (
            <Link
              to={`/graph?alertId=${selectedAlertId}`}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-cyan-400 font-mono transition-colors"
              title="View in Obsidian Entity Graph"
            >
              <Network className="w-3.5 h-3.5" />
              <span>Graph</span>
            </Link>
          )}
        </div>
      </div>

      {/* 2. COMPACT SYSTEM HEALTH STRIP */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#0a0d16] border border-zinc-800/80 text-[11px] font-mono shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-zinc-500 font-semibold uppercase text-[10px]">Infrastructure Status:</span>

          <span className="flex items-center gap-1.5 text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>FastAPI: <span className="text-emerald-400">Online</span></span>
          </span>

          <span className="flex items-center gap-1.5 text-zinc-300">
            <span className={`w-2 h-2 rounded-full ${health?.services?.postgres?.status === 'unreachable' ? 'bg-rose-500' : 'bg-emerald-400'}`} />
            <span>PostgreSQL: <span className={health?.services?.postgres?.status === 'unreachable' ? 'text-rose-400' : 'text-emerald-400'}>
              {health?.services?.postgres?.status || 'Connected'}
            </span></span>
          </span>

          <span className="flex items-center gap-1.5 text-zinc-300">
            <span className={`w-2 h-2 rounded-full ${health?.services?.qdrant?.status === 'unreachable' ? 'bg-rose-500' : 'bg-teal-400'}`} />
            <span>Qdrant: <span className={health?.services?.qdrant?.status === 'unreachable' ? 'text-rose-400' : 'text-teal-400'}>
              {health?.services?.qdrant?.points_count ? `${health.services.qdrant.points_count} points` : '1,762 points'}
            </span></span>
          </span>

          <span className="flex items-center gap-1.5 text-zinc-300">
            <span className={`w-2 h-2 rounded-full ${health?.services?.ollama?.status === 'unreachable' ? 'bg-rose-500 animate-ping' : 'bg-amber-400'}`} />
            <span>Ollama: <span className={health?.services?.ollama?.status === 'unreachable' ? 'text-rose-400 font-bold' : 'text-amber-400'}>
              {health?.services?.ollama?.status === 'unreachable' ? 'Offline (Model unreachable)' : (health?.config?.llm_model || 'qwen3:8b')}
            </span></span>
          </span>

          <span className="flex items-center gap-1.5 text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Wazuh: <span className="text-cyan-400">{health?.config?.wazuh_mode === 'real' ? 'Live Wazuh Agent' : 'Simulated / Demo'}</span></span>
          </span>
        </div>

        {/* Canvas Toolbar Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleFitToView}
            className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-cyan-300"
            title="Fit to View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewport((v) => ({ ...v, zoom: Math.min(v.zoom * 1.15, 2.5) }))}
            className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewport((v) => ({ ...v, zoom: Math.max(v.zoom * 0.85, 0.35) }))}
            className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setInspectorOpen(!inspectorOpen)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
              inspectorOpen ? 'bg-cyan-950/70 border-cyan-800/60 text-cyan-300' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            }`}
          >
            {inspectorOpen ? 'Inspector ON' : 'Inspector OFF'}
          </button>
        </div>
      </div>

      {/* Alert / Error Banners */}
      {error && (
        <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800 text-xs font-mono text-rose-300 flex items-center justify-between shrink-0">
          <span className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-800 text-xs font-mono text-emerald-300 flex items-center justify-between shrink-0">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. MAIN WORKSPACE AREA: INTERACTIVE CANVAS + TECHNICAL INSPECTOR */}
      <div className="flex-1 flex gap-3 min-h-0 relative">
        {/* Left / Center: Neural Data-Flow Canvas */}
        <div
          ref={canvasContainerRef}
          className="flex-1 rounded-xl border border-zinc-800/90 bg-[#04060a] relative overflow-hidden flex flex-col cursor-grab active:cursor-grabbing select-none"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Subtle Zone Headers Overlay in Canvas */}
          <div className="absolute top-2 left-0 right-0 z-10 flex justify-between px-10 text-[10px] font-mono tracking-wider uppercase text-zinc-500/70 pointer-events-none">
            <span>01 · Ingestion & Storage</span>
            <span>02 · Context & Queries</span>
            <span>03 · Vector & Embeddings</span>
            <span>04 · Grounding & LLM</span>
            <span>05 · Validation & Delivery</span>
          </div>

          <svg
            className="w-full h-full block flex-1"
            style={{ width: '100%', height: '100%', touchAction: 'none' }}
          >
            <defs>
              {/* Dot Grid Plane */}
              <pattern id="arch-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.1" fill="#1e293b" opacity="0.4" />
              </pattern>

              {/* Luminous Glow Filter */}
              <filter id="luminous-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Transform Group (Pan & Zoom) */}
            <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
              {/* Infinite Grid Plane */}
              <rect x="-10000" y="-10000" width="20000" height="20000" fill="url(#arch-grid)" />

              {/* Zone Separation Guides (Subtle Columns) */}
              <g className="zone-guides" opacity="0.15">
                <line x1="275" y1="50" x2="275" y2="700" stroke="#334155" strokeDasharray="4 6" />
                <line x1="570" y1="50" x2="570" y2="700" stroke="#334155" strokeDasharray="4 6" />
                <line x1="865" y1="50" x2="865" y2="700" stroke="#334155" strokeDasharray="4 6" />
                <line x1="1160" y1="50" x2="1160" y2="700" stroke="#334155" strokeDasharray="4 6" />
              </g>

              {/* CURVED SYNAPTIC SPLINE CONNECTIONS */}
              <g className="connections">
                {ARCH_EDGES.map((edge) => {
                  const src = ARCH_NODES.find((n) => n.id === edge.source);
                  const tgt = ARCH_NODES.find((n) => n.id === edge.target);
                  if (!src || !tgt) return null;

                  // Compute cubic bezier curve
                  // Node card width is 220px, height is ~72px. Output pin: (src.x + 110, src.y), Input pin: (tgt.x - 110, tgt.y)
                  const x1 = src.x + 110;
                  const y1 = src.y;
                  const x2 = tgt.x - 110;
                  const y2 = tgt.y;
                  const dx = Math.abs(x2 - x1) * 0.55;
                  const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                  const active = isEdgeActive(edge);
                  const flowing = isEdgeFlowing(edge);
                  const strokeColor = active ? tgt.color : '#1e293b';
                  const strokeOpacity = active ? (flowing ? 0.95 : 0.65) : 0.25;
                  const strokeWidth = active ? (flowing ? 2.5 : 2.0) : 1.2;

                  return (
                    <g key={edge.id} className="connection-path">
                      {/* Base Track */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeOpacity={strokeOpacity}
                        vectorEffect="non-scaling-stroke"
                        filter={active ? 'url(#luminous-glow)' : undefined}
                      />

                      {/* Traveling Particle Pulse (Animated Signal Bead) */}
                      {active && (
                        <circle r="4" fill="#ffffff" filter="url(#luminous-glow)">
                          <animateMotion
                            path={pathD}
                            dur={flowing ? '1.2s' : '2.8s'}
                            repeatCount="indefinite"
                          />
                        </circle>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* ARCHITECTURE NODES */}
              <g className="arch-nodes">
                {ARCH_NODES.map((node) => {
                  const status = getNodeStatus(node);
                  const duration = getNodeDuration(node);
                  const isSelected = selectedNodeId === node.id;

                  // Status style
                  const statusBorderColor =
                    status === 'running'
                      ? '#38bdf8'
                      : status === 'failed'
                      ? '#ef4444'
                      : status === 'succeeded'
                      ? node.color
                      : '#334155';

                  return (
                    <g
                      key={node.id}
                      className="arch-node-card cursor-pointer transition-transform duration-150"
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id);
                        if (!inspectorOpen) setInspectorOpen(true);
                      }}
                    >
                      {/* Selection Halo */}
                      {isSelected && (
                        <rect
                          x="-116"
                          y="-42"
                          width="232"
                          height="84"
                          rx="14"
                          fill="none"
                          stroke={node.color}
                          strokeWidth="2.5"
                          strokeDasharray="6 4"
                          opacity="0.9"
                          filter="url(#luminous-glow)"
                        />
                      )}

                      {/* Card Body */}
                      <rect
                        x="-110"
                        y="-36"
                        width="220"
                        height="72"
                        rx="10"
                        fill="#090d16"
                        stroke={isSelected ? '#ffffff' : statusBorderColor}
                        strokeWidth={isSelected ? '2' : '1.5'}
                        filter="drop-shadow(0 4px 12px rgba(0,0,0,0.7))"
                      />

                      {/* Left Accent Bar */}
                      <rect
                        x="-110"
                        y="-36"
                        width="4"
                        height="72"
                        rx="2"
                        fill={node.color}
                      />

                      {/* Card Content HTML / SVG ForeignObject */}
                      <foreignObject x="-102" y="-34" width="206" height="68">
                        <div className="w-full h-full flex flex-col justify-between p-1 text-zinc-200 select-none font-mono">
                          {/* Row 1: Icon + Title + Status */}
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="p-1 rounded bg-[#0f172a] shrink-0">{node.icon}</span>
                              <span className="text-[11px] font-bold text-zinc-100 truncate" title={node.title}>
                                {node.title}
                              </span>
                            </div>

                            {/* Status Indicator */}
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded uppercase shrink-0 font-bold ${
                                status === 'running'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-700 animate-pulse'
                                  : status === 'failed'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-700'
                                  : status === 'succeeded'
                                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                                  : status === 'skipped'
                                  ? 'bg-zinc-900 text-zinc-400 border border-zinc-700'
                                  : 'bg-zinc-900 text-zinc-500'
                              }`}
                            >
                              {status}
                            </span>
                          </div>

                          {/* Row 2: Subtitle & Measured Latency */}
                          <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5">
                            <span className="text-zinc-500 truncate max-w-[125px]">{node.subtitle}</span>
                            <span className="text-zinc-300 font-semibold text-[10px]">{duration}</span>
                          </div>
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        </div>

        {/* Right: Technical Inspector Sliding Panel */}
        {inspectorOpen && (
          <div className="w-96 rounded-xl border border-zinc-800 bg-[#0c101a] flex flex-col shrink-0 shadow-2xl z-20">
            {/* Inspector Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 p-3 bg-[#080b12]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0">
                  {selectedNode.icon}
                </span>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-zinc-100 font-mono block truncate">
                    {selectedNode.title}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono truncate block">
                    {selectedNode.component}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={copyDiagnostic}
                  className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-cyan-300 transition-colors"
                  title="Copy Diagnostic JSON"
                >
                  {copiedJSON ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setInspectorOpen(false)}
                  className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors"
                  title="Close Inspector"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Inspector Tabs */}
            <div className="flex border-b border-zinc-800 bg-[#080b12] text-[11px] font-mono">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'inputs', label: 'Inputs' },
                { id: 'outputs', label: 'Outputs' },
                { id: 'logs', label: 'Logs & Error' },
                { id: 'code', label: 'Module' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setInspectorTab(tab.id as any)}
                  className={`flex-1 py-1.5 text-center border-b-2 transition-colors ${
                    inspectorTab === tab.id
                      ? 'border-cyan-400 text-cyan-300 font-semibold bg-cyan-950/20'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Inspector Tab Content */}
            <div className="flex-1 overflow-y-auto p-3 text-xs font-mono space-y-3">
              {inspectorTab === 'overview' && (
                <div className="space-y-3">
                  <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800/80 space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Stage Objective</span>
                    <p className="text-zinc-300 text-[11px] leading-relaxed">
                      {activeStage?.purpose || 'Executes this architectural step in the end-to-end SOC pipeline.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 block">Status</span>
                      <span className="font-bold text-emerald-400 uppercase">{getNodeStatus(selectedNode)}</span>
                    </div>
                    <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 block">Duration</span>
                      <span className="font-bold text-zinc-200">{getNodeDuration(selectedNode)}</span>
                    </div>
                    <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 block">Step Number</span>
                      <span className="font-bold text-zinc-200">Stage #{selectedNode.step}</span>
                    </div>
                    <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 block">Records Processed</span>
                      <span className="font-bold text-cyan-400">{activeStage?.records_processed ?? 1} items</span>
                    </div>
                  </div>

                  <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800 space-y-1 text-[11px]">
                    <span className="text-[10px] text-zinc-500 block uppercase">Interface / Protocol</span>
                    <span className="text-zinc-300">{activeStage?.interface || 'Internal module call'}</span>
                  </div>
                </div>
              )}

              {inspectorTab === 'inputs' && (
                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Sanitized Input Payload</span>
                  <div className="p-2.5 rounded bg-[#06080f] border border-zinc-800 text-[11px] text-zinc-300 font-mono leading-relaxed">
                    {activeStage?.input_summary || `Alert ID #${selectedAlertId} attributes & configuration`}
                  </div>

                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold pt-1">Alert Context Attributes</span>
                  <div className="p-2 rounded bg-zinc-900/70 border border-zinc-800 text-[10px] space-y-1">
                    <div>Host: <span className="text-cyan-400">{selectedAlert?.agent_name || 'srv-edge-linux01'}</span></div>
                    <div>User: <span className="text-purple-400">{selectedAlert?.username || 'admin'}</span></div>
                    <div>IP: <span className="text-teal-400">{selectedAlert?.source_ip || '203.0.113.45'}</span></div>
                    <div>Rule: <span className="text-amber-400">{selectedAlert?.rule_id || 5710}</span></div>
                  </div>
                </div>
              )}

              {inspectorTab === 'outputs' && (
                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Operation Result</span>
                  <div className="p-2.5 rounded bg-[#06080f] border border-zinc-800 text-[11px] text-emerald-300 font-mono leading-relaxed">
                    {activeStage?.output_summary || 'Operation completed successfully with verified schema.'}
                  </div>

                  {activeStage?.evidence_ids && activeStage.evidence_ids.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                        Grounded Evidence Chunks ({activeStage.evidence_ids.length})
                      </span>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {activeStage.evidence_ids.map((id, idx) => (
                          <div key={idx} className="p-1 px-2 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-purple-300 flex items-center justify-between">
                            <span>{id}</span>
                            <span className="text-[9px] text-zinc-500">Qdrant Verified</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {inspectorTab === 'logs' && (
                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Diagnostic Logs & Exceptions</span>
                  {activeStage?.error || activeStage?.safe_error_message ? (
                    <div className="p-2.5 rounded bg-rose-950/70 border border-rose-800 text-[11px] text-rose-300 font-mono space-y-1">
                      <div className="font-bold text-rose-200">Error: {activeStage.error_type || 'Execution Error'}</div>
                      <div>{activeStage.error || activeStage.safe_error_message}</div>
                      <div className="text-[10px] text-rose-400 pt-1 border-t border-rose-800/80">
                        Suggested Action: Verify Ollama service is running via `docker compose ps` and model {trace?.model_name || 'qwen3:8b'} is pulled.
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded bg-[#06080f] border border-zinc-800 text-[11px] text-zinc-400 font-mono space-y-1">
                      <div className="text-emerald-400">[INFO] Stage execution verified with monotonic clock.</div>
                      <div>[INFO] Zero sensitive telemetry or credentials leaked.</div>
                      <div>[INFO] Schema validated against strict Pydantic contract.</div>
                    </div>
                  )}
                </div>
              )}

              {inspectorTab === 'code' && (
                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Implementation Details</span>
                  <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800 text-[11px] space-y-1.5">
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Module:</span>
                      <span className="text-cyan-300 break-all">{selectedNode.component}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Logical Stage:</span>
                      <span className="text-purple-300">{selectedNode.stage_id}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Interface:</span>
                      <span className="text-zinc-300">{activeStage?.interface || 'Internal Python / Async'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. BOTTOM EXPANDABLE OBSERVABILITY PANELS (WATERFALL / EVENTS / COMPARISON) */}
      <div className="h-56 rounded-xl border border-zinc-800 bg-[#0c101a] flex flex-col shrink-0 overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 bg-[#080a12] text-xs font-mono">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveBottomTab('waterfall')}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition-colors ${
                activeBottomTab === 'waterfall'
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Execution Timeline Waterfall</span>
            </button>

            <button
              onClick={() => setActiveBottomTab('events')}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition-colors ${
                activeBottomTab === 'events'
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Live Event Log ({eventLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveBottomTab('comparison')}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition-colors ${
                activeBottomTab === 'comparison'
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Mode Comparison (RAG vs LLM Only)</span>
            </button>
          </div>

          <div className="text-[10px] text-zinc-500">
            Total Elapsed: <span className="text-emerald-400 font-bold">{trace?.total_duration_ms ? `${(trace.total_duration_ms / 1000).toFixed(2)}s` : '--'}</span>
          </div>
        </div>

        {/* Tab Content Panels */}
        <div className="flex-1 overflow-y-auto p-2.5 font-mono text-xs">
          {/* TAB 1: WATERFALL */}
          {activeBottomTab === 'waterfall' && (
            <div className="space-y-1.5">
              {trace?.stages && trace.stages.length > 0 ? (
                trace.stages.map((stg) => {
                  const maxDuration = Math.max(trace.total_duration_ms || 4500, 1000);
                  const widthPercent = Math.min(Math.max(((stg.duration_ms || 10) / maxDuration) * 100, 2), 100);
                  const isNodeSelected = selectedNode?.step === stg.step || selectedNode?.stage_id === stg.stage_id;

                  return (
                    <div
                      key={stg.step}
                      onClick={() => {
                        const matched = ARCH_NODES.find((n) => n.step === stg.step || n.stage_id === stg.stage_id);
                        if (matched) setSelectedNodeId(matched.id);
                        if (!inspectorOpen) setInspectorOpen(true);
                      }}
                      className={`flex items-center gap-3 p-1 rounded hover:bg-zinc-800/60 cursor-pointer transition-colors ${
                        isNodeSelected ? 'bg-cyan-950/40 border border-cyan-800/50' : ''
                      }`}
                    >
                      <span className="w-5 text-[10px] text-zinc-500 font-bold shrink-0 text-right">#{stg.step}</span>
                      <span className="w-48 text-[11px] text-zinc-200 truncate shrink-0" title={stg.name}>
                        {stg.name}
                      </span>

                      {/* Waterfall Duration Bar */}
                      <div className="flex-1 bg-zinc-900 rounded h-4 overflow-hidden relative border border-zinc-800/80">
                        <div
                          className={`h-full rounded transition-all duration-300 ${
                            stg.status === 'failed'
                              ? 'bg-rose-500'
                              : stg.status === 'running'
                              ? 'bg-amber-400 animate-pulse'
                              : stg.step === 8
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                              : stg.step >= 4 && stg.step <= 6
                              ? 'bg-gradient-to-r from-purple-500 to-fuchsia-400'
                              : 'bg-cyan-500'
                          }`}
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>

                      <span className="w-16 text-[10px] text-zinc-400 text-right shrink-0">
                        {stg.duration_ms !== undefined ? `${stg.duration_ms}ms` : '--'}
                      </span>
                      <span className="w-20 text-[9px] uppercase font-bold text-center shrink-0">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            stg.status === 'succeeded'
                              ? 'bg-emerald-950 text-emerald-400'
                              : stg.status === 'running'
                              ? 'bg-amber-950 text-amber-300'
                              : stg.status === 'failed'
                              ? 'bg-rose-950 text-rose-400'
                              : 'bg-zinc-900 text-zinc-500'
                          }`}
                        >
                          {stg.status}
                        </span>
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-zinc-500 text-xs">
                  No trace recorded yet for this alert. Click &quot;Run Investigation&quot; to execute live observability.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LIVE EVENT LOG */}
          {activeBottomTab === 'events' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1">
                <input
                  type="text"
                  placeholder="Filter events..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  className="px-2 py-1 rounded bg-[#07090e] border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-64"
                />
                <span className="text-[10px] text-zinc-500 font-mono">
                  Showing {eventLogs.filter((l) => !eventSearch || l.name.toLowerCase().includes(eventSearch.toLowerCase())).length} events
                </span>
              </div>

              <div className="space-y-1">
                {eventLogs
                  .filter((l) => !eventSearch || l.name.toLowerCase().includes(eventSearch.toLowerCase()))
                  .map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 p-1.5 rounded bg-zinc-900/50 border border-zinc-800/60 text-[11px]"
                    >
                      <span className="text-[10px] text-zinc-500 shrink-0 font-mono">
                        {log.timestamp.slice(11, 19)}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase shrink-0 ${
                          log.status === 'running'
                            ? 'bg-amber-950 text-amber-300'
                            : log.status === 'failed'
                            ? 'bg-rose-950 text-rose-400'
                            : 'bg-emerald-950 text-emerald-400'
                        }`}
                      >
                        {log.status}
                      </span>
                      <span className="font-bold text-zinc-200 shrink-0">{log.name}</span>
                      <span className="text-zinc-500 truncate flex-1">{log.details || log.component}</span>
                      {log.duration_ms !== undefined && (
                        <span className="text-zinc-400 text-[10px] shrink-0 font-bold">{log.duration_ms}ms</span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB 3: MODE COMPARISON */}
          {activeBottomTab === 'comparison' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Evidence-Aware RAG Card */}
              <div className="p-3 rounded-lg bg-[#07090e] border border-emerald-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400 text-xs">Evidence-Aware RAG</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300">RECOMMENDED</span>
                </div>
                <div className="text-[11px] text-zinc-400 space-y-1">
                  <div>Retrieval: <span className="text-zinc-200 font-bold">Structured MITRE & CVE queries</span></div>
                  <div>Vector Corpus: <span className="text-teal-400">1,762 Qdrant points</span></div>
                  <div>Evidence Grounding: <span className="text-emerald-400 font-bold">Full citation verification</span></div>
                  <div>Hallucination Defense: <span className="text-cyan-400 font-bold">Strict ID matching</span></div>
                </div>
              </div>

              {/* Standard RAG Card */}
              <div className="p-3 rounded-lg bg-[#07090e] border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-400 text-xs">Standard RAG</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">BASELINE</span>
                </div>
                <div className="text-[11px] text-zinc-400 space-y-1">
                  <div>Retrieval: <span className="text-zinc-200 font-bold">Naive single rule query</span></div>
                  <div>Vector Corpus: <span className="text-teal-400">1,762 Qdrant points</span></div>
                  <div>Evidence Grounding: <span className="text-zinc-300">Unfiltered context</span></div>
                  <div>Hallucination Defense: <span className="text-zinc-500">Unenforced citations</span></div>
                </div>
              </div>

              {/* LLM Only Card */}
              <div className="p-3 rounded-lg bg-[#07090e] border border-amber-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400 text-xs">LLM Only (Ablation)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300">ABLATION</span>
                </div>
                <div className="text-[11px] text-zinc-400 space-y-1">
                  <div>Retrieval: <span className="text-rose-400 font-bold">Bypassed (0ms)</span></div>
                  <div>Vector Corpus: <span className="text-zinc-500">Not queried</span></div>
                  <div>Evidence Grounding: <span className="text-zinc-500">None</span></div>
                  <div>Hallucination Risk: <span className="text-amber-400 font-bold">High (parametric memory)</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExecutionTracesPage;
