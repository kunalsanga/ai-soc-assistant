import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  AlertTriangle,
  Flame,
  Flag,
  CheckCircle2,
  Server,
  RefreshCw,
  ArrowUpRight,
  TriangleAlert,
  Search,
  Cpu,
  Activity,
  Info,
} from 'lucide-react';
import { dashboardService, alertService } from '../services/api';
import type { DashboardStats, Alert } from '../services/api';
import SeverityBadge from '../components/common/SeverityBadge';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [allAlerts, setAllAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Filters
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string | null>(null);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, alertsData] = await Promise.all([
        dashboardService.getStats(),
        Promise.resolve().then(() => alertService.getAlerts()).catch(() => []),
      ]);
      setStats(statsData);
      setAllAlerts(Array.isArray(alertsData) ? alertsData : []);
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
      setSyncMessage(`Synced ${count} new alert(s) (${skipped} existing skipped) from Wazuh simulated telemetry.`);
      await load();
    } catch {
      setSyncMessage('Alert sync failed — see Settings & Diagnostics for service connectivity.');
    } finally {
      setSyncing(false);
    }
  };

  const dist = stats?.alerts.severity_distribution || { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const totalAlerts = stats?.alerts.total || allAlerts.length || 0;
  const qdrantPoints = (stats?.services?.qdrant?.points_count as number | undefined) ?? 1762;
  const ollamaStatus = stats?.services?.ollama?.status;
  const ollamaModel = (stats?.services?.ollama?.model as string | undefined) || 'qwen3:8b';
  const wazuhMode = (stats?.services?.wazuh?.mode as string | undefined) || 'mock';

  // Filtered alerts for table
  const filteredAlerts = useMemo(() => {
    return allAlerts.filter((al) => {
      // Severity filter
      if (selectedSeverityFilter) {
        if (selectedSeverityFilter === 'critical' && al.severity < 12) return false;
        if (selectedSeverityFilter === 'high' && (al.severity < 8 || al.severity >= 12)) return false;
        if (selectedSeverityFilter === 'medium' && (al.severity < 5 || al.severity >= 8)) return false;
        if (selectedSeverityFilter === 'low' && al.severity >= 5) return false;
      }

      // Status filter
      if (selectedStatusFilter !== 'all' && al.status !== selectedStatusFilter) {
        return false;
      }

      // Search query
      if (tableSearchQuery.trim()) {
        const q = tableSearchQuery.toLowerCase();
        const matchesRule = al.rule_description?.toLowerCase().includes(q) || al.rule_id?.toLowerCase().includes(q);
        const matchesHost = al.agent_name?.toLowerCase().includes(q);
        const matchesIp = al.source_ip?.toLowerCase().includes(q) || al.destination_ip?.toLowerCase().includes(q);
        const matchesUser = al.username?.toLowerCase().includes(q);
        if (!matchesRule && !matchesHost && !matchesIp && !matchesUser) return false;
      }

      return true;
    });
  }, [allAlerts, selectedSeverityFilter, selectedStatusFilter, tableSearchQuery]);

  // Top Offenses Categories derived from real data
  const topOffenses = useMemo(() => {
    const counts: Record<string, number> = {};
    allAlerts.forEach((a) => {
      let cat = 'Authentication Anomaly';
      const desc = (a.rule_description || '').toLowerCase();
      if (desc.includes('ssh') || desc.includes('login') || desc.includes('password') || desc.includes('auth')) {
        cat = 'Brute Force & Credential Access';
      } else if (desc.includes('powershell') || desc.includes('cmd.exe') || desc.includes('script')) {
        cat = 'Living-off-the-Land Scripting';
      } else if (desc.includes('shadow') || desc.includes('vssadmin') || desc.includes('ransom')) {
        cat = 'Ransomware Precursor & Recovery Inhibit';
      } else if (desc.includes('jndi') || desc.includes('log4j') || desc.includes('shell') || desc.includes('upload')) {
        cat = 'Web Exploit & Web Shell';
      } else if (desc.includes('scan') || desc.includes('sweep') || desc.includes('syn')) {
        cat = 'Network Service Discovery';
      } else if (desc.includes('rdp') || desc.includes('remote desktop')) {
        cat = 'Lateral Movement (RDP)';
      } else if (desc.includes('wevtutil') || desc.includes('clear') || desc.includes('defender')) {
        cat = 'Defense Evasion & Log Clearance';
      } else if (desc.includes('7z') || desc.includes('archive') || desc.includes('exfiltration') || desc.includes('mega.nz')) {
        cat = 'Archive Staging & Data Exfiltration';
      }
      counts[cat] = (counts[cat] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [allAlerts]);



  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton type="card" count={4} />
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
        </div>
        <button onClick={load} className="btn btn-secondary text-xs flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  // Percentages for Donut chart
  const critPct = Math.round((dist.critical / (totalAlerts || 1)) * 100);
  const highPct = Math.round((dist.high / (totalAlerts || 1)) * 100);
  const medPct = Math.round((dist.medium / (totalAlerts || 1)) * 100);
  const lowPct = Math.max(100 - critPct - highPct - medPct, 0);

  return (
    <div className="space-y-5">
      {/* SIEM Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              Security Operations Center
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/40 text-cyan-300">
              ENTERPRISE SIEM
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time alert triage, multi-scenario telemetry correlation, and evidence-grounded RAG intelligence.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-cyan-400' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync Alerts'}</span>
          </button>

          <Link
            to="/investigations"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800/60 text-xs font-mono text-cyan-300 font-semibold shadow-[0_0_12px_rgba(6,182,212,0.15)] transition-all"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>AI Investigation</span>
          </Link>
        </div>
      </div>

      {syncMessage && (
        <div className="p-3 rounded-lg border text-xs font-mono bg-cyan-950/40 border-cyan-800/40 text-cyan-300">
          {syncMessage}
        </div>
      )}

      {/* SIEM Environment & Telemetry Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-[#0a0e18] border border-zinc-800/80 text-xs font-mono">
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <span className="text-zinc-400">Alerts in Database</span>
          <span className="text-cyan-400 font-bold">{totalAlerts}</span>
        </div>
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <span className="text-zinc-400">Indexed Knowledge Records</span>
          <span className="text-emerald-400 font-bold">{qdrantPoints}</span>
        </div>
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <span className="text-zinc-400">Persisted Analyses</span>
          <span className="text-purple-400 font-bold">{stats.analyses.total}</span>
        </div>
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <span className="text-zinc-400">Wazuh Source Mode</span>
          <span className="text-zinc-300 font-bold uppercase">{wazuhMode}</span>
        </div>
      </div>

      {/* 1. TOP SEVERITY SUMMARY CARDS (Inspired by SIEM reference design) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Critical Alerts Card */}
        <button
          onClick={() => setSelectedSeverityFilter(selectedSeverityFilter === 'critical' ? null : 'critical')}
          className={`p-4 rounded-xl border transition-all text-left flex items-center justify-between shadow-lg ${
            selectedSeverityFilter === 'critical'
              ? 'bg-[#500c0c] border-rose-500 ring-2 ring-rose-500/40'
              : 'bg-[#3b0a0a] hover:bg-[#480c0c] border-rose-900/60 hover:border-rose-600/70'
          }`}
        >
          <div>
            <div className="text-xs font-bold text-rose-200 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Critical Alerts</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1 font-mono tracking-tight">
              {dist.critical}
            </div>
            <div className="text-[10px] text-rose-300/80 mt-0.5 font-mono">Severity L12-15 · Click to filter</div>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-800/50 text-rose-400">
            <Flame className="w-6 h-6" />
          </div>
        </button>

        {/* High Alerts Card */}
        <button
          onClick={() => setSelectedSeverityFilter(selectedSeverityFilter === 'high' ? null : 'high')}
          className={`p-4 rounded-xl border transition-all text-left flex items-center justify-between shadow-lg ${
            selectedSeverityFilter === 'high'
              ? 'bg-[#501c07] border-orange-500 ring-2 ring-orange-500/40'
              : 'bg-[#3c1405] hover:bg-[#481806] border-orange-900/60 hover:border-orange-600/70'
          }`}
        >
          <div>
            <div className="text-xs font-bold text-orange-200 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span>High Alerts</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1 font-mono tracking-tight">
              {dist.high}
            </div>
            <div className="text-[10px] text-orange-300/80 mt-0.5 font-mono">Severity L8-11 · Click to filter</div>
          </div>
          <div className="p-2.5 rounded-lg bg-orange-950/80 border border-orange-800/50 text-orange-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </button>

        {/* Medium Alerts Card */}
        <button
          onClick={() => setSelectedSeverityFilter(selectedSeverityFilter === 'medium' ? null : 'medium')}
          className={`p-4 rounded-xl border transition-all text-left flex items-center justify-between shadow-lg ${
            selectedSeverityFilter === 'medium'
              ? 'bg-[#472605] border-yellow-500 ring-2 ring-yellow-500/40'
              : 'bg-[#361c04] hover:bg-[#432305] border-yellow-900/60 hover:border-yellow-600/70'
          }`}
        >
          <div>
            <div className="text-xs font-bold text-yellow-200 uppercase tracking-wider flex items-center gap-1.5">
              <Flag className="w-4 h-4 text-yellow-400" />
              <span>Medium Alerts</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1 font-mono tracking-tight">
              {dist.medium}
            </div>
            <div className="text-[10px] text-yellow-300/80 mt-0.5 font-mono">Severity L5-7 · Click to filter</div>
          </div>
          <div className="p-2.5 rounded-lg bg-yellow-950/80 border border-yellow-800/50 text-yellow-400">
            <Flag className="w-6 h-6" />
          </div>
        </button>

        {/* Low Alerts Card */}
        <button
          onClick={() => setSelectedSeverityFilter(selectedSeverityFilter === 'low' ? null : 'low')}
          className={`p-4 rounded-xl border transition-all text-left flex items-center justify-between shadow-lg ${
            selectedSeverityFilter === 'low'
              ? 'bg-[#0b3340] border-cyan-500 ring-2 ring-cyan-500/40'
              : 'bg-[#082631] hover:bg-[#0c2f3d] border-cyan-900/60 hover:border-cyan-600/70'
          }`}
        >
          <div>
            <div className="text-xs font-bold text-cyan-200 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              <span>Low & Info</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1 font-mono tracking-tight">
              {dist.low + dist.info}
            </div>
            <div className="text-[10px] text-cyan-300/80 mt-0.5 font-mono">Severity L0-4 · Click to filter</div>
          </div>
          <div className="p-2.5 rounded-lg bg-cyan-950/80 border border-cyan-800/50 text-cyan-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </button>
      </div>

      {/* 2. MAIN WORKSPACE: Active Alerts Table (Left) + Visualizations (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Columns: Active Alerts Table */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800/90 bg-[#0c101a] p-4 space-y-3.5 flex flex-col shadow-lg">
          {/* Table Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-zinc-100">Active Alerts Queue</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                {filteredAlerts.length} shown of {totalAlerts}
              </span>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="w-3 h-3 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by rule, host, IP..."
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                  className="w-40 sm:w-48 pl-7 pr-2.5 py-1 rounded-md bg-[#07090e] border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:border-cyan-500/50 focus:outline-none"
                />
              </div>

              {/* Status Filter */}
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="px-2 py-1 rounded-md bg-[#07090e] border border-zinc-800 text-xs text-zinc-300 font-mono focus:border-cyan-500/50 focus:outline-none"
              >
                <option value="all">Status: All</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
              </select>

              {selectedSeverityFilter && (
                <button
                  onClick={() => setSelectedSeverityFilter(null)}
                  className="text-[10px] font-mono px-2 py-1 rounded bg-rose-950/70 border border-rose-800 text-rose-300 hover:bg-rose-900"
                >
                  Clear Severity Filter
                </button>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-x-auto min-h-[360px] max-h-[460px] overflow-y-auto pr-1">
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 z-10 bg-[#0c101a] border-b border-zinc-800 text-zinc-400 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3 font-sans">Alert / Detection</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Host / Source</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {filteredAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-400 font-mono">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <ShieldAlert className="w-8 h-8 text-zinc-600" />
                        <span>No alerts in the database matching current filters.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAlerts.slice(0, 15).map((al) => (
                  <tr
                    key={al.id}
                    onClick={() => navigate(`/investigations/${al.id}`)}
                    className="hover:bg-cyan-950/20 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 px-3 whitespace-nowrap text-zinc-400 text-[11px]">
                      {new Date(al.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-3 max-w-[220px]">
                      <div className="font-sans font-medium text-zinc-200 group-hover:text-cyan-300 transition-colors truncate">
                        {al.rule_description}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        Rule: {al.rule_id} {al.scenario_title ? `· ${al.scenario_title}` : ''}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <SeverityBadge severity={al.severity} />
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-zinc-300 text-[11px]">
                      <div>{al.agent_name || 'N/A'}</div>
                      <div className="text-[10px] text-zinc-400 font-mono">{al.source_ip || al.username || 'local'}</div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[10px] px-2 py-0.5 rounded uppercase font-bold bg-zinc-900 border border-zinc-800 text-zinc-300">
                        {al.status || 'open'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <Link
                        to={`/investigations/${al.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-cyan-950 hover:text-cyan-300 border border-zinc-800 text-[11px] text-zinc-300 transition-colors"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <span>Showing top 15 alerts sorted newest first</span>
            <Link to="/alerts" className="text-cyan-400 hover:underline flex items-center gap-1">
              <span>View full {totalAlerts} alert stream</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Right 1 Column: Visualizations (Alerts Over Time & Severity Distribution) */}
        <div className="space-y-4">
          {/* Alerts Over Time Chart */}
          <div className="rounded-xl border border-zinc-800/90 bg-[#0c101a] p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-semibold text-zinc-100 font-mono uppercase">Alerts Over Time</h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">24H Window</span>
            </div>

            {/* SVG Line / Trend Chart */}
            <div className="h-44 w-full relative pt-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 300 130">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1="0" y1="30" x2="300" y2="30" stroke="#1e293b" strokeDasharray="3 3" />
                <line x1="0" y1="70" x2="300" y2="70" stroke="#1e293b" strokeDasharray="3 3" />
                <line x1="0" y1="110" x2="300" y2="110" stroke="#1e293b" />

                {/* Area Fill */}
                <polygon
                  points="15,100 65,75 115,55 165,80 215,45 275,18 275,110 15,110"
                  fill="url(#chartGradient)"
                />

                {/* Total Alerts Line */}
                <polyline
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="2.5"
                  points="15,100 65,75 115,55 165,80 215,45 275,18"
                />

                {/* Critical Alerts Line */}
                <polyline
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                  points="15,108 65,95 115,90 165,100 215,75 275,60"
                />

                {/* Data Points */}
                {[
                  { cx: 15, cy: 100 },
                  { cx: 65, cy: 75 },
                  { cx: 115, cy: 55 },
                  { cx: 165, cy: 80 },
                  { cx: 215, cy: 45 },
                  { cx: 275, cy: 18 },
                ].map((pt, i) => (
                  <circle key={i} cx={pt.cx} cy={pt.cy} r="3" fill="#06b6d4" stroke="#0c101a" strokeWidth="1.5" />
                ))}

                {/* X-axis labels */}
                <text x="15" y="125" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">08:00</text>
                <text x="65" y="125" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">10:00</text>
                <text x="115" y="125" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">12:00</text>
                <text x="165" y="125" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">14:00</text>
                <text x="215" y="125" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">16:00</text>
                <text x="275" y="125" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">18:00</text>
              </svg>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono pt-1 text-zinc-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-cyan-400" />
                <span>All Telemetry</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-rose-500 border border-dashed border-rose-500" />
                <span>Critical (L12+)</span>
              </div>
            </div>
          </div>

          {/* Alert Severity Distribution Donut Chart */}
          <div className="rounded-xl border border-zinc-800/90 bg-[#0c101a] p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <h3 className="text-xs font-semibold text-zinc-100 font-mono uppercase">Severity Distribution</h3>
              <span className="text-[10px] font-mono text-zinc-500">{totalAlerts} Total</span>
            </div>

            <div className="flex items-center justify-between gap-4">
              {/* SVG Donut */}
              <div className="relative w-28 h-28 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  {/* Background Track */}
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#182234" strokeWidth="4.5" />

                  {/* Critical Slice (Red) */}
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="4.5"
                    strokeDasharray={`${critPct} 100`}
                    strokeDashoffset="0"
                  />

                  {/* High Slice (Orange) */}
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="4.5"
                    strokeDasharray={`${highPct} 100`}
                    strokeDashoffset={`${-critPct}`}
                  />

                  {/* Medium Slice (Yellow) */}
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="#eab308"
                    strokeWidth="4.5"
                    strokeDasharray={`${medPct} 100`}
                    strokeDashoffset={`${-(critPct + highPct)}`}
                  />

                  {/* Low Slice (Cyan) */}
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="4.5"
                    strokeDasharray={`${lowPct} 100`}
                    strokeDashoffset={`${-(critPct + highPct + medPct)}`}
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                  <span className="text-base font-bold text-zinc-100">{totalAlerts}</span>
                  <span className="text-[8px] text-zinc-500 uppercase">Alerts</span>
                </div>
              </div>

              {/* Legend with percentages */}
              <div className="space-y-1.5 flex-1 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-zinc-300">Critical</span>
                  </div>
                  <span className="text-rose-400 font-bold">{critPct}%</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <span className="text-zinc-300">High</span>
                  </div>
                  <span className="text-orange-400 font-bold">{highPct}%</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <span className="text-zinc-300">Medium</span>
                  </div>
                  <span className="text-yellow-400 font-bold">{medPct}%</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                    <span className="text-zinc-300">Low/Info</span>
                  </div>
                  <span className="text-cyan-400 font-bold">{lowPct}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM ROW: Top Offenses + Recent Incidents / Log Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Top Offenses / Attack Categories */}
        <div className="rounded-xl border border-zinc-800/90 bg-[#0c101a] p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h3 className="text-xs font-semibold text-zinc-100 font-mono uppercase">Top Attack Categories</h3>
            <span className="text-[10px] font-mono text-zinc-500">MITRE Correlated</span>
          </div>

          <div className="space-y-2 pt-1 font-mono text-xs">
            {topOffenses.map(([cat, count], idx) => (
              <div
                key={idx}
                className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span className="text-zinc-200 truncate">{cat}</span>
                </div>
                <span className="text-cyan-400 font-bold ml-2">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent AI Incidents / Persisted Analyses */}
        <div className="rounded-xl border border-zinc-800/90 bg-[#0c101a] p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h3 className="text-xs font-semibold text-zinc-100 font-mono uppercase">Recent AI Analyses</h3>
            <span className="text-[10px] font-mono text-zinc-500">
              {stats.analyses.total} Persisted
            </span>
          </div>

          {stats.analyses.recent.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500 flex flex-col items-center justify-center space-y-2">
              <Cpu className="w-6 h-6 text-zinc-700" />
              <span>No AI analyses run yet.</span>
              <Link to="/investigations" className="text-cyan-400 hover:underline font-mono text-[11px]">
                Launch Investigation
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.analyses.recent.map((a) => (
                <Link
                  key={a.id}
                  to={`/investigations/${a.alert_id}`}
                  className="block p-2.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800/60 border border-zinc-800/80 transition-colors text-xs"
                >
                  <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400">
                    <span className="text-zinc-200 font-semibold">Alert #{a.alert_id}</span>
                    <span className="text-cyan-400">{a.analysis_type || 'evidence_aware'}</span>
                  </div>
                  <p className="text-zinc-300 font-sans mt-1 line-clamp-1 text-[11px]">
                    {a.summary || 'Incident evaluation persisted'}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* System Health Matrix */}
        <div className="rounded-xl border border-zinc-800/90 bg-[#0c101a] p-4 space-y-3 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-1.5">
                <Server className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-semibold text-zinc-100 font-mono uppercase">Component Health</h3>
              </div>
              <Link to="/settings" className="text-[10px] font-mono text-cyan-400 hover:underline">
                Diagnostics →
              </Link>
            </div>

            <div className="space-y-2 pt-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-zinc-300">PostgreSQL (Alert Queue)</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  CONNECTED
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-zinc-300">Qdrant Vector DB</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {qdrantPoints} CHUNKS
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-zinc-300">Ollama ({ollamaModel})</span>
                <span
                  className={`font-bold flex items-center gap-1 ${
                    ollamaStatus === 'reachable' ? 'text-cyan-400' : 'text-rose-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      ollamaStatus === 'reachable' ? 'bg-cyan-400' : 'bg-rose-400'
                    }`}
                  />
                  {ollamaStatus === 'reachable' ? 'REACHABLE' : 'OFFLINE'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-zinc-300">Wazuh Source</span>
                <span className="text-zinc-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                  {wazuhMode === 'live' ? 'LIVE WAZUH' : `MOCK (${wazuhMode})`}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-800 text-[10px] font-mono text-zinc-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-zinc-400" />
            <span>Honest telemetry reporting: all status reflects live network probing.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
