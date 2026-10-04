import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  ShieldAlert,
  SearchCode,
  Network,
  Binary,
  FileCheck,
  Cpu,
  Layers,
  BarChart3,
  ListTodo,
  Settings as SettingsIcon,
  X,
  ExternalLink,
} from 'lucide-react';
import { mockAlerts } from '../../data/mockAlerts';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

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

  if (!isOpen) return null;

  const navItems = [
    { label: 'SOC Overview / Dashboard', path: '/', icon: LayoutDashboard, category: 'Navigation' },
    { label: 'Alert Stream & Queue', path: '/alerts', icon: ShieldAlert, category: 'Navigation' },
    { label: 'Investigation Workspace', path: '/investigation', icon: SearchCode, category: 'Navigation' },
    { label: 'Security Context Explorer', path: '/security-context', icon: Network, category: 'Intelligence' },
    { label: 'Threat Intelligence Feeds', path: '/threat-intelligence', icon: Binary, category: 'Intelligence' },
    { label: 'Evidence & Knowledge Grounding', path: '/evidence', icon: FileCheck, category: 'Intelligence' },
    { label: 'AI Incident Analysis', path: '/ai-analysis', icon: Cpu, category: 'Intelligence' },
    { label: 'Architecture & Pipeline Topology', path: '/architecture', icon: Layers, category: 'Platform' },
    { label: 'RAG Model Evaluation', path: '/evaluation', icon: BarChart3, category: 'Platform' },
    { label: 'Project Implementation Status', path: '/project-status', icon: ListTodo, category: 'Platform' },
    { label: 'SOC Settings & API Connections', path: '/settings', icon: SettingsIcon, category: 'System' },
  ];

  const filteredNav = navItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  const filteredAlerts = mockAlerts
    .filter(
      (a) =>
        a.rule_description.toLowerCase().includes(query.toLowerCase()) ||
        a.rule_id.includes(query) ||
        (a.source_ip && a.source_ip.includes(query)) ||
        (a.username && a.username.toLowerCase().includes(query.toLowerCase()))
    )
    .slice(0, 4);

  const handleSelect = (path: string) => {
    navigate(path);
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
            placeholder="Type a command, route, IP (10.0.3.47), rule ID (5710), or keyword..."
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
                Pages & Workspaces
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

          {/* Quick Alert Lookup */}
          {query.trim().length > 0 && filteredAlerts.length > 0 && (
            <div className="py-2">
              <div className="px-3 py-1 text-[11px] font-mono font-medium text-zinc-500 uppercase tracking-wider">
                Matching Telemetry Alerts
              </div>
              <div className="mt-1 space-y-1">
                {filteredAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => handleSelect(`/alerts/${alert.id}`)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm text-zinc-300 hover:text-cyan-400 hover:bg-zinc-800/60 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">
                        #{alert.id}
                      </span>
                      <span className="line-clamp-1">{alert.rule_description}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                      <span>{alert.source_ip || alert.agent_name}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-cyan-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredNav.length === 0 && filteredAlerts.length === 0 && (
            <div className="p-8 text-center text-sm text-zinc-500">
              No navigation commands or telemetry matching &quot;{query}&quot;
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#090d16] border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <span>Enterprise SOC Command Interface</span>
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
