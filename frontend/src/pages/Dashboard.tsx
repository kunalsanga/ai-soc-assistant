import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  AlertOctagon,
  Cpu,
  FileCheck,
  Server,
  RefreshCw,
  ArrowUpRight,
  Database,
  Boxes,
  TriangleAlert,
} from 'lucide-react';
import { dashboardService, alertService } from '../services/api';
import type { DashboardStats } from '../services/api';
import type { Alert } from '../types/alert';
import MetricCard from '../components/common/MetricCard';
import SeverityBadge from '../components/common/SeverityBadge';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getStats();
      setStats(data);
      // Recent alerts come from the real alert list API.
      try {
        const alerts = await alertService.getAlerts();
        const sorted = [...alerts].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setRecentAlerts(sorted.slice(0, 6));
      } catch {
        // Stats-driven dashboard still renders; the alert table shows its own error.
        setRecentAlerts([]);
      }
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data
          ?.detail ||
        (e as { message?: string })?.message ||
        'Backend is unreachable.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await alertService.syncAlerts();
      const count = result.created ?? result.synced ?? 0;
      const skipped = result.duplicates_skipped ?? result.skipped ?? 0;
      const isReal = (result.client_mode || stats?.services?.wazuh?.mode) === 'real';
      setSyncMessage(
        `Synced ${count} new alert(s) (${skipped} duplicate(s) skipped) from the ${
          isReal ? 'configured Wazuh API' : 'mock Wazuh client (development)'
        }.`
      );
      await load();
    } catch {
      setSyncMessage('Alert sync failed — see Settings & Diagnostics for service health.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton type="card" count={5} />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="card p-12 flex flex-col items-center justify-center space-y-4 border-rose-500/30">
        <TriangleAlert className="w-12 h-12 text-rose-400" />
        <div className="text-center">
          <h2 className="text-sm font-semibold text-zinc-200">Dashboard data unavailable</h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-md font-mono break-all">{error}</p>
          <p className="text-xs text-zinc-500 mt-2 max-w-md">
            The backend could not be reached. Start it with
            <code className="mx-1 text-cyan-400">python -m uvicorn app.main:app</code>
            from the backend/ directory.
          </p>
        </div>
        <button onClick={load} className="btn btn-secondary text-xs flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const dist = stats.alerts.severity_distribution;
  const total = stats.alerts.total;
  const wazuhMode = (stats.services?.wazuh?.mode as string | undefined) ?? null;

  const severityRows = [
    { label: 'Critical (L12-15)', key: 'critical' as const, bar: 'bg-rose-500', text: 'text-rose-400' },
    { label: 'High (L8-11)', key: 'high' as const, bar: 'bg-amber-500', text: 'text-amber-400' },
    { label: 'Medium (L5-7)', key: 'medium' as const, bar: 'bg-yellow-500', text: 'text-yellow-400' },
    { label: 'Low (L2-4)', key: 'low' as const, bar: 'bg-blue-500', text: 'text-blue-400' },
    { label: 'Info (L0-1)', key: 'info' as const, bar: 'bg-zinc-600', text: 'text-zinc-400' },
  ];

  const serviceEntries = [
    { name: 'FastAPI Backend', data: { status: 'connected' as string }, detail: 'This dashboard is served by it' },
    { name: 'PostgreSQL', data: { status: String(stats.services?.postgres?.status ?? 'unknown') }, detail: 'Alert/analysis persistence' },
    { name: 'Qdrant', data: { status: String(stats.services?.qdrant?.status ?? 'unknown') }, detail: 'Knowledge vector index' },
    { name: 'Ollama', data: { status: String(stats.services?.ollama?.status ?? 'unknown') }, detail: 'Local LLM inference' },
    {
      name: 'Wazuh Source',
      data: {
        status:
          wazuhMode === 'real'
            ? String(stats.services?.wazuh?.status ?? 'real_mode')
            : 'using_mock_client',
      },
      detail: wazuhMode === 'real' ? 'Real API configured' : 'Development mock client',
    },
  ];

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
              AI SOC Assistant
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            AI-assisted alert triage with LLM analysis and evidence-grounded retrieval.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn btn-secondary flex items-center gap-2 text-xs"
            title={`Sync alerts from the configured source (${wazuhMode === 'real' ? 'real Wazuh API' : 'mock client'})`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-cyan-400' : ''}`} />
            <span>{syncing ? 'Synchronizing...' : 'Sync Alerts'}</span>
          </button>
          <Link to="/ai-analysis" className="btn btn-primary flex items-center gap-2 text-xs">
            <Cpu className="w-3.5 h-3.5" />
            <span>Run AI Analysis</span>
          </Link>
        </div>
      </div>

      {syncMessage && (
        <div
          className={`p-3 rounded-lg border text-xs font-mono ${
            syncMessage.includes('failed')
              ? 'bg-rose-950/40 border-rose-800/40 text-rose-300'
              : 'bg-cyan-950/40 border-cyan-800/40 text-cyan-300'
          }`}
        >
          {syncMessage}
        </div>
      )}

      {/* KPI Cards — real aggregates from /dashboard/stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Alerts in Database"
          value={total}
          icon={ShieldAlert}
          subtitle="Total persisted alerts"
          glowColor="cyan"
        />
        <MetricCard
          title="Critical Alerts"
          value={dist.critical}
          icon={AlertOctagon}
          changeType="negative"
          subtitle="Severity ≥ 12"
          glowColor="red"
        />
        <MetricCard
          title="Analyses Persisted"
          value={stats.analyses.total}
          icon={Cpu}
          subtitle="By LLM pipeline runs"
          glowColor="cyan"
        />
        <MetricCard
          title="Evidence Records"
          value={stats.evidence.total}
          icon={FileCheck}
          subtitle="Linked to persisted analyses"
          glowColor="emerald"
        />
        <MetricCard
          title="Knowledge Indexed"
          value={
            stats.services?.qdrant?.status === 'connected'
              ? ((stats.services?.qdrant?.points_count as number | undefined) ?? '—')
              : '—'
          }
          icon={Boxes}
          subtitle={stats.services?.qdrant?.status === 'connected' ? 'Qdrant points (security_knowledge)' : 'Qdrant unreachable'}
          glowColor={stats.services?.qdrant?.status === 'connected' ? 'cyan' : 'red'}
        />
      </div>

      {/* Severity distribution + recent analyses */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <h2 className="text-sm font-semibold text-zinc-200">Severity Distribution</h2>
            <span className="text-[10px] font-mono text-zinc-400 uppercase">Click to filter</span>
          </div>

          <div className="space-y-3 pt-1">
            {severityRows.map((row) => {
              const minSev =
                row.key === 'critical'
                  ? 12
                  : row.key === 'high'
                    ? 8
                    : row.key === 'medium'
                      ? 5
                      : row.key === 'low'
                        ? 2
                        : 0;

              return (
                <Link
                  key={row.key}
                  to={`/alerts?min_severity=${minSev}`}
                  className="block space-y-1 group hover:opacity-90 transition-opacity"
                  title={`Filter alerts with severity ≥ ${minSev}`}
                >
                  <div className="flex justify-between text-xs font-mono">
                    <span className={`${row.text} group-hover:underline`}>{row.label}</span>
                    <span className="text-zinc-300 font-bold">{dist[row.key]}</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800/80 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${row.bar} rounded-full transition-all duration-500`}
                      style={{ width: `${(dist[row.key] / (total || 1)) * 100}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Share of total</span>
            <span className="font-mono text-rose-400 font-bold">
              {Math.round((dist.critical / (total || 1)) * 100)}% critical
            </span>
          </div>
        </div>

        {/* Recent persisted analyses */}
        <div className="card p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <h2 className="text-sm font-semibold text-zinc-200">Recent Persisted Analyses</h2>
            <span className="text-[10px] font-mono text-zinc-400 uppercase">Click to open workspace</span>
          </div>
          {stats.analyses.recent.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">
              No analyses have been run yet. Select an alert in AI Analysis and run one.
            </div>
          ) : (
            <div className="space-y-2">
              {stats.analyses.recent.map((analysis) => (
                <Link
                  key={analysis.id}
                  to={`/ai-analysis?alert_id=${analysis.alert_id}`}
                  className="block p-3 rounded-lg bg-zinc-900/60 hover:bg-cyan-950/20 border border-zinc-800/90 hover:border-cyan-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 text-[11px] font-mono text-zinc-500">
                    <span className="text-zinc-300 font-medium">
                      Analysis #{analysis.id} · Alert #{analysis.alert_id}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-cyan-400 font-semibold">{analysis.analysis_type || 'evidence_aware'}</span>
                      <span className={analysis.model_name ? 'text-zinc-400' : 'text-rose-400'}>
                        {analysis.model_name || 'qwen3:8b'}
                      </span>
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-300 line-clamp-2">{analysis.summary || '(no summary)'}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Real service health */}
      <div className="card p-5">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Component Health</h2>
          </div>
          <Link
            to="/architecture"
            className="text-xs text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
          >
            <span>Architecture & Status</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {serviceEntries.map((svc) => {
            const status = svc.data?.status;
            const ok =
              status === 'connected' || status === 'reachable' || status === 'using_mock_client' || status === 'real_mode';
            const degraded = status === 'using_mock_client';
            return (
              <div
                key={svc.name}
                className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/90 flex flex-col justify-between space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300 font-medium">{svc.name}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      degraded ? 'bg-amber-400' : ok ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                  />
                </div>
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-zinc-400">{svc.detail}</span>
                  <span className={degraded ? 'text-amber-400' : ok ? 'text-emerald-400' : 'text-rose-400'}>
                    {String(status || 'unknown').toUpperCase()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-2 text-[11px] font-mono text-zinc-500">
          <Database className="w-3.5 h-3.5" />
          <span>
            Wazuh mode <span className="text-amber-400">{wazuhMode}</span> —
            {wazuhMode === 'real'
              ? ' alerts come from the configured Wazuh API.'
              : ' alerts come from the bundled mock client and are marked as development data.'}
          </span>
        </div>
      </div>

      {/* Recent alert queue */}
      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#0a0e17]">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              <h2 className="text-base font-semibold text-zinc-100">Most Recent Alerts</h2>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Latest alerts by timestamp — {wazuhMode === 'real' ? 'source: Wazuh API' : 'source: mock Wazuh client'}
            </p>
          </div>
          <Link
            to="/alerts"
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors"
          >
            <span>Explore all {total} alerts</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentAlerts.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">
            No alerts in the database. Use "Sync Alerts" above, then refresh.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800/80 bg-[#080b12] text-zinc-400 font-mono uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Rule / Detection</th>
                  <th className="py-3 px-4">Agent / Host</th>
                  <th className="py-3 px-4">Source IP</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-sans">
                {recentAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-cyan-950/20 transition-colors group cursor-pointer">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <SeverityBadge severity={alert.severity} showLevel />
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-400 whitespace-nowrap text-[11px]">
                      {new Date(alert.timestamp).toLocaleString([], {
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-zinc-200 group-hover:text-cyan-300 transition-colors line-clamp-1">
                        {alert.rule_description}
                      </div>
                      <div className="font-mono text-[10px] text-zinc-400 mt-0.5">RULE-{alert.rule_id}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-300 whitespace-nowrap">{alert.agent_name}</td>
                    <td className="py-3.5 px-4 font-mono text-zinc-300 whitespace-nowrap">
                      {alert.source_ip || <span className="text-zinc-500 font-normal italic">local</span>}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Link
                        to={`/alerts/${alert.id}`}
                        className="px-2.5 py-1 rounded bg-zinc-800/80 hover:bg-cyan-950 hover:text-cyan-300 border border-zinc-700/60 hover:border-cyan-500/40 text-[11px] font-medium text-zinc-300 transition-colors"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
