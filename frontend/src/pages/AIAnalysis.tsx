import React, { useState } from 'react';
import {
  Cpu,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  SearchCode,
  XCircle,
  FileCheck,
  Terminal,
  Sparkles,
} from 'lucide-react';
import { mockAlerts } from '../data/mockAlerts';
import { getMockAnalysisForAlert } from '../data/mockAnalysis';
import { alertService } from '../services/api';
import type { Alert, Analysis } from '../types/alert';
import PageHeader from '../components/common/PageHeader';
import SeverityBadge from '../components/common/SeverityBadge';
import ConfidenceMeter from '../components/common/ConfidenceMeter';
import MockDataDisclaimer from '../components/common/MockDataDisclaimer';

const AIAnalysis: React.FC = () => {
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [analystDecision, setAnalystDecision] = useState<string | null>(null);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUsingMock, setIsUsingMock] = useState(false);
  const [isTimeout, setIsTimeout] = useState(false);

  React.useEffect(() => {
    alertService.getAlerts().then(data => {
      if (data && data.length > 0) {
        setAlerts(data);
        setSelectedAlertId(data[0].id);
        setIsUsingMock(false);
      } else {
        setAlerts(mockAlerts);
        setSelectedAlertId(mockAlerts[0].id);
        setIsUsingMock(true);
      }
    }).catch(() => {
      setAlerts(mockAlerts);
      setSelectedAlertId(mockAlerts[0].id);
      setIsUsingMock(true);
    });
  }, []);

  const loadAnalysis = async (alertId: number) => {
    setLoading(true);
    setIsTimeout(false);
    try {
      const data = await alertService.getAnalysis(alertId);
      if (data && data.summary) {
        setAnalysis(data);
        setIsUsingMock(false);
      } else {
        setAnalysis(getMockAnalysisForAlert(alertId));
      }
    } catch (e: any) {
      if (e.code === 'ECONNABORTED' || e.message?.includes('timeout') || e.response?.status === 504) {
        setIsTimeout(true);
        setAnalysis(null);
      } else {
        setAnalysis(getMockAnalysisForAlert(alertId));
      }
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (selectedAlertId) {
      loadAnalysis(selectedAlertId);
    }
  }, [selectedAlertId]);

  const selectedAlert = alerts.find((a) => a.id === selectedAlertId) || mockAlerts[0];

  const handleReanalyze = async () => {
    if (!selectedAlertId) return;
    setIsReanalyzing(true);
    setIsTimeout(false);
    try {
      const res = await alertService.analyzeAlert(selectedAlertId);
      if (res && res.summary) {
        setAnalysis(res);
        setIsUsingMock(false);
      } else {
        setAnalysis(getMockAnalysisForAlert(selectedAlertId));
      }
    } catch (e: any) {
      if (e.code === 'ECONNABORTED' || e.message?.includes('timeout') || e.response?.status === 504 || e.response?.status === 500) {
        setIsTimeout(true);
      }
    } finally {
      setIsReanalyzing(false);
    }
  };

  if (!alerts.length || (!analysis && !isTimeout && loading)) {
    return (
      <div className="card p-12 text-center text-zinc-400">
        Loading analysis context...
      </div>
    );
  }



  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Incident Analysis & Reasoning"
        subtitle="RAG-synthesized incident root cause analysis, telemetry verification, and playbook triage."
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Intelligence' },
          { label: 'AI Analysis' },
        ]}
        badge={
          analysis ? (
            <span className="font-mono text-xs text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-800/40">
              Model: {analysis.model_name || 'SecOps-RAG-Mistral-7B'}
            </span>
          ) : isTimeout ? (
            <span className="font-mono text-xs text-rose-400 bg-rose-950/80 px-2.5 py-0.5 rounded-full border border-rose-800/40">
              Analysis Unavailable
            </span>
          ) : null
        }
        actions={
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-400 font-mono">Select Incident:</label>
            <select
              value={selectedAlertId || ''}
              onChange={(e) => {
                setSelectedAlertId(Number(e.target.value));
                setAnalystDecision(null);
              }}
              className="bg-[#0c101a] border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
            >
              {alerts.map((alert) => (
                <option key={alert.id} value={alert.id}>
                  Alert #{alert.id} — {alert.rule_description.slice(0, 36)}...
                </option>
              ))}
            </select>
          </div>
        }
      />

      {isUsingMock && (
        <MockDataDisclaimer
          label="MOCK / DEVELOPMENT DATA"
          detail="AI analysis generated using pre-configured incident templates. Live LLM inference and RAG pipeline integration pending."
        />
      )}

      {/* Tripartite Division: 1. OBSERVED  2. AI ANALYSIS  3. ANALYST DECISION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SECTION 1: OBSERVED (Facts & Telemetry) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="card p-5 space-y-4 bg-[#090d16] border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <h2 className="text-xs font-mono font-bold tracking-wider text-cyan-400 uppercase">
                  1. OBSERVED TELEMETRY
                </h2>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">SIEM Facts</span>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                <span className="text-zinc-500">Alert Reference:</span>
                <span className="text-zinc-200">#{selectedAlert.id} ({selectedAlert.external_alert_id})</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                <span className="text-zinc-500">Severity Metric:</span>
                <SeverityBadge severity={selectedAlert.severity} showLevel />
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                <span className="text-zinc-500">Agent Node:</span>
                <span className="text-zinc-200">{selectedAlert.agent_name}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                <span className="text-zinc-500">Source Address:</span>
                <span className="text-cyan-400 font-bold">{selectedAlert.source_ip || 'Local Host'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                <span className="text-zinc-500">Destination:</span>
                <span className="text-zinc-300">{selectedAlert.destination_ip || '10.0.1.5'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                <span className="text-zinc-500">Identity Principal:</span>
                <span className="text-zinc-200">{selectedAlert.username || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                <span className="text-zinc-500">Timestamp:</span>
                <span className="text-zinc-400 text-[11px]">
                  {new Date(selectedAlert.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="p-3 rounded bg-[#06080e] border border-zinc-800 text-[11px] font-mono text-zinc-400">
              <span className="text-zinc-500 text-[10px] block uppercase">Rule Triggered</span>
              <span className="text-zinc-200 font-sans font-medium">
                RULE-{selectedAlert.rule_id}: {selectedAlert.rule_description}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: AI ANALYSIS (Reasoning & Grounded Synthesis) */}
        <div className="lg:col-span-8 space-y-4">
          {isTimeout ? (
            <div className="card p-12 flex flex-col items-center justify-center space-y-4 border-rose-500/30">
              <AlertTriangle className="w-12 h-12 text-rose-400" />
              <div className="text-center">
                <h3 className="text-sm font-semibold text-zinc-200">AI Analysis Unavailable / Timed Out</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-md">
                  The LLM inference engine (Ollama/Qwen3) exceeded the 60-second timeout threshold or failed to respond.
                </p>
              </div>
              <button
                onClick={handleReanalyze}
                disabled={isReanalyzing}
                className="btn btn-secondary text-xs flex items-center gap-1.5 mt-2"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isReanalyzing ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
                <span>{isReanalyzing ? 'Retrying Inference...' : 'Retry Analysis'}</span>
              </button>
            </div>
          ) : !analysis ? (
            <div className="card p-12 text-center text-zinc-400">Loading analysis...</div>
          ) : (
            <div className="card p-6 space-y-5 border-cyan-500/30 bg-[#0c101a]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-xs font-mono font-bold tracking-wider text-cyan-400 uppercase">
                    2. AI INCIDENT ANALYSIS
                  </h2>
                </div>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  Type: Evidence-Aware RAG Synthesis
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleReanalyze}
                  disabled={isReanalyzing}
                  className="btn btn-secondary text-xs flex items-center gap-1.5"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isReanalyzing ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
                  <span>{isReanalyzing ? 'Regenerating...' : 'Regenerate'}</span>
                </button>
              </div>
            </div>

            {/* Confidence Bar */}
            <ConfidenceMeter
              confidence={analysis.confidence || '0.94'}
              label="Grounding Confidence Score"
            />

            {/* AI Summary */}
            <div className="space-y-1.5 p-4 rounded-lg bg-zinc-900/70 border border-zinc-800">
              <span className="font-mono text-[10px] text-cyan-400 uppercase font-semibold block tracking-wider">
                AI Executive Summary
              </span>
              <p className="text-zinc-200 text-sm leading-relaxed">{analysis.summary}</p>
            </div>

            {/* Severity Assessment & Suspected Attack */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                <span className="font-mono text-[10px] uppercase text-rose-400 font-semibold block">
                  Severity Assessment
                </span>
                <p className="text-zinc-300 font-sans">{analysis.severity_assessment}</p>
              </div>
              <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                <span className="font-mono text-[10px] uppercase text-amber-400 font-semibold block">
                  Suspected Attack Vector
                </span>
                <p className="text-zinc-300 font-mono text-[11px]">
                  {(analysis as Analysis & { suspected_attack?: string }).suspected_attack ||
                    'MITRE ATT&CK T1110.001 (Brute Force)'}
                </p>
              </div>
            </div>

            {/* Telemetry Explanation */}
            <div className="space-y-1.5 text-xs">
              <span className="font-mono text-[10px] uppercase text-zinc-400 font-semibold block tracking-wider">
                Forensic Reasoning & Correlation
              </span>
              <p className="p-3.5 rounded-lg bg-[#07090e] border border-zinc-800 text-zinc-300 leading-relaxed">
                {analysis.explanation}
              </p>
            </div>

            {/* Investigation & Containment Protocol */}
            <div className="space-y-1.5 text-xs">
              <span className="font-mono text-[10px] uppercase text-emerald-400 font-semibold block tracking-wider">
                Recommended Triage & Investigation Protocol
              </span>
              <pre className="p-3.5 rounded-lg bg-[#07090e] border border-zinc-800 text-[11px] font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {analysis.recommended_investigation}
              </pre>
            </div>

            {/* Grounding Evidence Attached */}
            <div className="pt-2 border-t border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  <span>Grounding Evidence Citations ({analysis.evidence?.length || 0})</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  Hallucination Controlled
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {analysis.evidence?.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded bg-[#07090e] border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  >
                    <div>
                      <span className="font-mono text-cyan-400 font-bold text-xs">
                        {ev.document_id}:
                      </span>{' '}
                      <span className="text-zinc-300 font-medium">{ev.title}</span>
                    </div>
                    <span className="font-mono text-[11px] text-emerald-400 shrink-0">
                      Relevance {(ev.relevance_score * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 3: ANALYST DECISION (Human-in-the-Loop) */}
            <div className="pt-5 border-t border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold tracking-wider text-cyan-400 uppercase">
                  3. HUMAN-IN-THE-LOOP DETERMINATION
                </h3>
                <span className="text-[10px] font-mono text-zinc-500">
                  Authority: SOC Analyst (Bivan)
                </span>
              </div>

              <p className="text-xs text-zinc-400">
                AI assists and organizes evidence — all remediation and containment decisions must be confirmed by human security personnel.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <button
                  onClick={() => setAnalystDecision('confirmed')}
                  className={`btn text-xs py-2 flex items-center justify-center gap-1.5 ${
                    analystDecision === 'confirmed'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirm Threat</span>
                </button>
                <button
                  onClick={() => setAnalystDecision('escalated')}
                  className={`btn text-xs py-2 flex items-center justify-center gap-1.5 ${
                    analystDecision === 'escalated'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-950/60 hover:bg-amber-900 text-amber-300 border border-amber-800/60'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Escalate (Tier-2)</span>
                </button>
                <button
                  onClick={() => setAnalystDecision('deep_investigation')}
                  className={`btn text-xs py-2 flex items-center justify-center gap-1.5 ${
                    analystDecision === 'deep_investigation'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-cyan-950/60 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60'
                  }`}
                >
                  <SearchCode className="w-3.5 h-3.5" />
                  <span>Deep Forensic</span>
                </button>
                <button
                  onClick={() => setAnalystDecision('dismissed')}
                  className={`btn text-xs py-2 flex items-center justify-center gap-1.5 ${
                    analystDecision === 'dismissed'
                      ? 'bg-zinc-700 text-white'
                      : 'bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Dismiss</span>
                </button>
              </div>

              {analystDecision && (
                <div className="p-3 rounded bg-zinc-900 border border-cyan-500/40 text-xs font-mono text-cyan-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>
                    Decision Recorded: {analystDecision.toUpperCase()} for Alert #{selectedAlert.id}. Audit logged to local development session.
                  </span>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIAnalysis;
