import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  Cpu,
  Layers,
  Terminal,
  Activity,
  UserCheck,
  AlertTriangle,
  XCircle,
  Lock,
} from 'lucide-react';
import { mockInvestigations } from '../data/mockInvestigations';
import PageHeader from '../components/common/PageHeader';
import SeverityBadge from '../components/common/SeverityBadge';
import StatusBadge from '../components/common/StatusBadge';
import ConfidenceMeter from '../components/common/ConfidenceMeter';
import MockDataDisclaimer from '../components/common/MockDataDisclaimer';

const Investigation: React.FC = () => {
  const [selectedInvId, setSelectedInvId] = useState<string>('INV-2026-001');
  const [activeTab, setActiveTab] = useState<'overview' | 'telemetry' | 'context' | 'evidence' | 'ai'>('overview');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const currentInv = mockInvestigations.find((inv) => inv.id === selectedInvId) || mockInvestigations[0];
  const { alert, timeline, analysis } = currentInv;

  const handleAction = (type: string) => {
    setActionSuccess(
      `Decision '${type.toUpperCase()}' registered by analyst for ${currentInv.id}. Notes appended to audit trail. (Simulated in development session)`
    );
  };

  const getTimelineStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-cyan-400 animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-zinc-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-zinc-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <PageHeader
        title="Incident Investigation Workspace"
        subtitle="Analyst triage terminal with multi-stage verification pipeline and AI-grounded evidence chain."
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Investigations', href: '/investigation' },
          { label: currentInv.id },
        ]}
        badge={
          <span className="font-mono text-xs text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-800/40">
            Case {currentInv.id}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-400 font-mono">Active Case:</label>
            <select
              value={selectedInvId}
              onChange={(e) => {
                setSelectedInvId(e.target.value);
                setActionSuccess(null);
              }}
              className="bg-[#0c101a] border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
            >
              {mockInvestigations.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.id} — {inv.alert.rule_description.slice(0, 32)}...
                </option>
              ))}
            </select>
          </div>
        }
      />

      <MockDataDisclaimer
        label="MOCK / DEVELOPMENT DATA"
        detail="Investigation pipeline workflow and incident cases operating in demonstration mode."
      />

      {/* Primary Investigation Dashboard Header */}
      <div className="card p-5 bg-[#090d16] border-zinc-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-zinc-200">
                {currentInv.id}
              </span>
              <SeverityBadge severity={alert.severity} showLevel />
              <StatusBadge status={currentInv.status} />
            </div>
            <h2 className="text-base font-semibold text-zinc-100">{alert.rule_description}</h2>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-400 pt-1">
              <span>Agent: <strong className="text-zinc-200">{alert.agent_name}</strong></span>
              <span>Source: <strong className="text-cyan-400">{alert.source_ip || 'internal'}</strong></span>
              <span>User: <strong className="text-zinc-200">{alert.username || 'system'}</strong></span>
              <span>Analyst: <strong className="text-zinc-300">{currentInv.analyst}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <ConfidenceMeter
              confidence={analysis?.confidence || '0.94'}
              label="Pipeline Confidence"
              className="w-48"
            />
          </div>
        </div>
      </div>

      {/* Main Multi-Panel Analyst Workstation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel: 7-Stage Investigation Pipeline */}
        <div className="lg:col-span-4 space-y-4">
          <div className="card p-5 space-y-4 bg-[#0c101a]">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-zinc-200">Investigation Pipeline</h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 uppercase">7 Stages</span>
            </div>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
              {timeline.map((step, idx) => {
                const isCurrent = step.status === 'in_progress';
                return (
                  <div key={idx} className="relative group">
                    {/* Step Icon Indicator */}
                    <div
                      className={`absolute -left-6 top-0 w-4 h-4 rounded-full bg-[#0c101a] flex items-center justify-center ${
                        isCurrent ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-[#0c101a]' : ''
                      }`}
                    >
                      {getTimelineStatusIcon(step.status)}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={`font-mono font-medium ${
                            isCurrent
                              ? 'text-cyan-400 font-bold'
                              : step.status === 'completed'
                              ? 'text-zinc-200'
                              : 'text-zinc-400'
                          }`}
                        >
                          {step.label}
                        </span>
                        <span
                          className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded ${
                            step.status === 'completed'
                              ? 'text-emerald-400 bg-emerald-950/60'
                              : step.status === 'in_progress'
                              ? 'text-cyan-400 bg-cyan-950/80 animate-pulse'
                              : 'text-zinc-400 bg-zinc-800'
                          }`}
                        >
                          {step.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 font-sans leading-tight">
                        {step.description}
                      </p>
                      {step.timestamp && (
                        <span className="text-[10px] font-mono text-zinc-400 block pt-0.5">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel: Workspace Tabs & Investigation Dossier */}
        <div className="lg:col-span-8 space-y-4">
          <div className="card p-0 overflow-hidden bg-[#0c101a]">
            {/* Tab Navigation */}
            <div className="flex border-b border-zinc-800 overflow-x-auto bg-[#090d16] px-4 pt-2">
              {[
                { id: 'overview', label: 'Triage Overview', icon: Layers },
                { id: 'ai', label: 'AI Incident Analysis', icon: Cpu },
                { id: 'evidence', label: 'Evidence Chain', icon: FileCheck },
                { id: 'context', label: 'Security Context', icon: Activity },
                { id: 'telemetry', label: 'Raw Telemetry', icon: Terminal },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                      isActive
                        ? 'border-cyan-400 text-cyan-300 bg-zinc-800/40'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Contents */}
            <div className="p-5">
              {/* Tab 1: Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-5 text-xs">
                  <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-400 font-semibold block">
                      Incident Summary
                    </span>
                    <p className="text-zinc-200 leading-relaxed text-sm">
                      {analysis?.summary || 'Incident triage initiated.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-[#090d16] border border-zinc-800 space-y-2">
                      <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider block font-semibold">
                        Host Node Telemetry
                      </span>
                      <div className="space-y-1 font-mono text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Hostname:</span>
                          <span className="text-zinc-300">{alert.agent_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Source IP:</span>
                          <span className="text-cyan-400">{alert.source_ip || 'Local / N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Target IP:</span>
                          <span className="text-zinc-300">{alert.destination_ip || '10.0.1.5'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-[#090d16] border border-zinc-800 space-y-2">
                      <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider block font-semibold">
                        Detection Metrics
                      </span>
                      <div className="space-y-1 font-mono text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Rule ID:</span>
                          <span className="text-zinc-200">RULE-{alert.rule_id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Severity Rating:</span>
                          <span className="text-rose-400 font-bold">{alert.severity} / 15</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Classification:</span>
                          <span className="text-zinc-300">Wazuh Sysmon Telemetry</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Playbook Containment Recommendations */}
                  <div className="p-4 rounded-lg bg-[#090d16] border border-zinc-800 space-y-2">
                    <span className="font-mono text-[10px] text-emerald-400 uppercase tracking-wider block font-semibold">
                      Prescribed Containment Protocol
                    </span>
                    <pre className="text-zinc-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                      {analysis?.recommended_investigation ||
                        '1. Isolate endpoint from subnet.\n2. Invalidate active sessions.\n3. Verify integrity of authentication configurations.'}
                    </pre>
                  </div>
                </div>
              )}

              {/* Tab 2: AI Analysis */}
              {activeTab === 'ai' && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-200">
                        AI Reasoning & Threat Assessment
                      </h4>
                      <p className="text-[11px] text-zinc-400 font-mono">
                        Model: {analysis?.model_name || 'SecOps-RAG-Mistral-7B / Baseline-v1'}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-800/40">
                      Grounded in Authoritative Evidence
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                      <span className="font-mono text-[10px] uppercase text-rose-400 font-semibold block">
                        Severity Assessment
                      </span>
                      <p className="text-zinc-300">{analysis?.severity_assessment}</p>
                    </div>

                    <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                      <span className="font-mono text-[10px] uppercase text-cyan-400 font-semibold block">
                        Detailed Explanation
                      </span>
                      <p className="text-zinc-300 leading-relaxed">{analysis?.explanation}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Evidence */}
              {activeTab === 'evidence' && (
                <div className="space-y-3 text-xs">
                  <span className="text-[11px] font-mono text-zinc-400 block mb-2">
                    Retrieved authoritative documents used for grounding this incident:
                  </span>
                  {analysis?.evidence && analysis.evidence.length > 0 ? (
                    analysis.evidence.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-4 rounded-lg bg-[#090d16] border border-zinc-800 space-y-2 font-sans"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-cyan-400 font-bold">
                            {ev.document_id} — {ev.title}
                          </span>
                          <span className="font-mono text-[11px] text-emerald-400">
                            Relevance: {(ev.relevance_score * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-zinc-300 text-xs leading-relaxed">{ev.content}</p>
                        <div className="pt-2 border-t border-zinc-800/60 text-[11px] font-mono text-zinc-500">
                          Citation: {ev.citation}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-zinc-500">
                      No grounding evidence attached.
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Security Context */}
              {activeTab === 'context' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2">
                    <span className="text-[10px] text-cyan-400 uppercase font-semibold block">
                      Execution Lineage
                    </span>
                    <div className="space-y-1 text-zinc-300">
                      <div>Process: /usr/sbin/sshd</div>
                      <div>Command: sshd: root [net]</div>
                      <div>Parent: systemd (PID 1)</div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2">
                    <span className="text-[10px] text-cyan-400 uppercase font-semibold block">
                      Intelligence Mapping
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-rose-300 border border-rose-500/30">
                        MITRE T1110.001 - Password Guessing
                      </span>
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-amber-300 border border-amber-500/30">
                        CVE-2024-6387 (RegreSSHion Review)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 5: Raw Telemetry */}
              {activeTab === 'telemetry' && (
                <div className="space-y-3">
                  <span className="text-[11px] font-mono text-zinc-400 block">
                    Normalized JSON Representation (Schema Canonical Contract):
                  </span>
                  <pre className="p-4 rounded-lg bg-black/70 border border-zinc-800 text-[11px] font-mono text-emerald-400 overflow-x-auto">
                    {JSON.stringify(alert, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Analyst Decision & Response Action Console */}
            <div className="p-5 border-t border-zinc-800 bg-[#090d16] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-zinc-200">
                    Analyst Final Incident Determination
                  </span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">
                  Human-in-the-Loop Safeguard
                </span>
              </div>

              <textarea
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Optional notes for containment log, ticket linkage, or peer review..."
                className="w-full h-16 p-2.5 rounded-lg bg-[#07090e] border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 font-mono resize-none"
              />

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleAction('confirm_contain')}
                  className="btn btn-primary text-xs flex items-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Confirm Threat & Contain Host</span>
                </button>
                <button
                  onClick={() => handleAction('escalate_tier2')}
                  className="btn btn-secondary text-xs flex items-center gap-2 text-amber-400 border-amber-500/40"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Escalate to Tier 2</span>
                </button>
                <button
                  onClick={() => handleAction('dismiss_false_positive')}
                  className="btn btn-secondary text-xs flex items-center gap-2 text-zinc-400"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Dismiss as False Positive</span>
                </button>
              </div>

              {actionSuccess && (
                <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-xs font-mono text-emerald-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Investigation;
