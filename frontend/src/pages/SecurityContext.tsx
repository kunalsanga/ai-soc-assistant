import React, { useState } from 'react';
import {
  Network,
  User,
  Terminal,
  ShieldAlert,
  Binary,
} from 'lucide-react';
import { mockAlerts } from '../data/mockAlerts';
import { getSecurityContextForAlert } from '../data/mockSecurityContext';
import PageHeader from '../components/common/PageHeader';
import SeverityBadge from '../components/common/SeverityBadge';
import MockDataDisclaimer from '../components/common/MockDataDisclaimer';

import { alertService } from '../services/api';
import type { Alert, SecurityContext as SecurityContextType } from '../types/alert';

const SecurityContext: React.FC = () => {
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [context, setContext] = useState<SecurityContextType | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUsingMock, setIsUsingMock] = useState(false);

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

  React.useEffect(() => {
    if (selectedAlertId) {
      setLoading(true);
      alertService.getSecurityContext(selectedAlertId).then(data => {
        setContext(data);
        setIsUsingMock(false);
      }).catch(() => {
        setContext(getSecurityContextForAlert(selectedAlertId));
        // Only set to mock if alerts are also mock, or just keep it real for the rest
      }).finally(() => setLoading(false));
    }
  }, [selectedAlertId]);

  const selectedAlert = alerts.find((a) => a.id === selectedAlertId) || mockAlerts[0];

  if (!context || loading) {
    return (
      <div className="card p-12 text-center text-zinc-400">
        Loading context...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Context Telemetry Explorer"
        subtitle="Multi-dimensional contextual telemetry extracted from endpoint agents, identity providers, and network topology."
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Intelligence' },
          { label: 'Security Context' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-400 font-mono">Inspect Alert:</label>
            <select
              value={selectedAlertId || ''}
              onChange={(e) => setSelectedAlertId(Number(e.target.value))}
              className="bg-[#0c101a] border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
            >
              {alerts.map((alert) => (
                <option key={alert.id} value={alert.id}>
                  #{alert.id} — {alert.rule_description.slice(0, 36)}...
                </option>
              ))}
            </select>
          </div>
        }
      />

      {isUsingMock && (
        <MockDataDisclaimer
          label="MOCK / DEVELOPMENT DATA"
          detail="Contextual enrichment simulated for development baseline alerts. Live context extraction pipeline integration pending."
        />
      )}

      {/* Target Alert Header Banner */}
      <div className="card p-4 bg-[#090d16] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-zinc-800">
        <div className="flex items-center gap-3">
          <SeverityBadge severity={selectedAlert.severity} showLevel />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              {selectedAlert.rule_description}
            </h2>
            <p className="text-xs font-mono text-zinc-400">
              Agent: {selectedAlert.agent_name} | External Ref: {selectedAlert.external_alert_id}
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/80 px-2.5 py-1 rounded border border-cyan-800/40">
          Enrichment Schema v2.1
        </span>
      </div>

      {/* 5-Dimension Context Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 1. Network Context */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Network className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Network Context</h3>
          </div>
          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-zinc-800/50">
              <span className="text-zinc-500">Source IP:</span>
              <span className="text-cyan-400 font-bold">{context.network.source_ip || 'Not available'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/50">
              <span className="text-zinc-500">Destination IP:</span>
              <span className="text-zinc-300">{context.network.destination_ip || 'Not available'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/50">
              <span className="text-zinc-500">Protocol:</span>
              <span className="text-zinc-300">{context.network.protocol || 'Not available'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/50">
              <span className="text-zinc-500">Port:</span>
              <span className="text-zinc-300">{context.network.port ?? 'Not available'}</span>
            </div>
            <div className="pt-1">
              <span className="text-zinc-500 text-[10px] block">Connection Diagnostics:</span>
              <p className="text-zinc-300 font-sans text-xs mt-0.5">
                {context.network.connection_info || 'Not available'}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Identity Context */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <User className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Identity Context</h3>
          </div>
          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-zinc-800/50">
              <span className="text-zinc-500">User Account:</span>
              <span className="text-emerald-400 font-bold">{context.identity.username || 'Not available'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/50">
              <span className="text-zinc-500">Agent Node:</span>
              <span className="text-zinc-300">{context.identity.agent_name || 'Not available'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/50">
              <span className="text-zinc-500">Host FQDN:</span>
              <span className="text-zinc-300">{context.identity.hostname || 'Not available'}</span>
            </div>
            <div className="pt-2">
              <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 font-sans">
                Identity principal resolved via local authentication manager and endpoint agent token.
              </div>
            </div>
          </div>
        </div>

        {/* 3. Execution Context */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Terminal className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Execution Context</h3>
          </div>
          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-zinc-800/50">
              <span className="text-zinc-500">Process Binary:</span>
              <span className="text-amber-400 font-bold">{context.execution.process || 'Not available'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/50">
              <span className="text-zinc-500">Parent Process:</span>
              <span className="text-zinc-300">{context.execution.parent_process || 'Not available'}</span>
            </div>
            <div className="pt-1">
              <span className="text-zinc-500 text-[10px] block">Command Invocation:</span>
              <code className="text-emerald-400/90 text-[11px] bg-black/60 p-2 rounded block mt-1 break-all">
                {context.execution.command || 'Not available'}
              </code>
            </div>
          </div>
        </div>

        {/* 4. Detection Context */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Detection Context</h3>
          </div>
          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-zinc-800/50">
              <span className="text-zinc-500">Rule ID:</span>
              <span className="text-rose-400 font-bold">RULE-{context.detection.rule_id || selectedAlert.rule_id}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/50">
              <span className="text-zinc-500">Telemetry Decoder:</span>
              <span className="text-zinc-300">{context.detection.decoder || 'wazuh_decoder'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/50">
              <span className="text-zinc-500">Numeric Severity:</span>
              <span className="text-zinc-300">{context.detection.severity ?? selectedAlert.severity} / 15</span>
            </div>
            <div className="pt-1">
              <span className="text-zinc-500 text-[10px] block">Rule Description:</span>
              <p className="text-zinc-200 font-sans text-xs mt-0.5">
                {context.detection.rule_description || selectedAlert.rule_description}
              </p>
            </div>
          </div>
        </div>

        {/* 5. Intelligence Context */}
        <div className="card p-5 space-y-4 md:col-span-2">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Binary className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Threat Intelligence Linkage</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <span className="text-zinc-500 text-[10px] uppercase tracking-wider block mb-1">
                MITRE ATT&CK Matrix Techniques
              </span>
              <div className="flex flex-wrap gap-1.5">
                {context.intelligence.mitre_techniques && context.intelligence.mitre_techniques.length > 0 ? (
                  context.intelligence.mitre_techniques.map((tech, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded bg-zinc-800 text-rose-300 border border-rose-500/30 text-[11px]"
                    >
                      {tech}
                    </span>
                  ))
                ) : (
                  <span className="text-zinc-500">Not available</span>
                )}
              </div>
            </div>

            <div>
              <span className="text-zinc-500 text-[10px] uppercase tracking-wider block mb-1">
                CVE / Vulnerability References
              </span>
              {context.intelligence.cve_ids && context.intelligence.cve_ids.length > 0 ? (
                <div className="space-y-1">
                  {context.intelligence.cve_ids.map((cve, i) => (
                    <div key={i} className="text-amber-400 font-bold">
                      {cve}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-zinc-500 italic">No direct CVE correlation matched</span>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-800 text-xs font-sans text-zinc-300">
            <span className="text-zinc-500 font-mono text-[10px] uppercase block">
              Reputation & Staging Feed Summary:
            </span>
            <p className="mt-0.5">{context.intelligence.threat_intel || 'Not available'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityContext;
