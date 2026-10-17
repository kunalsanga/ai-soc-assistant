import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { alertService } from '../services/api';
import type { Alert, Analysis } from '../types/alert';
import PageHeader from '../components/common/PageHeader';
import SeverityBadge from '../components/common/SeverityBadge';
import EmptyState from '../components/common/EmptyState';

const ANALYSIS_MODES = [
  {
    id: 'llm_only',
    label: 'LLM Only',
    description: 'The alert is sent directly to the model. No retrieval, no evidence.',
  },
  {
    id: 'standard_rag',
    label: 'Standard RAG',
    description: 'One naive retrieval query built from the rule description.',
  },
  {
    id: 'evidence_aware',
    label: 'Evidence-Aware RAG',
    description:
      'Structured security context, technique/CVE ID anchoring, and evidence-reference validation.',
  },
] as const;

type AnalysisMode = (typeof ANALYSIS_MODES)[number]['id'];

const AIAnalysis: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation() as { state?: { alertId?: number } };

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [mode, setMode] = useState<AnalysisMode>('evidence_aware');

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

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
      const requested =
        searchParams.get('alert') ? Number(searchParams.get('alert')) : (location.state?.alertId ?? null);
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

  /** Fetch the most recent persisted analysis for the selected alert. */
  const loadAnalysis = useCallback(async (alertId: number) => {
    setLoading(true);
    setLoadError(null);
    setAnalysis(null);
    try {
      const data = await alertService.getAnalysis(alertId);
      setAnalysis(data);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setLoadError(null); // Not an error: no analysis has been run yet.
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
  }, []);

  useEffect(() => {
    if (selectedAlertId) {
      loadAnalysis(selectedAlertId);
    } else {
      setAnalysis(null);
      setLoadError(null);
    }
  }, [selectedAlertId, loadAnalysis]);

  const handleRunAnalysis = async () => {
    if (!selectedAlertId) return;
    setRunning(true);
    setLoadError(null);
    try {
      const result = await alertService.analyzeAlert(selectedAlertId, mode);
      setAnalysis(result);
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
      setAnalysis(null);
    } finally {
      setRunning(false);
    }
  };

  const selectedAlert = alerts.find((a) => a.id === selectedAlertId) || null;

  // Techniques genuinely derived from persisted evidence document ids.
  const techniquesFromEvidence = Array.from(
    new Set(
      (analysis?.evidence || [])
        .map((ev) => ev.document_id.match(/T\d{4}(?:\.\d{3})?/)?.[0])
        .filter((id): id is string => Boolean(id))
    )
  );

  if (alertsError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="AI Analysis"
          subtitle="Run the LLM analysis pipeline on a database alert."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'AI Analysis' }]}
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
      <PageHeader
        title="AI Analysis"
        subtitle="Select a real persisted alert, choose an analysis mode, and run the configured LLM pipeline."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'AI Analysis' }]}
        badge={
          analysis?.model_name ? (
            <span className="font-mono text-xs text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-800/40">
              Model: {analysis.model_name}
            </span>
          ) : null
        }
        actions={
          alerts.length > 0 ? (
            <div className="flex items-center gap-2 max-w-full">
              <label className="text-xs text-zinc-400 font-mono shrink-0">Alert:</label>
              <select
                value={selectedAlertId ?? ''}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedAlertId(id);
                  setSearchParams({ alert: String(id) }, { replace: true });
                }}
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
          title="No Alerts Available"
          description="The database has no alerts. Sync alerts on the Dashboard first, then return here to run an analysis."
          action={
            <Link to="/" className="btn btn-secondary text-xs">
              Go to Dashboard
            </Link>
          }
        />
      ) : (
        <>
          {/* Mode selection — all three research modes */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <h2 className="text-sm font-semibold text-zinc-200">Analysis Mode</h2>
              <span className="text-[10px] font-mono text-zinc-500 uppercase">
                mode is sent to the backend verbatim
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {ANALYSIS_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`p-3.5 rounded-lg text-left border transition-all ${
                    mode === m.id
                      ? 'bg-cyan-950/40 border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono text-xs font-bold ${
                        mode === m.id ? 'text-cyan-300' : 'text-zinc-300'
                      }`}
                    >
                      {m.label}
                    </span>
                    {mode === m.id && <span className="text-[10px] font-mono text-cyan-400">SELECTED</span>}
                  </div>
                  <p className="mt-1.5 text-[11px] text-zinc-400 leading-relaxed">{m.description}</p>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-mono text-zinc-500">
                Pipeline: alert → security context → retrieval (mode-dependent) → Qwen3-8B → evidence validation → PostgreSQL
              </span>
              <button
                onClick={handleRunAnalysis}
                disabled={running || !selectedAlertId}
                className="btn btn-primary text-xs flex items-center gap-2 shrink-0"
              >
                <Sparkles className={`w-3.5 h-3.5 ${running ? 'animate-pulse' : ''}`} />
                <span>
                  {running ? 'Running (this can take a minute)...' : analysis ? 'Run New Analysis' : 'Run Analysis'}
                </span>
              </button>
            </div>
            {running && (
              <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800 text-[11px] font-mono text-cyan-300">
                Running {mode} on alert #{selectedAlertId}. The request blocks until the LLM
                finishes — do not navigate away.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* SECTION 1: observed facts from the real alert row */}
            {selectedAlert && (
              <div className="lg:col-span-4 space-y-4">
                <div className="card p-5 space-y-4 bg-[#090d16] border-zinc-800">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-cyan-400" />
                      <h2 className="text-xs font-mono font-bold tracking-wider text-cyan-400 uppercase">
                        1. OBSERVED ALERT FACTS
                      </h2>
                    </div>
                    <Link
                      to={`/alerts/${selectedAlert.id}`}
                      className="text-cyan-400 hover:text-cyan-300"
                      title="Open full alert detail"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>

                  <div className="space-y-3 text-xs font-mono">
                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Alert:</span>
                      <span className="text-zinc-200">
                        #{selectedAlert.id} ({selectedAlert.external_alert_id})
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Severity:</span>
                      <SeverityBadge severity={selectedAlert.severity} showLevel />
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Agent Node:</span>
                      <span className="text-zinc-200">{selectedAlert.agent_name || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Source Address:</span>
                      <span className="text-cyan-400 font-bold">{selectedAlert.source_ip || 'Not available'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Destination:</span>
                      <span className="text-zinc-300">{selectedAlert.destination_ip || 'Not available'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Identity:</span>
                      <span className="text-zinc-200">{selectedAlert.username || 'Not available'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-500">Timestamp:</span>
                      <span className="text-zinc-400 text-[11px]">
                        {selectedAlert.timestamp || 'Not available'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded bg-[#06080e] border border-zinc-800 text-[11px] font-mono text-zinc-400">
                    <span className="text-zinc-500 text-[10px] block uppercase">Rule Triggered</span>
                    <span className="text-zinc-200 font-sans font-medium break-words">
                      RULE-{selectedAlert.rule_id}: {selectedAlert.rule_description}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2: real persisted analysis */}
            <div className={selectedAlert ? 'lg:col-span-8 space-y-4' : 'space-y-4'}>
              {loadError && (
                <div className="card p-8 border-rose-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-rose-400">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-sm font-semibold text-zinc-200">Analysis unavailable</span>
                  </div>
                  <p className="text-xs font-mono text-rose-300 break-all">{loadError}</p>
                  <p className="text-xs text-zinc-400">
                    No fallback data is shown. Retry below once the backend/LLM is available.
                  </p>
                  {selectedAlertId && (
                    <button
                      onClick={() => loadAnalysis(selectedAlertId)}
                      className="btn btn-secondary text-xs flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              )}

              {loading && !analysis && !loadError && (
                <div className="card p-12 text-center text-zinc-400">Loading existing analysis...</div>
              )}

              {!analysis && !loading && !loadError && selectedAlert && (
                <div className="card p-12 flex flex-col items-center space-y-3 border-zinc-800">
                  <HelpCircle className="w-10 h-10 text-zinc-500" />
                  <h3 className="text-sm font-semibold text-zinc-200">
                    No analysis has been run for alert #{selectedAlert.id}
                  </h3>
                  <p className="text-xs text-zinc-400 text-center max-w-md">
                    Choose an analysis mode above and run it. The result will be persisted to
                    PostgreSQL before it is shown here.
                  </p>
                </div>
              )}

              {analysis && (
                <div className="card p-6 space-y-5 border-cyan-500/30 bg-[#0c101a]">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-cyan-400" />
                        <h2 className="text-xs font-mono font-bold tracking-wider text-cyan-400 uppercase">
                          2. AI INCIDENT ANALYSIS (ADVISORY)
                        </h2>
                      </div>
                      <p className="text-xs text-zinc-400 font-mono mt-0.5">
                        Mode: {analysis.analysis_type || 'unknown'} · Model: {analysis.model_name || 'not recorded'}
                        {analysis.created_at ? ` · ${new Date(analysis.created_at).toLocaleString()}` : ''}
                      </p>
                    </div>
                    {selectedAlertId && (
                      <button
                        onClick={handleRunAnalysis}
                        disabled={running}
                        className="btn btn-secondary text-xs flex items-center gap-1.5"
                      >
                        <Sparkles
                          className={`w-3.5 h-3.5 ${running ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`}
                        />
                        <span>{running ? 'Regenerating...' : 'Regenerate'}</span>
                      </button>
                    )}
                  </div>

                  {/* Qualitative confidence — verbatim from the model, no percentage */}
                  <div className="flex items-center justify-between text-xs px-4 py-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800">
                    <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                      <FileCheck className="w-4 h-4 text-cyan-400" />
                      <span>Model-reported confidence (qualitative)</span>
                    </div>
                    <span className="font-bold font-mono text-cyan-400">
                      {analysis.confidence || 'Not available'}
                    </span>
                  </div>

                  <div className="space-y-1.5 p-4 rounded-lg bg-zinc-900/70 border border-zinc-800">
                    <span className="font-mono text-[10px] text-cyan-400 uppercase font-semibold block tracking-wider">
                      AI Executive Summary
                    </span>
                    <p className="text-zinc-200 text-sm leading-relaxed">{analysis.summary}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                      <span className="font-mono text-[10px] uppercase text-rose-400 font-semibold block">
                        Severity Assessment
                      </span>
                      <p className="text-zinc-300 font-sans">{analysis.severity_assessment || 'Not available'}</p>
                    </div>
                    <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                      <span className="font-mono text-[10px] uppercase text-amber-400 font-semibold block">
                        Techniques (from evidence document IDs)
                      </span>
                      <p className="text-zinc-300 font-mono text-[11px]">
                        {techniquesFromEvidence.length > 0
                          ? techniquesFromEvidence.join(', ')
                          : 'None available'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <span className="font-mono text-[10px] uppercase text-zinc-400 font-semibold block tracking-wider">
                      Reasoning & Limitations
                    </span>
                    <p className="p-3.5 rounded-lg bg-[#07090e] border border-zinc-800 text-zinc-300 leading-relaxed whitespace-pre-wrap">
                      {analysis.explanation || 'Not available'}
                    </p>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <span className="font-mono text-[10px] uppercase text-emerald-400 font-semibold block tracking-wider">
                      Recommended Investigation Steps (non-destructive recommendations only)
                    </span>
                    <pre className="p-3.5 rounded-lg bg-[#07090e] border border-zinc-800 text-[11px] font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">
                      {analysis.recommended_investigation || 'Not available'}
                    </pre>
                  </div>

                  {/* Evidence — real persisted records for THIS analysis */}
                  <div className="pt-2 border-t border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
                        <FileCheck className="w-4 h-4 text-emerald-400" />
                        <span>Evidence Records ({analysis.evidence?.length || 0})</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">
                        scores are retrieval similarity, not model confidence
                      </span>
                    </div>

                    {(analysis.evidence?.length || 0) === 0 ? (
                      <p className="p-3 rounded bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400">
                        No evidence records are linked to this analysis
                        {analysis.analysis_type === 'llm_only' ? ' (LLM-only mode retrieves no evidence).' : '.'}
                      </p>
                    ) : (
                      <div className="space-y-2 text-xs">
                        {analysis.evidence?.map((ev) => (
                          <div
                            key={ev.id}
                            className="p-3 rounded bg-[#07090e] border border-zinc-800/80 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div>
                                <span className="font-mono text-cyan-400 font-bold text-xs">
                                  {ev.document_id}:
                                </span>{' '}
                                <span className="text-zinc-300 font-medium">{ev.title}</span>
                              </div>
                              <div className="font-mono text-[10px] text-zinc-500 mt-0.5">
                                source: {ev.source} · “{ev.citation}”
                              </div>
                            </div>
                            <span className="font-mono text-[11px] text-emerald-400 shrink-0">
                              similarity {ev.relevance_score != null ? ev.relevance_score.toFixed(3) : 'n/a'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Advisory disclaimer — the human decides */}
                  <div className="pt-4 border-t border-zinc-800">
                    <p className="text-[11px] text-zinc-400">
                      ⚠ This analysis is <span className="text-amber-400">advisory only</span>. It was
                      produced by a local LLM and may contain errors. The human analyst makes the
                      final decision. Observed facts (Section 1) and inferred hypotheses above must
                      be evaluated separately.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AIAnalysis;
