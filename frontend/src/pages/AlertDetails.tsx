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
import type { Alert, Analysis, SecurityContext, Evidence } from '../types/alert';
import { alertService } from '../services/api';
import { mockAlerts } from '../data/mockAlerts';
import { getSecurityContextForAlert } from '../data/mockSecurityContext';
import { getEvidenceForAlert } from '../data/mockEvidence';
import { getMockAnalysisForAlert } from '../data/mockAnalysis';
import PageHeader from '../components/common/PageHeader';
import SeverityBadge from '../components/common/SeverityBadge';
import StatusBadge from '../components/common/StatusBadge';
import ConfidenceMeter from '../components/common/ConfidenceMeter';
import MockDataDisclaimer from '../components/common/MockDataDisclaimer';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

const AlertDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [context, setContext] = useState<SecurityContext | null>(null);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [decision, setDecision] = useState<string | null>(null);
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlertData = async () => {
      setLoading(true);
      const numericId = Number(id) || 1;

      try {
        if (id) {
          const fetchedAlert = await alertService.getAlert(id);
          setAlert(fetchedAlert);
        }
      } catch {
        // Fallback to rich mock data
        const fallback = mockAlerts.find((a) => a.id === numericId) || mockAlerts[0];
        setAlert(fallback);
      }

      // Check for backend analysis first, fallback to mock analysis
      try {
        if (id) {
          const fetchedAnalysis = await alertService.getAnalysis(id);
          if (fetchedAnalysis && fetchedAnalysis.summary) {
            setAnalysis(fetchedAnalysis);
          } else {
            setAnalysis(getMockAnalysisForAlert(numericId));
          }
        }
      } catch {
        setAnalysis(getMockAnalysisForAlert(numericId));
      }

      // Load security context and evidence
      setContext(getSecurityContextForAlert(numericId));
      setEvidenceList(getEvidenceForAlert(numericId));
      setLoading(false);
    };

    fetchAlertData();
  }, [id]);

  const handleTriggerAnalysis = async () => {
    if (!alert) return;
    setAnalyzing(true);
    try {
      const res = await alertService.analyzeAlert(alert.id);
      if (res && res.summary) {
        setAnalysis(res);
      } else {
        setAnalysis(getMockAnalysisForAlert(alert.id));
      }
    } catch {
      // Graceful fallback to mock synthesis
      setAnalysis(getMockAnalysisForAlert(alert.id));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalystDecision = (action: string) => {
    setDecision(action);
    setDecisionFeedback(
      `Analyst action recorded in dev session: ${action.toUpperCase()} — (UI simulation: will persist upon backend endpoint availability).`
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
      <div className="card p-12 text-center text-zinc-400">
        Alert telemetry record not found.
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
              to="/investigation"
              className="btn btn-primary text-xs flex items-center gap-1.5"
            >
              <SearchCode className="w-3.5 h-3.5" />
              <span>Open Investigation Workspace</span>
            </Link>
          </div>
        }
      />

      <MockDataDisclaimer
        label="MOCK / DEVELOPMENT DATA"
        detail="Alert telemetry and AI analysis synthesized in development mode — Real Wazuh SIEM collector and vector DB integration pending."
      />

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

            {/* Network Context */}
            <div className="space-y-2 text-xs">
              <span className="font-mono text-[10px] text-cyan-400 uppercase tracking-wider font-semibold">
                Network & Transport
              </span>
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Source:</span>
                  <span className="text-zinc-200">{context?.network.source_ip || alert.source_ip || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Destination:</span>
                  <span className="text-zinc-200">{context?.network.destination_ip || alert.destination_ip || '10.0.1.5'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Protocol / Port:</span>
                  <span className="text-zinc-200">
                    {context?.network.protocol || 'TCP'} : {context?.network.port || 22}
                  </span>
                </div>
                {context?.network.connection_info && (
                  <p className="pt-1 text-[11px] text-zinc-400 border-t border-zinc-800/60 font-sans">
                    {context.network.connection_info}
                  </p>
                )}
              </div>
            </div>

            {/* Execution Context */}
            <div className="space-y-2 text-xs">
              <span className="font-mono text-[10px] text-cyan-400 uppercase tracking-wider font-semibold">
                Execution & Process Lineage
              </span>
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Process:</span>
                  <span className="text-zinc-200">{context?.execution.process || '/usr/sbin/sshd'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Parent:</span>
                  <span className="text-zinc-200">{context?.execution.parent_process || 'systemd (PID 1)'}</span>
                </div>
                <div className="pt-1 text-[11px] text-zinc-400">
                  <span className="text-zinc-500 block text-[10px]">Command Line:</span>
                  <code className="text-emerald-400/90 break-all">
                    {context?.execution.command || 'sshd: root [net]'}
                  </code>
                </div>
              </div>
            </div>

            {/* Threat Intelligence Linkage */}
            <div className="space-y-2 text-xs">
              <span className="font-mono text-[10px] text-cyan-400 uppercase tracking-wider font-semibold">
                Threat Intel & MITRE ATT&CK
              </span>
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-2 font-mono">
                <div>
                  <span className="text-zinc-500 text-[10px] block">Mapped Techniques:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {context?.intelligence.mitre_techniques?.map((tech, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-zinc-800 text-rose-300 border border-rose-500/30 text-[11px]"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
                {context?.intelligence.cve_ids && context.intelligence.cve_ids.length > 0 && (
                  <div className="pt-1">
                    <span className="text-zinc-500 text-[10px] block">Related Vulnerabilities:</span>
                    <span className="text-amber-400 text-xs">
                      {context.intelligence.cve_ids.join(', ')}
                    </span>
                  </div>
                )}
                {context?.intelligence.reputation && (
                  <div className="pt-1 text-[11px] text-zinc-400 font-sans">
                    {context.intelligence.reputation}
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
                    Model: {analysis?.model_name || 'SecOps-RAG-Mistral-7B'}
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

            {/* Confidence Meter */}
            <ConfidenceMeter
              confidence={analysis?.confidence || '0.94'}
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
                  {analysis?.summary || 'Automated analysis in progress...'}
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
                    {(analysis as Analysis & { suspected_attack?: string })?.suspected_attack ||
                      'MITRE ATT&CK T1110.001'}
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
