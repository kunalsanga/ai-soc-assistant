import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, AlertOctagon, ShieldAlert, Clock } from 'lucide-react';
import { Alert } from '../types/alert';
import { alertService } from '../services/api';

const Dashboard: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, we'd fetch from our backend
    // For now, we'll use mock data if the backend isn't ready
    const fetchAlerts = async () => {
      try {
        const data = await alertService.getAlerts();
        setAlerts(data);
      } catch (error) {
        console.error("Failed to fetch alerts, using mock fallback", error);
        setAlerts([
          {
            id: 1,
            external_alert_id: "mock-001",
            timestamp: new Date().toISOString(),
            severity: 10,
            rule_id: "5710",
            rule_description: "Multiple authentication failures",
            agent_name: "linux-lab",
            source_ip: "192.168.1.20",
            username: "test-user",
            status: "open",
            created_at: new Date().toISOString()
          },
          {
            id: 2,
            external_alert_id: "mock-002",
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            severity: 12,
            rule_id: "100001",
            rule_description: "Suspicious binary execution",
            agent_name: "win-desktop-01",
            username: "admin",
            status: "open",
            created_at: new Date(Date.now() - 3600000).toISOString()
          }
        ]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAlerts();
  }, []);

  const stats = [
    { title: 'Total Alerts', value: alerts.length, icon: <AlertTriangle size={24} className="text-blue-500" /> },
    { title: 'Critical Alerts', value: alerts.filter(a => a.severity >= 12).length, icon: <AlertOctagon size={24} className="text-red-500" /> },
    { title: 'High Alerts', value: alerts.filter(a => a.severity >= 8 && a.severity < 12).length, icon: <ShieldAlert size={24} className="text-orange-500" /> },
    { title: 'Under Investigation', value: alerts.filter(a => a.status === 'investigating').length, icon: <Clock size={24} className="text-yellow-500" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white tracking-wide">SOC Overview</h1>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="glass-panel p-6 rounded-xl hover:bg-[var(--color-surface-hover)] transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-muted)] font-medium">{stat.title}</p>
                <p className="text-3xl font-bold text-white mt-2">{loading ? '-' : stat.value}</p>
              </div>
              <div className="p-3 bg-[var(--color-background)] rounded-lg">
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Alerts Table */}
      <div className="glass-panel rounded-xl overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-medium text-white">Recent Security Events</h2>
          <Link to="/alerts" className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors">
            View All
          </Link>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--color-background)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Severity</th>
                <th className="px-6 py-4 font-medium">Timestamp</th>
                <th className="px-6 py-4 font-medium">Rule</th>
                <th className="px-6 py-4 font-medium">Agent</th>
                <th className="px-6 py-4 font-medium">Source IP</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {alerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold ${
                      alert.severity >= 12 ? 'bg-red-500/20 text-red-500 border border-red-500/30' :
                      alert.severity >= 8 ? 'bg-orange-500/20 text-orange-500 border border-orange-500/30' :
                      'bg-blue-500/20 text-blue-500 border border-blue-500/30'
                    }`}>
                      Level {alert.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--color-text-muted)]">
                    {new Date(alert.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-white">{alert.rule_description}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">Rule ID: {alert.rule_id}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--color-text-muted)]">{alert.agent_name}</td>
                  <td className="px-6 py-4 text-sm font-mono text-[var(--color-text-muted)]">{alert.source_ip || '-'}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center text-xs font-medium text-slate-300 capitalize">
                      {alert.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link to={`/alerts/${alert.id}`} className="text-sm text-[var(--color-primary)] hover:text-white transition-colors">
                      Investigate
                    </Link>
                  </td>
                </tr>
              ))}
              {alerts.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-[var(--color-text-muted)]">
                    No alerts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
