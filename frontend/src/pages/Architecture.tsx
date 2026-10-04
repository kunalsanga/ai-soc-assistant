import React, { useState } from 'react';
import { Layers, ArrowDown } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import MockDataDisclaimer from '../components/common/MockDataDisclaimer';

interface ArchitectureNode {
  id: string;
  name: string;
  layer: 'frontend' | 'backend' | 'security' | 'ai' | 'data' | 'analyst';
  status: 'implemented' | 'in_progress' | 'integration_pending';
  endpoint?: string;
  description: string;
  ownership: string;
}

const Architecture: React.FC = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('frontend_ui');

  const nodes: ArchitectureNode[] = [
    {
      id: 'frontend_ui',
      name: 'Vite / React Enterprise Dashboard',
      layer: 'frontend',
      status: 'implemented',
      endpoint: 'http://localhost:5173',
      description:
        'Frontend interface constructed by Bivan. Features responsive workstation, 7-stage investigation pipeline, and Ctrl+K command palette.',
      ownership: 'Bivan (Frontend Owner)',
    },
    {
      id: 'fastapi_backend',
      name: 'FastAPI Service Gateway',
      layer: 'backend',
      status: 'implemented',
      endpoint: 'http://localhost:8000/api/v1',
      description:
        'Backend REST API hosting endpoints for alerts, AI analysis triggers, and health checks.',
      ownership: 'Backend Team',
    },
    {
      id: 'wazuh_agent',
      name: 'Wazuh SIEM Ingestion Client',
      layer: 'security',
      status: 'integration_pending',
      endpoint: '/api/v1/alerts/sync',
      description:
        'Connects to Wazuh SIEM Manager to ingest raw agent security events into the normalization queue.',
      ownership: 'Security / SIEM Integration',
    },
    {
      id: 'normalization_engine',
      name: 'Alert Normalization & Parsing',
      layer: 'security',
      status: 'implemented',
      description:
        'Extracts canonical Alert schema (IPs, users, timestamps, rule severity) from disparate syslog and Sysmon streams.',
      ownership: 'Data Ingestion Team',
    },
    {
      id: 'context_extractor',
      name: 'Security Context Extractor',
      layer: 'security',
      status: 'implemented',
      description:
        'Enriches alerts with host telemetry, network topology, parent process lineage, and initial MITRE mapping.',
      ownership: 'Context Extraction Owner',
    },
    {
      id: 'rag_retrieval',
      name: 'Dense Vector RAG (Qdrant)',
      layer: 'ai',
      status: 'integration_pending',
      description:
        'Queries vectorized NIST SP 800-61, MITRE ATT&CK Enterprise Matrix, and SecOps SOP playbooks for semantic grounding.',
      ownership: 'AI / RAG Owner',
    },
    {
      id: 'llm_inference',
      name: 'Pretrained LLM Reasoner (Mistral-7B)',
      layer: 'ai',
      status: 'in_progress',
      description:
        'Performs root cause synthesis, attack vector categorization, and containment step formatting based strictly on retrieved evidence.',
      ownership: 'AI Model Team',
    },
    {
      id: 'postgres_db',
      name: 'PostgreSQL Relational Store',
      layer: 'data',
      status: 'implemented',
      endpoint: 'postgresql://.../ai_soc',
      description:
        'Persists canonical alerts, investigation state, audit logs, and evidence citations.',
      ownership: 'Database Architect',
    },
    {
      id: 'soc_analyst',
      name: 'SOC Analyst (Human-in-the-Loop)',
      layer: 'analyst',
      status: 'implemented',
      description:
        'Evaluates AI recommendations, checks evidence citations, and signs off on host containment or escalation.',
      ownership: 'Human Duty Analyst',
    },
  ];

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  const layerColors = {
    frontend: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/40',
    backend: 'text-blue-400 border-blue-500/40 bg-blue-950/40',
    security: 'text-rose-400 border-rose-500/40 bg-rose-950/40',
    ai: 'text-purple-400 border-purple-500/40 bg-purple-950/40',
    data: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40',
    analyst: 'text-amber-400 border-amber-500/40 bg-amber-950/40',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Architecture & Pipeline Topology"
        subtitle="End-to-end dataflow diagram from Wazuh event collection through AI RAG grounding to human analyst sign-off."
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Platform' },
          { label: 'Architecture' },
        ]}
        badge={
          <span className="font-mono text-xs text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-800/40">
            Topology v2.0
          </span>
        }
      />

      <MockDataDisclaimer
        label="ARCHITECTURAL BLUEPRINT"
        detail="Component status flags represent actual implementation status across team sub-modules."
      />

      {/* Interactive Topology Graph Flow */}
      <div className="card p-6 bg-[#090d16] border-zinc-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-zinc-200">
              Interactive Component Topology
            </h2>
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            Click any component node to inspect specifications
          </span>
        </div>

        {/* Visual Pipeline Grid */}
        <div className="space-y-4">
          {/* Row 1: Collection & Ingestion Layer */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">
              1. Ingestion & Security Telemetry
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {nodes.slice(2, 5).map((node) => (
                <button
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedNodeId === node.id
                      ? 'border-cyan-400 bg-cyan-950/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                      : 'border-zinc-800 bg-[#0c101a] hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-zinc-200">
                      {node.name}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        node.status === 'implemented'
                          ? 'bg-emerald-400'
                          : node.status === 'in_progress'
                          ? 'bg-cyan-400'
                          : 'bg-amber-400'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 mt-1 block">
                    {node.ownership}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-center text-zinc-600">
            <ArrowDown className="w-5 h-5" />
          </div>

          {/* Row 2: AI & Retrieval Layer */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">
              2. Evidence Grounding & AI Analysis
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {nodes.slice(5, 7).map((node) => (
                <button
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedNodeId === node.id
                      ? 'border-cyan-400 bg-cyan-950/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                      : 'border-zinc-800 bg-[#0c101a] hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-zinc-200">
                      {node.name}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        node.status === 'implemented'
                          ? 'bg-emerald-400'
                          : node.status === 'in_progress'
                          ? 'bg-cyan-400'
                          : 'bg-amber-400'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 mt-1 block">
                    {node.ownership}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-center text-zinc-600">
            <ArrowDown className="w-5 h-5" />
          </div>

          {/* Row 3: Platform & Frontend Decision Layer */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">
              3. Platform Core & Human Verification
            </span>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[nodes[1], nodes[7], nodes[0], nodes[8]].map((node) => (
                <button
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedNodeId === node.id
                      ? 'border-cyan-400 bg-cyan-950/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                      : 'border-zinc-800 bg-[#0c101a] hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-zinc-200 truncate">
                      {node.name}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        node.status === 'implemented'
                          ? 'bg-emerald-400'
                          : node.status === 'in_progress'
                          ? 'bg-cyan-400'
                          : 'bg-amber-400'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 mt-1 block truncate">
                    {node.ownership}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Component Dossier Panel */}
        <div className="p-5 rounded-xl bg-[#06080e] border border-zinc-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-800 pb-3">
            <div>
              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${layerColors[selectedNode.layer]}`}>
                Layer: {selectedNode.layer}
              </span>
              <h3 className="text-base font-bold text-zinc-100 mt-1">{selectedNode.name}</h3>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-zinc-500">Status:</span>
              <span
                className={`font-semibold uppercase ${
                  selectedNode.status === 'implemented'
                    ? 'text-emerald-400'
                    : selectedNode.status === 'in_progress'
                    ? 'text-cyan-400'
                    : 'text-amber-400'
                }`}
              >
                {selectedNode.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed font-sans">{selectedNode.description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono text-zinc-400 pt-2 border-t border-zinc-800/80">
            <div>
              <span className="text-zinc-500 text-[10px] block">Responsible Lead:</span>
              <span className="text-zinc-200">{selectedNode.ownership}</span>
            </div>
            {selectedNode.endpoint && (
              <div>
                <span className="text-zinc-500 text-[10px] block">Target Endpoint:</span>
                <code className="text-cyan-400 text-[11px]">{selectedNode.endpoint}</code>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Architecture;
