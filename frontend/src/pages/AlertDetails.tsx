import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Cpu,
  Network,
  FileCheck,
  SearchCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import type { Alert, Analysis, BackendSecurityContext, Evidence } from '../types/alert';
import { alertService } from '../services/api';
import PageHeader from '../components/common/PageHeader';
import SeverityBadge from '../components/common/SeverityBadge';
import StatusBadge from '../components/common/StatusBadge';
import ConfidenceMeter from '../components/common/ConfidenceMeter';
import MockDataDisclaimer from '../components/common/MockDataDisclaimer';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

const getAxiosStatus = (err: unknown): number | undefined =>
  (err as { response?: { status?: number } })?.response?.status;

const getErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

const AlertDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [context, setContext] = useState<BackendSecurityContext | null>(null);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [decision, setDecision] = useState<string | null>(null);
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlertData = async () => {
      setLoading(true);
      setAlertError(null);
      setAnalysisError(null);
      setContextError(null);

      if (!id) {
        setAlertError('No alert id provided in URL.');
        setLoading(false);
        return;
      }

      // Alert — real backend data only; failures surface as an error state.
      try {
        const fetchedAlert = await alertService.getAlert(id);
        setAlert(fetchedAlert);
      } catch (err) {
        setAlert(null);
        const status = getAxiosStatus(err);
        setAlertError(
          status === 404
            ? `Alert #${id} was not found in the backend database.`
            : `Failed to load alert #${id} from backend: ${getErrorMessage(err, 'unknown error')}`,
        );
      }

      // Analysis — real persisted analysis only; never substitute mock data.
      try {
        const fetchedAnalysis = await alertService.getAnalysis(id);
        if (fetchedAnalysis && fetchedAnalysis.summary) {
          setAnalysis(fetchedAnalysis);
          setEvidenceList(fetchedAnalysis.evidence || []);
        } else {
          setAnalysis(null);
          setEvidenceList([]);
          setAnalysisError('Analysis unavailable — the backend returned no analysis content for this alert.');
        }
      } catch (err) {
        setAnalysis(null);
        setEvidenceList([]);
        const status = getAxiosStatus(err);
        setAnalysisError(
          status === 404
            ? 'Analysis unavailable — no analysis has been run for this alert yet. Use "Re-run Analysis" to generate one.'
            : `Analysis unavailable — backend error: ${getErrorMessage(err, 'unknown error')}`,
        );
      }

      // Security context — real extraction endpoint only.
      try {
        const fetchedContext = await alertService.getSecurityContext(id);
        setContext(fetchedContext);
      } catch (err) {
        setContext(null);
        setContextError(`Security context unavailable: ${getErrorMessage(err, 'unknown error')}`);
      }

      setLoading(false);
    };

    fetchAlertData();
  }, [id]);

  const handleTriggerAnalysis = async () => {
    if (!alert) return;
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await alertService.analyzeAlert(alert.id);
      if (res && res.summary) {
        setAnalysis(res);
        setEvidenceList(res.evidence || []);
      } else {
        setAnalysis(null);
        setEvidenceList([]);
        setAnalysisError('Analysis unavailable — the backend returned no analysis content.');
      }
    } catch (err) {
      setAnalysis(null);
      setEvidenceList([]);
      setAnalysisError(`Analysis failed — backend error: ${getErrorMessage(err, 'unknown error')}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalystDecision = (action: string) => {
    setDecision(action);
    setDecisionFeedback(
      `Local note recorded: ${action.toUpperCase()}. This is an advisory-only session note; no verdict is persisted yet (analyst feedback persistence is planned). The AI analysis is not a final decision.`
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton type="detail" />
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="space-y-4">
        <div className="card p-12 text-center text-zinc-400">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-300">Alert unavailable</p>
          <p className="text-xs mt-2 text-zinc-500">{alertError || 'Alert could not be loaded.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={`Forensic Investigation: Alert #${alert.id}`}
        subtitle={`${alert.rule_description} detected on host node ${alert.agent_name}`}
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Alert Stream', href: '/alerts' },
          { label: `Alert #${alert.id}` },
        ]}
        badge={<SeverityBadge severity={alert.severity} showLevel />}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/alerts"
              className="btn btn-secondary text-xs flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Stream</span>
            </Link>
            <Link
              to="/ai-analysis"
              state={{ alertId: alert.id }}
              className="btn btn-primary text-xs flex items-center gap-1.5"
            >
              <SearchCode className="w-3.5 h-3.5" />
              <span>Run AI Analysis</span>
            </Link>
          </div>
        }
      />

      {alertError && (
        <div className="card p-3 border-amber-800/60 bg-amber-950/40 text-[11px] font-mono text-amber-300">
          Backend warning: {alertError}
        </div>
      )}
      {contextError && (
        <div className="card p-3 border-amber-800/60 bg-amber-950/40 text-[11px] font-mono text-amber-300">
          {contextError}
        </div>
      )}
      {analysisError && (
        <div className="card p-3 border-rose-800/60 bg-rose-950/40 text-[11px] font-mono text-rose-300">
          {analysisError}
        </div>
      )}
      {!analysisError && !contextError && !alertError && (
        <MockDataDisclaimer
          label="LIVE BACKEND DATA"
          detail="Alert, security context, evidence and AI analysis are served by the real backend pipeline (PostgreSQL + Qdrant + Ollama)."
        />
      )}

      {/* Primary Key Attributes Ribbon */}
      <div className="card p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 font-mono text-xs">
        <div>
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
            External Ref
          </span>
          <span className="text-zinc-200 font-semibold">{alert.external_alert_id}</span>
        </div>
        <div>
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
            Rule Identifier
          </span>
          <span className="text-cyan-400 font-semibold">RULE-{alert.rule_id}</span>
        </div>
        <div>
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
            Source Host / IP
          </span>
          <span className="text-zinc-200">{alert.source_ip || 'Internal / N/A'}</span>
        </div>
        <div>
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
            Agent Monitored
          </span>
          <span className="text-zinc-200">{alert.agent_name}</span>
        </div>
        <div>
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
            Target Account
          </span>
          <span className="text-zinc-200">{alert.username || 'System Daemon'}</span>
        </div>
        <div>
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
            Workflow Status
          </span>
          <StatusBadge status={alert.status} />
        </div>
      </div>

      {/* Grid: Left Column (Forensic Context) & Right Column (AI Analysis & Evidence) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Forensic Technical Context */}
        <div className="lg:col-span-5 space-y-6">
          {/* Security Context Breakdown */}
          <div className="card p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-zinc-200">Security Context Telemetry</h2>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">Enriched</span>
            </div>

            {/* Network & Identity — real entities extracted by the backend */}
            <div className="space-y-2 text-xs">
              <span className="font-mono text-[10px] text-cyan-400 uppercase tracking-wider font-semibold">
                Network &amp; Transport
              </span>
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Source:</span>
                  <span className="text-zinc-200">{context?.entities?.source_ip?.[0] || alert.source_ip || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Destination:</span>
                  <span className="text-zinc-200">{context?.entities?.destination_ip?.[0] || alert.destination_ip || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Source Port:</span>
                  <span className="text-zinc-200">{context?.entities?.source_port?.[0] || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Destination Port:</span>
                  <span className="text-zinc-200">{context?.entities?.destination_port?.[0] || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Identity & Host — real extracted entities */}
            <div className="space-y-2 text-xs">
              <span className="font-mono text-[10px] text-cyan-400 uppercase tracking-wider font-semibold">
                Identity &amp; Host
              </span>
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Username:</span>
                  <span className="text-zinc-200">{context?.entities?.username?.[0] || alert.username || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Agent:</span>
                  <span className="text-zinc-200">{context?.agent_name || alert.agent_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Agent OS:</span>
                  <span className="text-zinc-200">{context?.entities?.agent_os?.[0] || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Log Location:</span>
                  <span className="text-zinc-200">{context?.entities?.location?.[0] || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Detection & Threat Intelligence — real context fields */}
            <div className="space-y-2 text-xs">
              <span className="font-mono text-[10px] text-cyan-400 uppercase tracking-wider font-semibold">
                Detection &amp; MITRE ATT&CK
              </span>
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Event Type:</span>
                  <span className="text-zinc-200">{context?.event_type || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Rule:</span>
                  <span className="text-zinc-200">{context?.rule_id || alert.rule_id || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block">Mapped Techniques:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(context?.mitre_techniques?.length ?? 0) > 0 ? (
                      context?.mitre_techniques.map((tech, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-zinc-800 text-rose-300 border border-rose-500/30 text-[11px]"
                        >
                          {tech}
                        </span>
                      ))
                    ) : (
                      <span className="text-zinc-500 text-[11px]">None reported by the alert</span>
                    )}
                  </div>
                </div>
                {(context?.mitre_tactics?.length ?? 0) > 0 && (
                  <div>
                    <span className="text-zinc-500 text-[10px] block">Tactics:</span>
                    <span className="text-amber-400 text-xs">{context?.mitre_tactics.join(', ')}</span>
                  </div>
                )}
                {(context?.keywords?.length ?? 0) > 0 && (
                  <div className="pt-1 border-t border-zinc-800/60">
                    <span className="text-zinc-500 text-[10px] block">Extracted Keywords:</span>
                    <span className="text-zinc-400 text-[11px]">{context?.keywords.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Incident Analysis & Evidence Grounding */}
        <div className="lg:col-span-7 space-y-6">
          {/* AI Analysis Dossier */}
          <div className="card p-6 space-y-5 border-cyan-500/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-zinc-100">AI Incident Analysis</h2>
                    <span className="px-2 py-0.2 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                      RAG Grounded
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono">
                    Model: {analysis?.model_name || 'N/A'}
                  </p>
                </div>
              </div>

              <button
                onClick={handleTriggerAnalysis}
                disabled={analyzing}
                className="btn btn-secondary flex items-center gap-2 text-xs shrink-0"
              >
                <Sparkles className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
                <span>{analyzing ? 'Synthesizing...' : 'Re-run Analysis'}</span>
              </button>
            </div>

            {/* Confidence Meter — real model-reported confidence only */}
            <ConfidenceMeter
              confidence={analysis?.confidence}
              label="Evidence Grounding Confidence"
            />

            {/* Analysis Sections */}
            <div className="space-y-4 text-xs">
              {/* Executive Summary */}
              <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-400 font-semibold block">
                  AI Summary
                </span>
                <p className="text-zinc-200 text-sm leading-relaxed">
                  {analysis?.summary || 'No analysis content available. Run the analysis to generate one.'}
                </p>
              </div>

              {/* Severity Assessment & Suspected Attack */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-rose-400 font-semibold block">
                    Severity Assessment
                  </span>
                  <p className="text-zinc-300 font-sans">
                    {analysis?.severity_assessment || 'Assessment pending'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400 font-semibold block">
                    Suspected Attack Vector
                  </span>
                  <p className="text-zinc-300 font-mono text-[11px]">
                    {context?.mitre_techniques?.length
                      ? context.mitre_techniques.join(', ')
                      : 'N/A — no techniques reported by this alert'}
                  </p>
                </div>
              </div>

              {/* Technical Explanation */}
              {analysis?.explanation && (
                <div className="space-y-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">
                    Telemetry Correlated Explanation
                  </span>
                  <p className="text-zinc-300 leading-relaxed bg-[#090d16] p-3 rounded-lg border border-zinc-800">
                    {analysis.explanation}
                  </p>
                </div>
              )}

              {/* Recommended Investigation Steps */}
              {analysis?.recommended_investigation && (
                <div className="space-y-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 font-semibold block">
                    Recommended Triage & Containment Steps
                  </span>
                  <pre className="p-3 rounded-lg bg-[#090d16] border border-zinc-800 text-[11px] font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">
                    {analysis.recommended_investigation}
                  </pre>
                </div>
              )}
            </div>

            {/* Human-in-the-Loop Analyst Decision Action Panel */}
            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">
                  Human-in-the-Loop Analyst Determination
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  AI Assists — Human Decides
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => handleAnalystDecision('confirm')}
                  className={`btn text-xs py-2 flex items-center justify-center gap-1.5 ${
                    decision === 'confirm'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirm Threat</span>
                </button>
                <button
                  onClick={() => handleAnalystDecision('escalate')}
                  className={`btn text-xs py-2 flex items-center justify-center gap-1.5 ${
                    decision === 'escalate'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/60'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Escalate (Tier-2)</span>
                </button>
                <button
                  onClick={() => handleAnalystDecision('investigate_further')}
                  className={`btn text-xs py-2 flex items-center justify-center gap-1.5 ${
                    decision === 'investigate_further'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/60'
                  }`}
                >
                  <SearchCode className="w-3.5 h-3.5" />
                  <span>Deep Forensic</span>
                </button>
                <button
                  onClick={() => handleAnalystDecision('dismiss')}
                  className={`btn text-xs py-2 flex items-center justify-center gap-1.5 ${
                    decision === 'dismiss'
                      ? 'bg-zinc-700 text-white'
                      : 'bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Dismiss</span>
                </button>
              </div>

              {decisionFeedback && (
                <div className="p-2.5 rounded bg-zinc-900 border border-zinc-700 text-[11px] font-mono text-cyan-300">
                  {decisionFeedback}
                </div>
              )}
            </div>
          </div>

          {/* Retrieved Grounding Evidence Cards */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-zinc-200">
                  Supporting Evidence & Grounding Documents
                </h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                {evidenceList.length} Items Grounded
              </span>
            </div>

            <div className="space-y-3">
              {evidenceList.length === 0 && (
                <p className="text-xs text-zinc-500 font-mono">
                  No evidence records persisted for this analysis. Run "Re-run Analysis" to retrieve evidence from the knowledge base.
                </p>
              )}
              {evidenceList.map((evidence) => (
                <div
                  key={evidence.id}
                  className="p-4 rounded-lg bg-[#090d16] border border-zinc-800/90 space-y-2 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-400">
                        {evidence.document_id}
                      </span>
                      <span className="text-xs font-semibold text-zinc-200">{evidence.title}</span>
                    </div>
                    <span className="font-mono text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                      Relevance: {(evidence.relevance_score * 100).toFixed(0)}%
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">{evidence.content}</p>

                  <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                    <span className="truncate">Citation: {evidence.citation}</span>
                    <span className="text-zinc-500 shrink-0">{evidence.source}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertDetails;
