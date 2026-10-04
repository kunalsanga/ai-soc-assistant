import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  SearchCode,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import type { Alert } from '../types/alert';
import { alertService } from '../services/api';
import { mockAlerts } from '../data/mockAlerts';
import PageHeader from '../components/common/PageHeader';
import SeverityBadge from '../components/common/SeverityBadge';
import StatusBadge from '../components/common/StatusBadge';
import MockDataDisclaimer from '../components/common/MockDataDisclaimer';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import EmptyState from '../components/common/EmptyState';

const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUsingMock, setIsUsingMock] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<'severity' | 'timestamp'>('timestamp');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

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

  const filteredAlerts = useMemo(() => {
    return alerts
      .filter((alert) => {
        // Search
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !q ||
          alert.rule_description.toLowerCase().includes(q) ||
          alert.rule_id.includes(q) ||
          alert.agent_name.toLowerCase().includes(q) ||
          (alert.source_ip && alert.source_ip.includes(q)) ||
          (alert.destination_ip && alert.destination_ip.includes(q)) ||
          (alert.username && alert.username.toLowerCase().includes(q));

        // Severity filter
        let matchesSeverity = true;
        if (selectedSeverity === 'critical') matchesSeverity = alert.severity >= 12;
        else if (selectedSeverity === 'high') matchesSeverity = alert.severity >= 8 && alert.severity < 12;
        else if (selectedSeverity === 'medium') matchesSeverity = alert.severity >= 5 && alert.severity < 8;
        else if (selectedSeverity === 'low') matchesSeverity = alert.severity < 5;

        // Status filter
        const matchesStatus =
          selectedStatus === 'all' || alert.status.toLowerCase() === selectedStatus.toLowerCase();

        return matchesQuery && matchesSeverity && matchesStatus;
      })
      .sort((a, b) => {
        if (sortField === 'severity') {
          return sortAsc ? a.severity - b.severity : b.severity - a.severity;
        }
        return sortAsc
          ? new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
  }, [alerts, searchQuery, selectedSeverity, selectedStatus, sortField, sortAsc]);

  const toggleSort = (field: 'severity' | 'timestamp') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const toggleRow = (id: number) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alert Stream & Triage Queue"
        subtitle="Live telemetry and normalized threat events ingested from endpoint SIEM agents."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Alerts' }]}
        badge={
          <span className="font-mono text-xs text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-800/40">
            {filteredAlerts.length} Events Listed
          </span>
        }
        actions={
          <button
            onClick={() => fetchAlerts()}
            className="btn btn-secondary flex items-center gap-2 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh Stream</span>
          </button>
        }
      />

      {isUsingMock && (
        <MockDataDisclaimer
          label="MOCK / DEVELOPMENT DATA"
          detail="Displaying development baseline alert telemetry. Real Wazuh SIEM collector connection pending."
        />
      )}

      {/* Filter and Search Bar */}
      <div className="card p-4 space-y-3 bg-[#0c101a]">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by rule description, rule ID (5710), host IP, agent, or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#07090e] border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {/* Severity selector */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="bg-[#07090e] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500/50 font-mono"
            >
              <option value="all">Severity: All Levels</option>
              <option value="critical">Critical (L12-15)</option>
              <option value="high">High (L8-11)</option>
              <option value="medium">Medium (L5-7)</option>
              <option value="low">Low (L0-4)</option>
            </select>

            {/* Status selector */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-[#07090e] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500/50 font-mono"
            >
              <option value="all">Status: All</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
        </div>

        {/* Active Filter Chips */}
        {(selectedSeverity !== 'all' || selectedStatus !== 'all' || searchQuery) && (
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80 text-[11px] font-mono text-zinc-400">
            <span>Filters:</span>
            {searchQuery && (
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                Query: &quot;{searchQuery}&quot;
              </span>
            )}
            {selectedSeverity !== 'all' && (
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 uppercase">
                {selectedSeverity}
              </span>
            )}
            {selectedStatus !== 'all' && (
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 uppercase">
                {selectedStatus}
              </span>
            )}
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedSeverity('all');
                setSelectedStatus('all');
              }}
              className="text-cyan-400 hover:underline ml-auto"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Alert Stream Table */}
      {loading ? (
        <LoadingSkeleton type="table" count={6} />
      ) : filteredAlerts.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No Matching Security Alerts"
          description="Try broadening your search query or resetting active filters."
          action={
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedSeverity('all');
                setSelectedStatus('all');
              }}
              className="btn btn-secondary text-xs"
            >
              Reset Filters
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800/80 bg-[#090d16] text-zinc-400 font-mono uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-10"></th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-cyan-400 transition-colors select-none"
                    onClick={() => toggleSort('severity')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Severity</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-cyan-400 transition-colors select-none"
                    onClick={() => toggleSort('timestamp')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Timestamp</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Rule & Detection</th>
                  <th className="py-3 px-4">Agent</th>
                  <th className="py-3 px-4">Source IP</th>
                  <th className="py-3 px-4">Dest IP</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-sans">
                {filteredAlerts.map((alert) => {
                  const isExpanded = expandedRowId === alert.id;
                  return (
                    <React.Fragment key={alert.id}>
                      <tr
                        onClick={() => toggleRow(alert.id)}
                        className={`hover:bg-cyan-950/20 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-cyan-950/30' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-zinc-500">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <SeverityBadge severity={alert.severity} showLevel />
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-400 whitespace-nowrap text-[11px]">
                          {new Date(alert.timestamp).toLocaleString([], {
                            month: 'short',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-zinc-200 line-clamp-1">
                            {alert.rule_description}
                          </div>
                          <div className="font-mono text-[10px] text-zinc-400 mt-0.5">
                            RULE-{alert.rule_id}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-300 whitespace-nowrap">
                          {alert.agent_name}
                        </td>
                        <td className="py-3 px-4 font-mono text-cyan-400/90 whitespace-nowrap">
                          {alert.source_ip || (
                            <span className="text-zinc-500 font-normal italic">local</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-400 whitespace-nowrap">
                          {alert.destination_ip || (
                            <span className="text-zinc-500 italic">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-300 whitespace-nowrap">
                          {alert.username || <span className="text-zinc-500 italic">-</span>}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <StatusBadge status={alert.status} />
                        </td>
                        <td
                          className="py-3 px-4 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              to={`/alerts/${alert.id}`}
                              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-cyan-300 transition-colors"
                              title="Forensic Alert Details"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                            <Link
                              to="/investigation"
                              className="px-2 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/50 text-[11px] font-medium transition-colors"
                            >
                              Triage
                            </Link>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable row for quick context inspection */}
                      {isExpanded && (
                        <tr className="bg-[#0a0e17] border-b border-zinc-800">
                          <td colSpan={10} className="p-4 sm:p-5">
                            <div className="rounded-lg bg-[#07090e] border border-zinc-800 p-4 space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-800 pb-3">
                                <div className="flex items-center gap-2">
                                  <Terminal className="w-4 h-4 text-cyan-400" />
                                  <span className="font-mono text-xs font-semibold text-zinc-200">
                                    Quick Telemetry Inspector — Alert #{alert.id} ({alert.external_alert_id})
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Link
                                    to={`/alerts/${alert.id}`}
                                    className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-mono"
                                  >
                                    <span>Full Forensic Dossier</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </Link>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                                <div>
                                  <span className="text-zinc-500 block text-[10px] uppercase">
                                    Rule Specification
                                  </span>
                                  <span className="text-zinc-300">
                                    ID {alert.rule_id} — {alert.rule_description}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 block text-[10px] uppercase">
                                    Agent Node
                                  </span>
                                  <span className="text-zinc-300">{alert.agent_name}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 block text-[10px] uppercase">
                                    Account & Target
                                  </span>
                                  <span className="text-zinc-300">
                                    User: {alert.username || 'N/A'} | Dest:{' '}
                                    {alert.destination_ip || 'Internal'}
                                  </span>
                                </div>
                              </div>

                              {alert.raw_data && (
                                <div className="space-y-1">
                                  <span className="text-zinc-500 text-[10px] font-mono uppercase">
                                    Raw Log Stream
                                  </span>
                                  <pre className="p-2.5 rounded bg-black/60 border border-zinc-800/80 text-[11px] font-mono text-emerald-400/90 overflow-x-auto">
                                    {alert.raw_data}
                                  </pre>
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-2">
                                <span className="text-[11px] text-zinc-400 font-mono">
                                  Ingested at {new Date(alert.created_at).toISOString()}
                                </span>
                                <Link
                                  to="/investigation"
                                  className="btn btn-primary text-xs flex items-center gap-2"
                                >
                                  <SearchCode className="w-3.5 h-3.5" />
                                  <span>Transfer to Investigation Workspace</span>
                                </Link>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Alerts;
