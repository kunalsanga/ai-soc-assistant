import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  ShieldAlert,
  FileSearch,
  BookOpen,
  BarChart3,
  Layers,
  Settings as SettingsIcon,
  X,
  ExternalLink,
} from 'lucide-react';
import { alertService } from '../../services/api';
import type { Alert } from '../../types/alert';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsError, setAlertsError] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch real alerts once when the palette opens.
  useEffect(() => {
    if (!isOpen) return;
    // Skip the initial refetch when palettes open from the same alert page.
    setQuery('');
    let cancelled = false;
    alertService
      .getAlerts()
      .then((data) => {
        if (!cancelled) {
          setAlerts(Array.isArray(data) ? data : []);
          setAlertsError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setAlertsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, category: 'Workflow' },
    { label: 'Alert Stream', path: '/alerts', icon: ShieldAlert, category: 'Workflow' },
    { label: 'AI Analysis', path: '/ai-analysis', icon: FileSearch, category: 'Workflow' },
    { label: 'Security Knowledge', path: '/knowledge', icon: BookOpen, category: 'Research' },
    { label: 'RAG Evaluation', path: '/evaluation', icon: BarChart3, category: 'Research' },
    { label: 'Architecture & Status', path: '/architecture', icon: Layers, category: 'System' },
    { label: 'Settings & Diagnostics', path: '/settings', icon: SettingsIcon, category: 'System' },
  ];

  const filteredNav = navItems.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  const filteredAlerts = alerts
    .filter(
      (a) =>
        a.rule_description.toLowerCase().includes(query.toLowerCase()) ||
        (a.rule_id && a.rule_id.includes(query)) ||
        (a.source_ip && a.source_ip.includes(query)) ||
        (a.username && a.username.toLowerCase().includes(query.toLowerCase()))
    )
    .slice(0, 4);

  const handleSelect = (path: string) => {
    // Avoid pushing a duplicate history entry when already there.
    if (location.pathname !== path) navigate(path);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#0e131f] border border-cyan-500/30 rounded-xl shadow-2xl overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-zinc-800 bg-[#090d16]">
          <Search className="w-5 h-5 text-cyan-400 shrink-0 mr-3" />
          <input
            type="text"
            placeholder="Type a command, route, or search alerts by rule, IP, or user..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-zinc-500 hover:text-zinc-300 p-1 mr-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
            ESC
          </span>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-zinc-800/40">
          {/* Matched Pages */}
          {filteredNav.length > 0 && (
            <div className="py-2">
              <div className="px-3 py-1 text-[11px] font-mono font-medium text-zinc-500 uppercase tracking-wider">
                Pages
              </div>
              <div className="mt-1 space-y-1">
                {filteredNav.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelect(item.path)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm text-zinc-300 hover:text-cyan-400 hover:bg-zinc-800/60 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
                        <span>{item.label}</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-400">
                        {item.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Real alert lookup */}
          {alertsError ? (
            <div className="p-4 text-xs text-zinc-500 font-mono">
              Alert search unavailable — the backend could not be reached.
            </div>
          ) : query.trim().length > 0 && filteredAlerts.length > 0 ? (
            <div className="py-2">
              <div className="px-3 py-1 text-[11px] font-mono font-medium text-zinc-500 uppercase tracking-wider">
                Matching Alerts (from database)
              </div>
              <div className="mt-1 space-y-1">
                {filteredAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => handleSelect(`/alerts/${alert.id}`)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm text-zinc-300 hover:text-cyan-400 hover:bg-zinc-800/60 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50 shrink-0">
                        #{alert.id}
                      </span>
                      <span className="line-clamp-1">{alert.rule_description}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 shrink-0">
                      <span>{alert.source_ip || alert.agent_name}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-cyan-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {filteredNav.length === 0 && (alertsError || filteredAlerts.length === 0) && (
            <div className="p-8 text-center text-sm text-zinc-500">
              No navigation commands or alerts matching &quot;{query}&quot;
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#090d16] border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <span>AI SOC Assistant — Command Interface</span>
          <div className="flex items-center gap-3">
            <span>ESC Close</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
