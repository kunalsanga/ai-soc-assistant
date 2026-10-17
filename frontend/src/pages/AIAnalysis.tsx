import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useLocation, Link } from 'react-router-dom';
import {
  Cpu,
  AlertTriangle,
  ExternalLink,
  FileCheck,
  Terminal,
  RefreshCw,
  Sparkles,
  FileSearch,
  HelpCircle,
  Network,
  GitCommit,
  Target,
  Copy,
  Check,
  Shield,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { alertService } from '../services/api';
import type {
  Alert,
  Analysis,
  Evidence,
  InvestigationGraphData,
  ExecutionTraceData,
} from '../services/api';
import PageHeader from '../components/common/PageHeader';
import SeverityBadge from '../components/common/SeverityBadge';
import EmptyState from '../components/common/EmptyState';
import InvestigationGraph from '../components/investigation/InvestigationGraph';
import ExecutionTrace from '../components/investigation/ExecutionTrace';
import ThreatIntelDrawer from '../components/investigation/ThreatIntelDrawer';

const ANALYSIS_MODES = [
  {
    id: 'evidence_aware',
    label: 'Evidence-Aware RAG',
    badge: 'RECOMMENDED',
    description:
      'Structured security context, technique/CVE ID anchoring, and evidence-reference validation against Qdrant knowledge.',
  },
  {
    id: 'standard_rag',
    label: 'Standard RAG',
    badge: 'BASELINE',
    description: 'One naive retrieval query built from the rule description.',
  },
  {
    id: 'llm_only',
    label: 'LLM Only',
    badge: 'UNGROUNDED',
    description: 'Alert sent directly to the model. No retrieval, no evidence grounding.',
  },
] as const;

type AnalysisMode = (typeof ANALYSIS_MODES)[number]['id'];

type WorkspaceTab = 'findings' | 'graph' | 'trace' | 'raw';

const AIAnalysis: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation() as { state?: { alertId?: number } };

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [mode, setMode] = useState<AnalysisMode>('evidence_aware');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('findings');

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [graphData, setGraphData] = useState<InvestigationGraphData | null>(null);
  const [traceData, setTraceData] = useState<ExecutionTraceData | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [graphLoading, setGraphLoading] = useState(false);
  const [traceLoading, setTraceLoading] = useState(false);
  const [running, setRunning] = useState(false);

  // Threat Intel Drawer State
  const [selectedIntelId, setSelectedIntelId] = useState<string | null>(null);

  // Raw payload toggle
  const [rawPayloadOpen, setRawPayloadOpen] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  const loadAlerts = useCallback(async () => {
    setAlertsError(null);
    try {
      const data = await alertService.getAlerts();
      setAlerts(Array.isArray(data) ? data : []);
      return Array.isArray(data) ? data : [];
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as { message?: string })?.message ||
        'Unknown error';
      setAlertsError(message);
      return [];
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    loadAlerts().then((data) => {
      if (!mounted) return;
      const paramId = searchParams.get('alert_id') || searchParams.get('alert');
      const requested = paramId ? Number(paramId) : (location.state?.alertId ?? null);
      const initial =
        requested && data.some((a) => a.id === requested)
          ? requested
          : data.length > 0
            ? data[0].id
            : null;
      setSelectedAlertId(initial);
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Fetch the most recent persisted analysis, graph, and trace for the selected alert. */
  const loadAlertDetails = useCallback(async (alertId: number) => {
    setLoading(true);
    setLoadError(null);
    setAnalysis(null);
    setGraphData(null);
    setTraceData(null);

    // 1. Load Analysis
    try {
      const data = await alertService.getAnalysis(alertId);
      setAnalysis(data);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setLoadError(null); // No analysis yet
        setAnalysis(null);
      } else {
        const message =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (e as { message?: string })?.message ||
          'Unknown error';
        setLoadError(message);
      }
    } finally {
      setLoading(false);
    }

    // 2. Load Investigation Graph if service method exists
    setGraphLoading(true);
    try {
      if (typeof alertService.getInvestigationGraph === 'function') {
        const graph = await alertService.getInvestigationGraph(alertId);
        setGraphData(graph);
      }
    } catch {
      setGraphData(null);
    } finally {
      setGraphLoading(false);
    }

    // 3. Load Execution Trace if service method exists
    setTraceLoading(true);
    try {
      if (typeof alertService.getExecutionTrace === 'function') {
        const trace = await alertService.getExecutionTrace(alertId);
        setTraceData(trace);
      }
    } catch {
      setTraceData(null);
    } finally {
      setTraceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAlertId) {
      loadAlertDetails(selectedAlertId);
    } else {
      setAnalysis(null);
      setGraphData(null);
      setTraceData(null);
      setLoadError(null);
    }
  }, [selectedAlertId, loadAlertDetails]);

  const handleSelectAlert = (id: number) => {
    setSelectedAlertId(id);
    setSearchParams({ alert_id: String(id) }, { replace: true });
  };

  const handleRunAnalysis = async () => {
    if (!selectedAlertId) return;
    setRunning(true);
    setLoadError(null);
    try {
      const result = await alertService.analyzeAlert(selectedAlertId, mode);
      setAnalysis(result);
      // Reload graph and trace if service methods exist
      if (typeof alertService.getInvestigationGraph === 'function') {
        try {
          const updatedGraph = await alertService.getInvestigationGraph(selectedAlertId);
          setGraphData(updatedGraph);
        } catch { /* ignore */ }
      }
      if (typeof alertService.getExecutionTrace === 'function') {
        try {
          const updatedTrace = await alertService.getExecutionTrace(selectedAlertId);
          setTraceData(updatedTrace);
        } catch { /* ignore */ }
      }
    } catch (e: unknown) {
      const err = e as {
        code?: string;
        message?: string;
        response?: { status?: number; data?: { detail?: string } };
      };
      const detail =
        err.response?.data?.detail ||
        (err.code === 'ECONNABORTED'
          ? 'The request timed out while the LLM was still generating.'
          : err.message) ||
        'Unknown error';
      const status =
        err.response?.status === 504
          ? 'LLM inference timed out.'
          : err.response?.status === 502
            ? 'The LLM pipeline failed.'
            : err.response?.status === 404
              ? 'Alert not found.'
              : null;
      setLoadError(`${status ? status + ' ' : ''}Analysis failed: ${detail}`);
    } finally {
      setRunning(false);
    }
  };

  const selectedAlert = alerts.find((a) => a.id === selectedAlertId) || null;

  // Extract MITRE techniques from raw data or evidence
  const techniques = useMemo(() => {
    const list: string[] = [];
    if (selectedAlert?.raw_data) {
      const match = selectedAlert.raw_data.match(/T\d{4}(?:\.\d{3})?/g);
      if (match) list.push(...match);
    }
    if (analysis?.evidence) {
      for (const ev of analysis.evidence) {
        const m = ev.document_id.match(/T\d{4}(?:\.\d{3})?/);
        if (m) list.push(m[0]);
      }
    }
    return Array.from(new Set(list));
  }, [selectedAlert, analysis]);

  // Copy structured report to clipboard
  const handleCopyReport = () => {
    if (!selectedAlert || !analysis) return;
    const report = `# AI SOC Investigation Report — Alert #${selectedAlert.id}
**Rule:** ${selectedAlert.rule_id} — ${selectedAlert.rule_description}
**Severity:** Level ${selectedAlert.severity} | **Timestamp:** ${selectedAlert.timestamp}
**Host:** ${selectedAlert.agent_name || 'N/A'} | **User:** ${selectedAlert.username || 'N/A'} | **Src IP:** ${selectedAlert.source_ip || 'N/A'}

## Executive Summary
${analysis.summary}

## Severity Assessment
${analysis.severity_assessment}

## Reasoning & Limitations
${analysis.explanation}

## Recommended Investigation Steps (Non-Destructive)
${analysis.recommended_investigation}

## Grounded Evidence (${analysis.evidence?.length || 0} citations)
${(analysis.evidence || []).map((e: Evidence) => `- [${e.document_id}] ${e.title} (similarity: ${e.relevance_score?.toFixed(3) || 'N/A'}): "${e.citation}"`).join('\n')}

---
*Analysis produced via ${analysis.model_name} in ${analysis.analysis_type} mode. Advisory only.*`;

    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  if (alertsError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Investigation Workspace"
          subtitle="Grounded AI incident analysis with entity graph and pipeline execution tracing."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Investigation Workspace' }]}
        />
        <div className="card p-12 flex flex-col items-center space-y-3 border-rose-500/30">
          <AlertTriangle className="w-12 h-12 text-rose-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Could not load alerts</h2>
          <p className="text-xs text-zinc-400 font-mono break-all max-w-lg">{alertsError}</p>
          <button
            onClick={() => loadAlerts()}
            className="btn btn-secondary text-xs flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <PageHeader
        title="Investigation Workspace"
        subtitle="Connected security investigation: direct telemetry facts, grounded AI findings, Obsidian entity graph, and live execution tracing."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Investigation Workspace' }]}
        badge={
          analysis?.model_name ? (
            <span className="font-mono text-xs text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-800/40">
              {`Model: ${analysis.model_name}`}
            </span>
          ) : null
        }
        actions={
          alerts.length > 0 ? (
            <div className="flex items-center gap-2.5 max-w-full">
              <label className="text-xs text-zinc-400 font-mono shrink-0">Selected Alert:</label>
              <select
                value={selectedAlertId ?? ''}
                onChange={(e) => handleSelectAlert(Number(e.target.value))}
                className="bg-[#0c101a] border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500 max-w-xs truncate"
              >
                {alerts.map((alert) => (
                  <option key={alert.id} value={alert.id}>
                    Alert #{alert.id} — {alert.rule_description.slice(0, 48)}
                  </option>
                ))}
              </select>
            </div>
          ) : null
        }
      />

      {alerts.length === 0 && !loading ? (
        <EmptyState
          icon={FileSearch}
          title="No Alerts Available in PostgreSQL"
          description="The alert queue is currently empty. Sync alerts from the Dashboard or Alert Stream to begin an investigation."
          action={
            <Link to="/" className="btn btn-secondary text-xs">
              Go to Dashboard
            </Link>
          }
        />
      ) : (
        <>
          {/* Analysis Mode & Action Bar */}
          <div className="card p-5 space-y-4 bg-[#0a0d14] border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-200">Investigation Engine Mode</h2>
                <p className="text-xs text-zinc-400">
                  Select the retrieval and grounding pipeline to evaluate against this alert.
                </p>
              </div>

              {analysis && (
                <button
                  onClick={handleCopyReport}
                  className="btn btn-secondary text-xs flex items-center gap-1.5"
                  title="Copy formatted markdown investigation report"
                >
                  {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedReport ? 'Report Copied!' : 'Export Report'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {ANALYSIS_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`p-3.5 rounded-lg text-left border transition-all ${
                    mode === m.id
                      ? 'bg-cyan-950/40 border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`font-mono text-xs font-bold ${
                        mode === m.id ? 'text-cyan-300' : 'text-zinc-300'
                      }`}
                    >
                      {m.label}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                        m.badge === 'RECOMMENDED'
                          ? 'text-emerald-400 bg-emerald-950 border-emerald-800/50'
                          : m.badge === 'BASELINE'
                            ? 'text-cyan-400 bg-cyan-950 border-cyan-800/50'
                            : 'text-amber-400 bg-amber-950 border-amber-800/50'
                      }`}
                    >
                      {m.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">{m.description}</p>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>
                  Telemetry Fact → Context Extraction → Qdrant Vector Retrieval → Local Qwen3-8B → Evidence Validation
                </span>
              </div>

              <button
                onClick={handleRunAnalysis}
                disabled={running || !selectedAlertId}
                className="btn btn-primary text-xs flex items-center gap-2 shrink-0 py-2 px-4 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              >
                <Sparkles className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
                <span>
                  {running
                    ? 'Running Analysis...'
                    : analysis
                      ? 'Run New Analysis'
                      : 'Run Analysis'}
                </span>
              </button>
            </div>

            {running && (
              <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800/50 flex items-center gap-3 text-xs text-cyan-300 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                <span>
                  Executing {mode} pipeline on Alert #{selectedAlertId}. Qwen3-8B is analyzing grounded evidence locally. Please wait...
                </span>
              </div>
            )}
          </div>

          {/* 3-Column / Tabbed Workspace Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT COLUMN: OBSERVED SENSOR FACTS (4 cols) */}
            {selectedAlert && (
              <div className="lg:col-span-4 space-y-4">
                <div className="card p-5 space-y-4 bg-[#090d16] border-zinc-800 sticky top-4">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-cyan-400" />
                      <h2 className="text-xs font-mono font-bold tracking-wider text-cyan-400 uppercase">
                        OBSERVED SENSOR FACTS
                      </h2>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/40 text-cyan-300">
                      SENSOR TELEMETRY
                    </span>
                  </div>

                  {/* Facts list */}
                  <div className="space-y-2.5 text-xs font-mono">
                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Alert Record:</span>
                      <span className="text-zinc-200 font-semibold">
                        #{selectedAlert.id} ({selectedAlert.external_alert_id})
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Observed Severity:</span>
                      <SeverityBadge severity={selectedAlert.severity} showLevel />
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Host / Agent:</span>
                      <span className="text-blue-400 font-medium">{selectedAlert.agent_name || 'N/A'}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Source Address:</span>
                      <span className="text-cyan-400 font-bold">{selectedAlert.source_ip || 'N/A'}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Dest Address:</span>
                      <span className="text-zinc-300">{selectedAlert.destination_ip || 'N/A'}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Associated User:</span>
                      <span className="text-purple-400 font-medium">{selectedAlert.username || 'N/A'}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Event Timestamp:</span>
                      <span className="text-zinc-400 text-[11px]">{selectedAlert.timestamp}</span>
                    </div>
                  </div>

                  {/* Triggered Rule Card */}
                  <div className="p-3 rounded-lg bg-[#06080e] border border-zinc-800 space-y-1">
                    <span className="text-amber-400 text-[10px] font-mono uppercase font-semibold block">
                      Triggered Detection Rule
                    </span>
                    <p className="text-zinc-200 text-xs font-sans leading-relaxed">
                      <span className="font-mono text-zinc-400 mr-1.5">[{selectedAlert.rule_id}]</span>
                      {selectedAlert.rule_description}
                    </p>
                  </div>

                  {/* Known ATT&CK Techniques Chips */}
                  {techniques.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">
                        Associated ATT&CK Techniques
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {techniques.map((tech) => (
                          <button
                            key={tech}
                            onClick={() => setSelectedIntelId(tech)}
                            className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950/70 border border-emerald-800/40 text-emerald-300 hover:bg-emerald-900/60 transition-all flex items-center gap-1"
                            title="Inspect MITRE Threat Intel"
                          >
                            <Target className="w-3 h-3 text-emerald-400" />
                            <span>{tech}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw Telemetry Expander */}
                  {selectedAlert.raw_data && (
                    <div className="border-t border-zinc-800 pt-3">
                      <button
                        onClick={() => setRawPayloadOpen(!rawPayloadOpen)}
                        className="w-full flex items-center justify-between text-xs font-mono text-zinc-400 hover:text-zinc-200 py-1"
                      >
                        <span className="flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5" />
                          <span>Raw Telemetry JSON</span>
                        </span>
                        {rawPayloadOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {rawPayloadOpen && (
                        <pre className="mt-2 p-2.5 rounded bg-black/60 border border-zinc-800 text-[10px] font-mono text-zinc-300 overflow-x-auto max-h-56 scrollbar-thin">
                          {(() => {
                            try {
                              return JSON.stringify(JSON.parse(selectedAlert.raw_data), null, 2);
                            } catch {
                              return selectedAlert.raw_data;
                            }
                          })()}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MAIN COLUMN: INVESTIGATION TABS (8 cols) */}
            <div className={selectedAlert ? 'lg:col-span-8 space-y-4' : 'space-y-4'}>
              {/* Workspace Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                <button
                  onClick={() => setActiveTab('findings')}
                  className={`px-3 py-2 rounded-lg text-xs font-medium font-mono flex items-center gap-2 transition-all ${
                    activeTab === 'findings'
                      ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>AI Investigation Findings</span>
                </button>

                <button
                  onClick={() => setActiveTab('graph')}
                  className={`px-3 py-2 rounded-lg text-xs font-medium font-mono flex items-center gap-2 transition-all ${
                    activeTab === 'graph'
                      ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  <Network className="w-4 h-4 text-cyan-400" />
                  <span>Obsidian Entity Graph</span>
                  {graphData && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-900/60 text-cyan-300">
                      {graphData.node_count}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('trace')}
                  className={`px-3 py-2 rounded-lg text-xs font-medium font-mono flex items-center gap-2 transition-all ${
                    activeTab === 'trace'
                      ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  <GitCommit className="w-4 h-4 text-cyan-400" />
                  <span>Pipeline Execution Trace</span>
                </button>
              </div>

              {/* Error State */}
              {loadError && (
                <div className="card p-6 border-rose-500/30 space-y-3 bg-[#0f0709]">
                  <div className="flex items-center gap-2 text-rose-400">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-sm font-semibold text-zinc-200">Analysis unavailable</span>
                  </div>
                  <p className="text-xs font-mono text-rose-300 break-all">{loadError}</p>
                  <p className="text-xs text-zinc-400">
                    No simulated fallback data was substituted. Inspect system connectivity or retry.
                  </p>
                  {selectedAlertId && (
                    <button
                      onClick={() => loadAlertDetails(selectedAlertId)}
                      className="btn btn-secondary text-xs flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              )}

              {/* Loading State */}
              {loading && !analysis && !loadError && (
                <div className="card p-12 text-center text-zinc-400 flex flex-col items-center space-y-3">
                  <div className="w-8 h-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
                  <span className="text-xs font-mono">Loading persisted investigation details...</span>
                </div>
              )}

              {/* TAB 1: AI FINDINGS */}
              {activeTab === 'findings' && (
                <>
                  {!analysis && !loading && !loadError && selectedAlert && (
                    <div className="card p-12 flex flex-col items-center space-y-3 border-zinc-800 bg-[#0c101a] text-center">
                      <HelpCircle className="w-10 h-10 text-zinc-600 mb-1" />
                      <h3 className="text-sm font-semibold text-zinc-200">
                        No analysis has been run for alert #{selectedAlert.id}
                      </h3>
                      <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
                        Select an investigation mode above and click{' '}
                        <strong className="text-cyan-400">Run AI Investigation</strong>.
                        The analysis, evidence grounding, and entity graph will be computed and persisted to PostgreSQL.
                      </p>
                    </div>
                  )}

                  {analysis && (
                    <div className="card p-6 space-y-6 border-cyan-500/30 bg-[#0c101a]">
                      {/* Analysis Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-800 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <Cpu className="w-5 h-5 text-cyan-400" />
                            <h2 className="text-xs font-mono font-bold tracking-wider text-cyan-400 uppercase">
                              AI INCIDENT HYPOTHESIS & ANALYSIS (ADVISORY)
                            </h2>
                          </div>
                          <p className="text-xs text-zinc-400 font-mono mt-1">
                            Mode: <span className="text-zinc-200 font-semibold">{analysis.analysis_type}</span> ·
                            Model: <span className="text-zinc-200 font-semibold">{analysis.model_name}</span>
                            {analysis.created_at ? ` · ${new Date(analysis.created_at).toLocaleString()}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300">
                            Confidence: <strong className="text-cyan-400">{analysis.confidence || 'MEDIUM'}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Executive Summary */}
                      <div className="space-y-1.5 p-4 rounded-lg bg-zinc-900/70 border border-zinc-800">
                        <span className="font-mono text-[10px] text-cyan-400 uppercase font-semibold block tracking-wider">
                          Executive Incident Summary
                        </span>
                        <p className="text-zinc-200 text-sm leading-relaxed">{analysis.summary}</p>
                      </div>

                      {/* Severity & Technique Assessment */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1.5">
                          <span className="font-mono text-[10px] uppercase text-rose-400 font-semibold block">
                            Severity Assessment & Rationale
                          </span>
                          <p className="text-zinc-300 font-sans leading-relaxed">
                            {analysis.severity_assessment || 'Not available'}
                          </p>
                        </div>

                        <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1.5">
                          <span className="font-mono text-[10px] uppercase text-amber-400 font-semibold block">
                            Identified MITRE ATT&CK Techniques
                          </span>
                          {techniques.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {techniques.map((t) => (
                                <button
                                  key={t}
                                  onClick={() => setSelectedIntelId(t)}
                                  className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950/80 border border-emerald-800/40 text-emerald-300 hover:bg-emerald-900 transition-colors flex items-center gap-1"
                                >
                                  <Target className="w-3 h-3 text-emerald-400" />
                                  <span>{t}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-zinc-400 text-xs">No specific technique IDs mapped.</p>
                          )}
                        </div>
                      </div>

                      {/* Detailed Reasoning & Limitations */}
                      <div className="space-y-1.5 text-xs">
                        <span className="font-mono text-[10px] uppercase text-zinc-400 font-semibold block tracking-wider">
                          Analyst Reasoning & Limitations
                        </span>
                        <p className="p-4 rounded-lg bg-[#07090e] border border-zinc-800 text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {analysis.explanation || 'Not available'}
                        </p>
                      </div>

                      {/* Recommended Safe Investigation Steps */}
                      <div className="space-y-1.5 text-xs">
                        <span className="font-mono text-[10px] uppercase text-emerald-400 font-semibold block tracking-wider">
                          Recommended Investigation Steps (Non-Destructive Only)
                        </span>
                        <pre className="p-4 rounded-lg bg-[#07090e] border border-zinc-800 text-[11px] font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">
                          {analysis.recommended_investigation || 'None specified.'}
                        </pre>
                      </div>

                      {/* Claim-to-Evidence Grounding Card */}
                      <div className="pt-3 border-t border-zinc-800 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-zinc-200 font-semibold">
                            <FileCheck className="w-4 h-4 text-emerald-400" />
                            <span>Claim-to-Evidence Grounding ({analysis.evidence?.length || 0} citations)</span>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-500">
                            Citation resolved; semantic support not independently verified
                          </span>
                        </div>

                        {(analysis.evidence?.length || 0) === 0 ? (
                          <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400">
                            No external evidence records were grounded for this analysis
                            {analysis.analysis_type === 'llm_only'
                              ? ' (LLM-only mode operates without retrieval).'
                              : '.'}
                          </div>
                        ) : (
                          <div className="space-y-2.5 text-xs">
                            {analysis.evidence?.map((ev: Evidence) => (
                              <div
                                key={ev.id}
                                className="p-3.5 rounded-lg bg-[#07090e] border border-zinc-800 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 hover:border-zinc-700 transition-colors"
                              >
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-cyan-400 font-bold text-xs">
                                      {ev.document_id}:
                                    </span>
                                    <span className="text-zinc-200 font-medium truncate">{ev.title}</span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                                      {ev.source}
                                    </span>
                                  </div>
                                  <p className="text-zinc-400 text-[11px] italic font-mono bg-black/40 p-2 rounded border border-zinc-900">
                                    “{ev.citation}”
                                  </p>
                                </div>

                                <div className="shrink-0 flex flex-col items-end gap-1">
                                  <span className="font-mono text-[11px] text-emerald-400">
                                    similarity {ev.relevance_score != null ? ev.relevance_score.toFixed(3) : 'n/a'}
                                  </span>
                                  <button
                                    onClick={() => setSelectedIntelId(ev.document_id)}
                                    className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                                  >
                                    <span>Inspect Context</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Advisory Disclaimer */}
                      <div className="pt-3 border-t border-zinc-800/80 text-[11px] font-mono text-zinc-500">
                        ⚠ <strong className="text-amber-400">Advisory Research Prototype</strong>: This assessment is
                        generated by a local LLM ({analysis.model_name}) and does not perform destructive automated actions.
                        The human analyst makes all containment decisions.
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* TAB 2: OBSIDIAN ENTITY GRAPH */}
              {activeTab === 'graph' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-mono uppercase font-bold text-cyan-400">
                        Obsidian-Style Investigation Knowledge Graph
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Interactive graph connecting alert telemetry, ATT&CK techniques, CVEs, and retrieved evidence.
                      </p>
                    </div>
                  </div>

                  <InvestigationGraph
                    data={graphData}
                    loading={graphLoading}
                    onSearchKnowledge={(techId) => setSelectedIntelId(techId)}
                  />
                </div>
              )}

              {/* TAB 3: PIPELINE EXECUTION TRACE */}
              {activeTab === 'trace' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-mono uppercase font-bold text-cyan-400">
                        End-to-End Pipeline Trace
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Actual execution checkpoints through FastAPI, Qdrant vector retrieval, and Ollama inference.
                      </p>
                    </div>
                  </div>

                  <ExecutionTrace trace={traceData} loading={traceLoading} />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Slide-out Threat Intelligence Context Drawer */}
      <ThreatIntelDrawer
        identifier={selectedIntelId}
        onClose={() => setSelectedIntelId(null)}
      />
    </div>
  );
};

export default AIAnalysis;
