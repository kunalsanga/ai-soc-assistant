import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  AlertOctagon,
  SearchCode,
  Cpu,
  FileCheck,
  Activity,
  ArrowUpRight,
  Server,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import type { Alert } from '../types/alert';
import { alertService } from '../services/api';
import { mockAlerts } from '../data/mockAlerts';
import MetricCard from '../components/common/MetricCard';
import SeverityBadge from '../components/common/SeverityBadge';
import StatusBadge from '../components/common/StatusBadge';
import MockDataDisclaimer from '../components/common/MockDataDisclaimer';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

const Dashboard: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUsingMock, setIsUsingMock] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchAlerts = async (showLoadingState = true) => {
    if (showLoadingState) setLoading(true);
    try {
      const data = await alertService.getAlerts();
      if (Array.isArray(data) && data.length > 0) {
        setAlerts(data);
        setIsUsingMock(false);
      } else {
        setAlerts(mockAlerts);
        setIsUsingMock(true);
      }
    } catch {
      // Backend offline or endpoint pending — fallback gracefully to rich mock dataset
      setAlerts(mockAlerts);
      setIsUsingMock(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    alertService
      .getAlerts()
      .then((data) => {
        if (!mounted) return;
        if (Array.isArray(data) && data.length > 0) {
          setAlerts(data);
          setIsUsingMock(false);
        } else {
          setAlerts(mockAlerts);
          setIsUsingMock(true);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setAlerts(mockAlerts);
        setIsUsingMock(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await alertService.syncAlerts();
      await fetchAlerts();
    } catch {
      // simulate quick sync feedback
      setTimeout(() => {
        setSyncing(false);
      }, 800);
      return;
    }
    setSyncing(false);
  };

  // Severity metrics
  const criticalCount = alerts.filter((a) => a.severity >= 12).length;
  const highCount = alerts.filter((a) => a.severity >= 8 && a.severity < 12).length;
  const mediumCount = alerts.filter((a) => a.severity >= 5 && a.severity < 8).length;
  const lowCount = alerts.filter((a) => a.severity >= 2 && a.severity < 5).length;
  const infoCount = alerts.filter((a) => a.severity < 2).length;

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
              Security Operations Center
            </h1>
            <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
              SOC Assist v2.4
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            AI-assisted threat monitoring, evidence retrieval, and incident investigation platform.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn btn-secondary flex items-center gap-2 text-xs"
            title="Poll or synchronize alerts from backend service"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-cyan-400' : ''}`} />
            <span>{syncing ? 'Synchronizing...' : 'Sync Pipeline'}</span>
          </button>
          <Link
            to="/investigation"
            className="btn btn-primary flex items-center gap-2 text-xs"
          >
            <SearchCode className="w-3.5 h-3.5" />
            <span>Investigation Workspace</span>
          </Link>
        </div>
      </div>

      {/* Mock Telemetry Notice */}
      {isUsingMock && (
        <MockDataDisclaimer
          label="MOCK / DEVELOPMENT DATA"
          detail="Live Wazuh telemetry endpoint unavailable — Displaying development baseline telemetry and mock security artifacts."
        />
      )}

      {/* KPI Cards Grid */}
      {loading ? (
        <LoadingSkeleton type="card" count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            title="Active Alerts"
            value={alerts.length}
            icon={ShieldAlert}
            change="+4 last hr"
            changeType="neutral"
            subtitle="Queue backlog across all agents"
            isMock={isUsingMock}
            glowColor="cyan"
          />
          <MetricCard
            title="Critical Alerts"
            value={criticalCount < 10 ? `0${criticalCount}` : criticalCount}
            icon={AlertOctagon}
            change="Immediate action"
            changeType="negative"
            subtitle="Severity ≥ 12 / PAM & Exec"
            isMock={isUsingMock}
            glowColor="red"
          />
          <MetricCard
            title="Investigations"
            value="02"
            icon={SearchCode}
            change="In Progress"
            changeType="positive"
            subtitle="Active analyst triage cases"
            isMock={true}
            glowColor="amber"
          />
          <MetricCard
            title="AI Analyses"
            value="14"
            icon={Cpu}
            change="94% Confidence"
            changeType="positive"
            subtitle="Grounded RAG syntheses"
            isMock={true}
            glowColor="cyan"
          />
          <MetricCard
            title="Evidence Items"
            value="48"
            icon={FileCheck}
            change="NIST / MITRE"
            changeType="positive"
            subtitle="Authoritative retrieved docs"
            isMock={true}
            glowColor="emerald"
          />
        </div>
      )}

      {/* Middle Analytical Grid: Visualizations & Architecture Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Severity Distribution Visualizer */}
        <div className="card p-5 lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Severity Distribution</h2>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 uppercase">Current Queue</span>
          </div>

          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-rose-400">Critical (L12-15)</span>
                <span className="text-zinc-300 font-bold">{criticalCount}</span>
              </div>
              <div className="w-full h-2 bg-zinc-800/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all duration-500"
                  style={{ width: `${(criticalCount / (alerts.length || 1)) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-amber-400">High (L8-11)</span>
                <span className="text-zinc-300 font-bold">{highCount}</span>
              </div>
              <div className="w-full h-2 bg-zinc-800/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${(highCount / (alerts.length || 1)) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-yellow-400">Medium (L5-7)</span>
                <span className="text-zinc-300 font-bold">{mediumCount}</span>
              </div>
              <div className="w-full h-2 bg-zinc-800/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                  style={{ width: `${(mediumCount / (alerts.length || 1)) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-blue-400">Low (L2-4)</span>
                <span className="text-zinc-300 font-bold">{lowCount}</span>
              </div>
              <div className="w-full h-2 bg-zinc-800/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${(lowCount / (alerts.length || 1)) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-zinc-400">Info (L0-1)</span>
                <span className="text-zinc-300 font-bold">{infoCount}</span>
              </div>
              <div className="w-full h-2 bg-zinc-800/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-zinc-600 rounded-full transition-all duration-500"
                  style={{ width: `${(infoCount / (alerts.length || 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Critical triage priority</span>
            <span className="font-mono text-rose-400 font-bold">
              {Math.round((criticalCount / (alerts.length || 1)) * 100)}% of total
            </span>
          </div>
        </div>

        {/* Threat Activity Timeline Bar Chart */}
        <div className="card p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-zinc-200">24-Hour Threat Ingestion Activity</h2>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">Hourly Aggregate</span>
          </div>

          {/* Activity visualization */}
          <div className="h-44 flex items-end justify-between gap-1.5 pt-6 pb-2 px-2">
            {[
              { hour: '00:00', count: 12, critical: 1 },
              { hour: '03:00', count: 8, critical: 0 },
              { hour: '06:00', count: 15, critical: 2 },
              { hour: '09:00', count: 42, critical: 5 },
              { hour: '12:00', count: 38, critical: 3 },
              { hour: '15:00', count: 54, critical: 8 },
              { hour: '18:00', count: 29, critical: 2 },
              { hour: '21:00', count: 18, critical: 1 },
            ].map((slot, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="relative w-full max-w-[36px] flex flex-col items-center justify-end h-28 bg-zinc-900/50 rounded-t border-b border-zinc-700">
                  <div
                    className="w-full bg-cyan-500/80 hover:bg-cyan-400 transition-all rounded-t group-hover:shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                    style={{ height: `${(slot.count / 60) * 100}%` }}
                    title={`${slot.hour}: ${slot.count} alerts (${slot.critical} critical)`}
                  >
                    {slot.critical > 0 && (
                      <div
                        className="w-full bg-rose-500 rounded-t"
                        style={{ height: `${(slot.critical / slot.count) * 100}%` }}
                      />
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-zinc-400 group-hover:text-zinc-200">
                  {slot.hour}
                </span>
              </div>
            ))}
          </div>

          {/* Legend and Honest Disclaimer */}
          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-zinc-800 text-[11px] text-zinc-400 font-mono">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-sm" />
                Critical Threat Events
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-cyan-500 rounded-sm" />
                Standard Telemetry
              </span>
            </div>
            <span className="text-zinc-500">MOCK TELEMETRY VOLUME</span>
          </div>
        </div>
      </div>

      {/* System Integration Pipeline Health */}
      <div className="card p-5">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Platform Pipeline Integrity</h2>
          </div>
          <Link
            to="/architecture"
            className="text-xs text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
          >
            <span>Topology & Pipeline View</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/90 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300 font-medium">FastAPI Backend</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-zinc-400">Port 8000</span>
              <span className="text-emerald-400">OPERATIONAL</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/90 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300 font-medium">Wazuh Manager</span>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            </div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-zinc-400">SIEM Feed</span>
              <span className="text-amber-400">DEV MOCK</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/90 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300 font-medium">AI RAG Engine</span>
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
            </div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-zinc-400">Mistral / Grounded</span>
              <span className="text-cyan-400">READY</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/90 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300 font-medium">Qdrant Vector DB</span>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            </div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-zinc-400">Embeddings</span>
              <span className="text-amber-400">INTEG PENDING</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/90 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300 font-medium">PostgreSQL Storage</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-zinc-400">Alert Persistence</span>
              <span className="text-emerald-400">CONNECTED</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Alert Queue Stream Table */}
      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#0a0e17]">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              <h2 className="text-base font-semibold text-zinc-100">Active Alert Ingestion Stream</h2>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live threat detections awaiting or undergoing AI triage
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/alerts"
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors"
            >
              <span>Explore All {alerts.length} Alerts</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-[#080b12] text-zinc-400 font-mono uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Rule / Detection</th>
                <th className="py-3 px-4">Agent / Host</th>
                <th className="py-3 px-4">Source IP</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-sans">
              {alerts.slice(0, 6).map((alert) => (
                <tr
                  key={alert.id}
                  className="hover:bg-cyan-950/20 transition-colors group cursor-pointer"
                >
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <SeverityBadge severity={alert.severity} showLevel />
                  </td>
                  <td className="py-3.5 px-4 font-mono text-zinc-400 whitespace-nowrap text-[11px]">
                    {new Date(alert.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-zinc-200 group-hover:text-cyan-300 transition-colors line-clamp-1">
                      {alert.rule_description}
                    </div>
                    <div className="font-mono text-[10px] text-zinc-400 mt-0.5">
                      RULE-{alert.rule_id}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-zinc-300 whitespace-nowrap">
                    {alert.agent_name}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-zinc-300 whitespace-nowrap">
                    {alert.source_ip || (
                      <span className="text-zinc-500 font-normal italic">local</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-zinc-300 whitespace-nowrap">
                    {alert.username || <span className="text-zinc-500 italic">-</span>}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <StatusBadge status={alert.status} />
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/alerts/${alert.id}`}
                        className="px-2.5 py-1 rounded bg-zinc-800/80 hover:bg-cyan-950 hover:text-cyan-300 border border-zinc-700/60 hover:border-cyan-500/40 text-[11px] font-medium text-zinc-300 transition-colors"
                      >
                        Inspect
                      </Link>
                      <Link
                        to="/investigation"
                        className="px-2.5 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/50 text-[11px] font-medium transition-colors"
                      >
                        Triage
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
