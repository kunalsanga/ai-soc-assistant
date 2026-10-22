import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Layers,
  Clock,
  CheckCircle2,
  AlertOctagon,
  SkipForward,
  ArrowRight,
  Network,
  ChevronDown,
  ChevronUp,
  Play,
  RefreshCw,
  Sliders,
  Database,
  Cpu,
  Search,
  FileText,
  Activity,
  Zap,
  ShieldCheck,
  X,
} from 'lucide-react';
import { alertService } from '../services/api';
import type { Alert, ExecutionTraceData, ExecutionStage } from '../services/api';
import SeverityBadge from '../components/common/SeverityBadge';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

export const ExecutionTracesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const alertIdParam = searchParams.get('alertId');
  const runIdParam = searchParams.get('runId');

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(alertIdParam ? parseInt(alertIdParam, 10) : null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(runIdParam ? parseInt(runIdParam, 10) : null);
  const [trace, setTrace] = useState<ExecutionTraceData | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<string>('evidence_aware');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedStage, setExpandedStage] = useState<number | null>(null);
  const [inspectedStageStep, setInspectedStageStep] = useState<number | null>(null);
  const [filterStageStatus, setFilterStageStatus] = useState<string>('all');

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

  // Launch real analysis execution
  const handleTriggerAnalysis = async () => {
    if (!selectedAlertId) return;
    setAnalyzing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const newAnalysis = await alertService.analyzeAlert(selectedAlertId, analysisMode);
      setSuccessMsg(`Analysis successfully completed (ID: #${newAnalysis.id}, Mode: ${analysisMode.toUpperCase()})`);
      setSelectedRunId(newAnalysis.id ?? null);
      await loadTrace(selectedAlertId, newAnalysis.id);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Pipeline analysis execution failed.';
      setError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const filteredStages = useMemo(() => {
    if (!trace?.stages) return [];
    if (filterStageStatus === 'all') return trace.stages;
    if (filterStageStatus === 'slow') return trace.stages.filter((s) => (s.duration_ms || 0) > 30);
    return trace.stages.filter((s) => s.status === filterStageStatus);
  }, [trace, filterStageStatus]);

  const activeInspectedStage = useMemo<ExecutionStage | null>(() => {
    if (!trace?.stages) return null;
    if (inspectedStageStep !== null) {
      return trace.stages.find((s) => s.step === inspectedStageStep) || null;
    }
    return trace.stages[0] || null;
  }, [trace, inspectedStageStep]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/40 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            <span>SUCCEEDED</span>
          </span>
        );
      case 'skipped':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700/60 text-zinc-400">
            <SkipForward className="w-3 h-3" />
            <span>SKIPPED</span>
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/70 border border-rose-800/40 text-rose-400">
            <AlertOctagon className="w-3 h-3" />
            <span>FAILED</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/70 border border-amber-800/40 text-amber-400">
            <Clock className="w-3 h-3" />
            <span>PENDING</span>
          </span>
        );
    }
  };

  const getStageIcon = (step: number) => {
    switch (step) {
      case 1:
        return <Activity className="w-4 h-4 text-cyan-400" />;
      case 2:
        return <ShieldCheck className="w-4 h-4 text-blue-400" />;
      case 3:
        return <Search className="w-4 h-4 text-indigo-400" />;
      case 4:
        return <Cpu className="w-4 h-4 text-purple-400" />;
      case 5:
        return <Database className="w-4 h-4 text-fuchsia-400" />;
      case 6:
        return <FileText className="w-4 h-4 text-amber-400" />;
      case 7:
        return <Sliders className="w-4 h-4 text-orange-400" />;
      case 8:
        return <Zap className="w-4 h-4 text-emerald-400" />;
      case 9:
        return <CheckCircle2 className="w-4 h-4 text-teal-400" />;
      case 10:
        return <Database className="w-4 h-4 text-cyan-400" />;
      default:
        return <Layers className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              Pipeline Execution Trace
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/40 text-cyan-300">
              ARCHITECTURE & OBSERVABILITY WORKSPACE
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            End-to-end execution path inspecting data flow from Alert Ingestion through Vector Retrieval, Grounding, LLM Inference, and Persistence.
          </p>
        </div>

        {selectedAlertId && (
          <div className="flex items-center gap-2">
            <Link
              to={`/graph?alertId=${selectedAlertId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-cyan-400 font-mono transition-colors"
            >
              <Network className="w-3.5 h-3.5" />
              <span>Explore in Graph</span>
            </Link>
            <Link
              to={`/investigations/${selectedAlertId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800/50 text-xs text-cyan-300 font-mono transition-colors"
            >
              <span>Investigation Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-xs font-mono text-rose-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-xs font-mono text-emerald-300 flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Left Column: Alert & Run Selector */}
        <div className="lg:col-span-1 rounded-xl border border-zinc-800/90 bg-[#0c101a] p-4 space-y-4 flex flex-col h-[760px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <span className="text-xs font-mono uppercase text-zinc-400 font-semibold">Select Alert</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">
              {alerts.length} Available
            </span>
          </div>

          {/* Trigger Pipeline Action */}
          <div className="rounded-lg bg-[#07090e] border border-zinc-800/80 p-3 space-y-2.5">
            <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold block">Execute Pipeline Run</span>
            <div className="grid grid-cols-1 gap-2">
              <select
                value={analysisMode}
                onChange={(e) => setAnalysisMode(e.target.value)}
                className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 font-mono focus:outline-none"
              >
                <option value="evidence_aware">Mode: Evidence-Aware RAG</option>
                <option value="standard_rag">Mode: Standard RAG</option>
                <option value="llm_only">Mode: LLM Only (Ablation)</option>
              </select>

              <button
                onClick={handleTriggerAnalysis}
                disabled={analyzing || !selectedAlertId}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-semibold text-white font-mono transition-colors shadow-lg shadow-cyan-900/30"
              >
                {analyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Analysis</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Alert List */}
          {loadingAlerts ? (
            <LoadingSkeleton type="card" count={4} />
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {alerts.map((al) => {
                const isSelected = al.id === selectedAlertId;
                return (
                  <button
                    key={al.id}
                    onClick={() => {
                      setSelectedAlertId(al.id);
                      setSelectedRunId(null);
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all text-xs font-mono ${
                      isSelected
                        ? 'bg-cyan-950/50 border-cyan-500/60 text-zinc-100 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                        : 'bg-[#07090e] border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] text-cyan-400 font-bold">ALERT #{al.id}</span>
                      <SeverityBadge severity={al.severity} />
                    </div>
                    <div className="text-[11px] text-zinc-200 truncate font-sans font-medium mb-1">
                      {al.rule_description}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>{al.agent_name || 'N/A'}</span>
                      <span>{al.source_ip || al.username || 'System'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 3 Columns: Architecture Diagram, Waterfall & Details */}
        <div className="lg:col-span-3 space-y-4">
          {/* Selected Alert Banner & Run Selector Header */}
          {selectedAlert && (
            <div className="rounded-xl border border-zinc-800 bg-[#0c101a] p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-3">
                <SeverityBadge severity={selectedAlert.severity} />
                <div>
                  <div className="text-zinc-200 font-semibold font-sans text-sm">
                    {selectedAlert.rule_description}
                  </div>
                  <div className="text-zinc-500 text-[11px] mt-0.5">
                    External ID: <span className="text-zinc-300">{selectedAlert.external_alert_id}</span> | Host:{' '}
                    <span className="text-zinc-300">{selectedAlert.agent_name || 'N/A'}</span> | Rule:{' '}
                    <span className="text-zinc-300">{selectedAlert.rule_id}</span>
                  </div>
                </div>
              </div>

              {/* Historical Runs Dropdown for this Alert */}
              {trace?.runs && trace.runs.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-[11px]">Selected Run:</span>
                  <select
                    value={selectedRunId || trace.analysis_id || ''}
                    onChange={(e) => {
                      const rId = parseInt(e.target.value, 10);
                      setSelectedRunId(rId);
                      if (selectedAlertId) loadTrace(selectedAlertId, rId);
                    }}
                    className="px-2.5 py-1 rounded bg-[#07090e] border border-zinc-700 text-xs text-zinc-200 font-mono focus:outline-none"
                  >
                    {trace.runs.map((r) => (
                      <option key={r.id} value={r.id}>
                        Run #{r.id} ({r.mode.toUpperCase()}) — {r.created_at ? new Date(r.created_at).toLocaleTimeString() : 'N/A'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Trace Metadata Telemetry Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0a0d14] border border-zinc-800/80 rounded-xl p-3 px-4 text-xs font-mono">
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase">Analysis Mode</span>
              <span className="text-cyan-300 font-bold uppercase">{trace?.mode || 'EVIDENCE_AWARE'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase">LLM Engine</span>
              <span className="text-zinc-200">{trace?.model_name || 'qwen3:8b'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase">Overall Status</span>
              <span className={trace?.has_run ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                {trace?.has_run ? 'COMPLETED' : 'NO TRACE RECORDED'}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase">Measured Duration</span>
              <span className="text-cyan-400 font-bold">
                {trace?.total_duration_ms ? `${(trace.total_duration_ms / 1000).toFixed(2)}s (${trace.total_duration_ms}ms)` : '0ms'}
              </span>
            </div>
          </div>

          {/* Pipeline Stage Architecture Flow Diagram */}
          <div className="rounded-xl border border-zinc-800/90 bg-[#0c101a] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-xs font-mono uppercase text-zinc-400 font-semibold flex items-center gap-2">
                <Network className="w-4 h-4 text-cyan-400" />
                Pipeline Stage Architecture Flow
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                Click any stage below to inspect runtime inputs, outputs, and interface contracts
              </span>
            </div>

            {loadingTrace ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2">
                <div className="w-6 h-6 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
                <span className="text-xs font-mono text-zinc-400">Loading Pipeline Architecture Flow...</span>
              </div>
            ) : !trace?.has_run ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2 text-center">
                <Layers className="w-8 h-8 text-zinc-700" />
                <span className="text-xs font-semibold text-zinc-300">No Trace Recorded For This Alert</span>
                <p className="text-xs text-zinc-500 max-w-md">
                  Click &quot;Run Analysis&quot; on the left to execute the live AI analysis pipeline and record stage-by-stage execution metrics.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-2">
                <div className="flex items-center gap-1.5 min-w-[780px] py-2">
                  {trace.stages.map((stage, idx) => {
                    const isSelected = activeInspectedStage?.step === stage.step;
                    const isSkipped = stage.status === 'skipped';

                    return (
                      <React.Fragment key={stage.step}>
                        <button
                          onClick={() => setInspectedStageStep(stage.step)}
                          className={`flex-1 min-w-[95px] p-2 rounded-lg border text-left transition-all relative ${
                            isSelected
                              ? 'bg-cyan-950/70 border-cyan-400 text-zinc-100 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                              : isSkipped
                                ? 'bg-zinc-950/40 border-zinc-800/60 opacity-60 hover:opacity-100'
                                : 'bg-[#07090e] border-zinc-800 hover:border-zinc-700 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-mono font-bold text-zinc-500">#{stage.step}</span>
                            {getStageIcon(stage.step)}
                          </div>
                          <div className="text-[10px] font-semibold truncate leading-tight mb-1" title={stage.name}>
                            {stage.name.split(' ')[0]} {stage.name.split(' ')[1] || ''}
                          </div>
                          <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400">
                            <span className={stage.status === 'succeeded' ? 'text-emerald-400' : 'text-zinc-500'}>
                              {stage.status.toUpperCase()}
                            </span>
                            {stage.duration_ms !== undefined && stage.duration_ms > 0 && (
                              <span className="text-cyan-400">{stage.duration_ms}ms</span>
                            )}
                          </div>
                        </button>

                        {idx < trace.stages.length - 1 && (
                          <div className="text-zinc-600 font-mono text-xs select-none">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Click-to-Inspect Stage Details Panel */}
            {activeInspectedStage && trace?.has_run && (
              <div className="mt-3 p-4 rounded-xl border border-zinc-800 bg-[#07090e] space-y-3 font-mono text-xs animate-in fade-in duration-150">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                      {getStageIcon(activeInspectedStage.step)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-100">
                        Stage #{activeInspectedStage.step}: {activeInspectedStage.name}
                      </div>
                      <div className="text-[10px] text-zinc-500">{activeInspectedStage.component}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(activeInspectedStage.status)}
                    <span className="text-cyan-400 font-bold text-xs">
                      {activeInspectedStage.duration_ms !== undefined ? `${activeInspectedStage.duration_ms} ms` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase text-zinc-500">Component Purpose</span>
                    <p className="text-zinc-300 font-sans">
                      {activeInspectedStage.purpose || activeInspectedStage.details}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase text-zinc-500">Interface Invocation Contract</span>
                    <p className="text-zinc-400">{activeInspectedStage.interface}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase text-zinc-500">Input Summary</span>
                    <div className="p-2 rounded bg-black/40 border border-zinc-900 text-zinc-300">
                      {activeInspectedStage.input_summary || 'Sensor event payload'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase text-zinc-500">Output Summary</span>
                    <div className="p-2 rounded bg-black/40 border border-zinc-900 text-zinc-300">
                      {activeInspectedStage.output_summary || activeInspectedStage.details}
                    </div>
                  </div>
                </div>

                {activeInspectedStage.evidence_ids && activeInspectedStage.evidence_ids.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-zinc-800/60">
                    <span className="text-[10px] uppercase text-zinc-500">
                      Retrieved Knowledge Chunks ({activeInspectedStage.evidence_ids.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeInspectedStage.evidence_ids.map((docId) => (
                        <span
                          key={docId}
                          className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-cyan-300"
                        >
                          {docId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Research Mode Ablation Comparison (When multiple runs exist) */}
          {trace?.runs && trace.runs.length > 1 && (
            <div className="rounded-xl border border-zinc-800/90 bg-[#0c101a] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-mono uppercase text-zinc-400 font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  Research Ablation Comparison (Alert #{selectedAlertId})
                </span>
                <span className="text-[10px] font-mono text-zinc-500">{trace.runs.length} Runs Recorded</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] uppercase">
                      <th className="py-2 px-3">Run ID</th>
                      <th className="py-2 px-3">Pipeline Mode</th>
                      <th className="py-2 px-3">Engine</th>
                      <th className="py-2 px-3">Evidence Cited</th>
                      <th className="py-2 px-3">Confidence</th>
                      <th className="py-2 px-3">Timestamp</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {trace.runs.map((r) => {
                      const isCurrent = r.id === (selectedRunId || trace.analysis_id);
                      return (
                        <tr key={r.id} className={isCurrent ? 'bg-cyan-950/30' : 'hover:bg-zinc-900/40'}>
                          <td className="py-2 px-3 font-bold text-zinc-300">#{r.id}</td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-200">
                              {r.mode.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-zinc-400">{r.model_name}</td>
                          <td className="py-2 px-3 text-cyan-400 font-bold">{r.evidence_count}</td>
                          <td className="py-2 px-3">
                            <span className="text-emerald-400">{r.confidence || 'HIGH'}</span>
                          </td>
                          <td className="py-2 px-3 text-zinc-500 text-[11px]">
                            {r.created_at ? new Date(r.created_at).toLocaleTimeString() : 'N/A'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {isCurrent ? (
                              <span className="text-[10px] text-cyan-400 font-semibold">Active Run</span>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedRunId(r.id);
                                  if (selectedAlertId) loadTrace(selectedAlertId, r.id);
                                }}
                                className="text-[10px] text-zinc-400 hover:text-cyan-300 underline"
                              >
                                View Trace
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Execution Timeline (Waterfall) */}
          <div className="rounded-xl border border-zinc-800/90 bg-[#0c101a] p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <span className="text-xs font-mono uppercase text-zinc-400 font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                Stage-by-Stage Execution Timeline
              </span>

              {/* Status Filter */}
              <div className="flex items-center gap-1 text-xs font-mono bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                <button
                  onClick={() => setFilterStageStatus('all')}
                  className={`px-2 py-1 rounded ${filterStageStatus === 'all' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  All ({trace?.stages?.length || 0})
                </button>
                <button
                  onClick={() => setFilterStageStatus('succeeded')}
                  className={`px-2 py-1 rounded ${filterStageStatus === 'succeeded' ? 'bg-emerald-950 text-emerald-300' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Succeeded
                </button>
                <button
                  onClick={() => setFilterStageStatus('skipped')}
                  className={`px-2 py-1 rounded ${filterStageStatus === 'skipped' ? 'bg-zinc-800 text-zinc-300' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Skipped
                </button>
                <button
                  onClick={() => setFilterStageStatus('slow')}
                  className={`px-2 py-1 rounded ${filterStageStatus === 'slow' ? 'bg-amber-950 text-amber-300' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Slow (&gt;30ms)
                </button>
              </div>
            </div>

            {loadingTrace ? (
              <LoadingSkeleton type="table" count={6} />
            ) : !trace?.has_run ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2 text-center">
                <Layers className="w-8 h-8 text-zinc-700" />
                <span className="text-xs font-semibold text-zinc-300">No Stage Traces Available</span>
                <p className="text-xs text-zinc-500 max-w-sm">
                  Run an analysis on this alert to collect live execution telemetry across all 10 pipeline stages.
                </p>
              </div>
            ) : (
              <div className="relative pl-7 space-y-3.5 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-zinc-800">
                {filteredStages.map((stage) => {
                  const isSkipped = stage.status === 'skipped';
                  const isExpanded = expandedStage === stage.step;

                  return (
                    <div key={stage.step} className="relative group">
                      {/* Step Circle */}
                      <div
                        className={`absolute -left-7 top-1 w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                          stage.status === 'succeeded'
                            ? 'bg-emerald-950 border-emerald-500 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                            : isSkipped
                              ? 'bg-zinc-900 border-zinc-700 text-zinc-500'
                              : 'bg-rose-950 border-rose-500 text-rose-300'
                        }`}
                      >
                        {stage.step}
                      </div>

                      {/* Stage Card */}
                      <div
                        className={`p-3.5 rounded-lg border transition-all ${
                          isSkipped
                            ? 'bg-zinc-950/40 border-zinc-800/60 opacity-60'
                            : 'bg-[#07090e] border-zinc-800/80 hover:border-zinc-700'
                        }`}
                      >
                        <div
                          onClick={() => setExpandedStage(isExpanded ? null : stage.step)}
                          className="flex flex-wrap items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-bold text-zinc-200">{stage.name}</span>
                            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/30">
                              {stage.component}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {stage.duration_ms !== undefined && (
                              <span className="text-[11px] font-mono text-zinc-400">{stage.duration_ms}ms</span>
                            )}
                            {getStatusBadge(stage.status)}
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-zinc-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-zinc-500" />
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-zinc-300 mt-2 font-sans">{stage.details}</p>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 mt-2.5 border-t border-zinc-800/60 text-[10px] font-mono text-zinc-400">
                          <div className="flex items-center gap-1.5">
                            <span className="text-zinc-500 uppercase">Interface:</span>
                            <span className="text-zinc-300">{stage.interface}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 uppercase">Records Processed: </span>
                            <span className="text-cyan-400 font-bold">{stage.records_processed}</span>
                          </div>
                        </div>

                        {/* Expanded Technical Inspection */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-zinc-800 text-xs font-mono space-y-2 bg-black/40 p-3 rounded-lg border border-zinc-900">
                            <div className="text-[10px] text-zinc-500 uppercase font-semibold">Stage Verification Contract</div>
                            <div className="text-[11px] text-zinc-300">
                              Module:{' '}
                              <span className="text-cyan-300">{stage.component}</span>
                            </div>
                            <div className="text-[11px] text-zinc-300">
                              Invocation:{' '}
                              <span className="text-zinc-400">{stage.interface}</span>
                            </div>
                            {stage.input_summary && (
                              <div className="text-[11px] text-zinc-300">
                                Input: <span className="text-zinc-400">{stage.input_summary}</span>
                              </div>
                            )}
                            {stage.output_summary && (
                              <div className="text-[11px] text-zinc-300">
                                Output: <span className="text-zinc-400">{stage.output_summary}</span>
                              </div>
                            )}
                            {stage.error && (
                              <div className="text-[11px] text-rose-400">
                                Error: {stage.error}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionTracesPage;
