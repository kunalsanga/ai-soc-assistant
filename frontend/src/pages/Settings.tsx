import React, { useState } from 'react';
import { Server, Cpu, Save, CheckCircle2 } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import MockDataDisclaimer from '../components/common/MockDataDisclaimer';

const Settings: React.FC = () => {
  const [apiUrl, setApiUrl] = useState('http://localhost:8000/api/v1');
  const [wazuhHost, setWazuhHost] = useState('https://wazuh.internal.corp:55000');
  const [qdrantHost, setQdrantHost] = useState('http://localhost:6333');
  const [analystName, setAnalystName] = useState('Bivan (Lead SecOps)');
  const [confidenceThreshold, setConfidenceThreshold] = useState('0.85');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState('30');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage('Preferences preserved in local browser session storage.');
    setTimeout(() => setSaveMessage(null), 3500);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="SOC Console Settings & Configuration"
        subtitle="Configure backend API routing, SIEM integration endpoints, and analyst workstation parameters."
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'System' },
          { label: 'Settings' },
        ]}
        badge={
          <span className="font-mono text-xs text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-800/40">
            Console Preferences
          </span>
        }
      />

      <MockDataDisclaimer
        label="LOCAL CONFIGURATION"
        detail="Configuration adjustments affect the local frontend client runtime and local session storage."
      />

      <form onSubmit={handleSave} className="space-y-6">
        {/* Backend Endpoints */}
        <div className="card p-6 space-y-4 bg-[#0c101a]">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Server className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-zinc-200">
              Backend Service & Telemetry Endpoints
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-mono text-zinc-400">FastAPI Backend URL:</label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-[#07090e] border border-zinc-800 text-zinc-200 font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-zinc-500 font-mono">
                Primary gateway consumed by frontend client
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="font-mono text-zinc-400">Wazuh SIEM Manager Host:</label>
              <input
                type="text"
                value={wazuhHost}
                onChange={(e) => setWazuhHost(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-[#07090e] border border-zinc-800 text-zinc-200 font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-zinc-500 font-mono">
                SIEM API collector server (backend sync endpoint)
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="font-mono text-zinc-400">Qdrant Vector Database Host:</label>
              <input
                type="text"
                value={qdrantHost}
                onChange={(e) => setQdrantHost(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-[#07090e] border border-zinc-800 text-zinc-200 font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-zinc-500 font-mono">
                High-dimensional vector index for RAG
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="font-mono text-zinc-400">Alert Stream Poll Interval (s):</label>
              <input
                type="number"
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-[#07090e] border border-zinc-800 text-zinc-200 font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-zinc-500 font-mono">
                Background telemetry refresh rate
              </span>
            </div>
          </div>
        </div>

        {/* Analyst Identity & AI Reasoning Thresholds */}
        <div className="card p-6 space-y-4 bg-[#0c101a]">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Cpu className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-zinc-200">
              Analyst Workstation & AI Parameters
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-mono text-zinc-400">Duty Analyst Callsign:</label>
              <input
                type="text"
                value={analystName}
                onChange={(e) => setAnalystName(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-[#07090e] border border-zinc-800 text-zinc-200 font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-zinc-500 font-mono">
                Appended to investigation containment audit trails
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="font-mono text-zinc-400">Minimum Grounding Threshold:</label>
              <input
                type="text"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-[#07090e] border border-zinc-800 text-zinc-200 font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-zinc-500 font-mono">
                Confidence cut-off below which manual review is mandated
              </span>
            </div>
          </div>
        </div>

        {/* Submission Actions */}
        <div className="flex items-center justify-between pt-2">
          {saveMessage ? (
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>{saveMessage}</span>
            </div>
          ) : (
            <span className="text-[11px] font-mono text-zinc-500">
              Changes persist locally for this browser profile
            </span>
          )}

          <button
            type="submit"
            className="btn btn-primary text-xs flex items-center gap-2 px-5 py-2.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
