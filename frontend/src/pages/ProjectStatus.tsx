import React from 'react';
import type { ProjectModule } from '../types/alert';
import PageHeader from '../components/common/PageHeader';
import MockDataDisclaimer from '../components/common/MockDataDisclaimer';

const ProjectStatus: React.FC = () => {
  const modules: ProjectModule[] = [
    {
      name: 'Frontend SOC Assistant Interface',
      status: 'implemented',
      owner: 'Bivan (Frontend Architect)',
      description:
        'Complete React/Vite/TypeScript application shell, real-time alert triage table, forensic investigation workspace, and command palette.',
    },
    {
      name: 'Backend API Gateway (FastAPI)',
      status: 'implemented',
      owner: 'Backend Team',
      description:
        'FastAPI REST server providing /api/v1/alerts, /api/v1/alerts/:id, /analyze, and /health endpoints.',
    },
    {
      name: 'PostgreSQL Relational Schema',
      status: 'implemented',
      owner: 'Backend Team',
      description:
        'Alembic migrations and SQLAlchemy ORM models persisting Alert and Analysis records.',
    },
    {
      name: 'Alert Normalization Engine',
      status: 'implemented',
      owner: 'Data Engineering',
      description:
        'Standardizes raw SIEM json payload into canonical schema (IPs, users, timestamps, severity).',
    },
    {
      name: 'Security Context Extraction',
      status: 'implemented',
      owner: 'Context Specialist',
      description:
        'Enriches alerts with host network topology, process lineage, and agent metadata.',
    },
    {
      name: 'Pretrained LLM Incident Reasoning',
      status: 'in_progress',
      owner: 'AI Engineer',
      description:
        'Fine-tuning and prompting of local Mistral-7B model for security root cause analysis.',
    },
    {
      name: 'Evidence Grounding Pipeline (RAG)',
      status: 'in_progress',
      owner: 'AI Engineer',
      description:
        'Chunking and semantic indexing of NIST SP 800-61 and MITRE Enterprise Matrix.',
    },
    {
      name: 'Live Wazuh SIEM Collector Sync',
      status: 'integration_pending',
      owner: 'SIEM Integration',
      description:
        'Direct connection to production Wazuh API server and active queue subscriber.',
    },
    {
      name: 'Qdrant Vector Database Cluster',
      status: 'integration_pending',
      owner: 'Infrastructure',
      description:
        'Dedicated high-dimensional vector index for fast semantic similarity search.',
    },
    {
      name: 'Automated Evaluation Harness',
      status: 'not_started',
      owner: 'Research Lead',
      description:
        'Automated synthetic test bench evaluating hallucination rates and grounding precision.',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'implemented':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            IMPLEMENTED
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            IN PROGRESS
          </span>
        );
      case 'integration_pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium text-amber-400 bg-amber-950/80 border border-amber-800/60 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            INTEGRATION PENDING
          </span>
        );
      case 'not_started':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium text-zinc-400 bg-zinc-800/80 border border-zinc-700 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            NOT STARTED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Implementation Matrix"
        subtitle="Transparent tracking of core architecture modules across frontend, backend, AI pipelines, and SIEM infrastructure."
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Platform' },
          { label: 'Project Status' },
        ]}
        badge={
          <span className="font-mono text-xs text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-800/40">
            Sprint Phase: Active Build
          </span>
        }
      />

      <MockDataDisclaimer
        label="REAL PROJECT STATUS"
        detail="Reflects verifiable code implementation inside the shared repository without fabricated percentages."
      />

      {/* Summary KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block">
            Implemented
          </span>
          <span className="text-2xl font-bold font-mono text-zinc-100 mt-1 block">5</span>
          <span className="text-[11px] text-zinc-500">Core Modules</span>
        </div>
        <div className="card p-4 text-center">
          <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">
            In Progress
          </span>
          <span className="text-2xl font-bold font-mono text-zinc-100 mt-1 block">2</span>
          <span className="text-[11px] text-zinc-500">Active Pipeline</span>
        </div>
        <div className="card p-4 text-center">
          <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider block">
            Integration Pending
          </span>
          <span className="text-2xl font-bold font-mono text-zinc-100 mt-1 block">2</span>
          <span className="text-[11px] text-zinc-500">SIEM & Vector DB</span>
        </div>
        <div className="card p-4 text-center">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
            Not Started
          </span>
          <span className="text-2xl font-bold font-mono text-zinc-100 mt-1 block">1</span>
          <span className="text-[11px] text-zinc-500">Benchmarking</span>
        </div>
      </div>

      {/* Modules Table */}
      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-[#0a0e17]">
          <h2 className="text-sm font-semibold text-zinc-100">
            System Component Breakdown & Team Ownership
          </h2>
        </div>

        <div className="divide-y divide-zinc-800/60 text-xs">
          {modules.map((mod, i) => (
            <div
              key={i}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-zinc-800/30 transition-colors"
            >
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-sm text-zinc-200">{mod.name}</h3>
                  {mod.owner && (
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                      {mod.owner}
                    </span>
                  )}
                </div>
                <p className="text-zinc-400 font-sans text-xs leading-relaxed">
                  {mod.description}
                </p>
              </div>

              <div className="shrink-0">{getStatusBadge(mod.status)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectStatus;
