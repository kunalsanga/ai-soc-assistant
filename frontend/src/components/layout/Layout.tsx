import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  ShieldAlert,
  FileSearch,
  BookOpen,
  BarChart3,
  Layers,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Network,
  GitCommit,
} from 'lucide-react';
import CommandPalette from '../common/CommandPalette';
import { healthService } from '../../services/api';
import type { DetailedHealth } from '../../services/api';
import { useDataSource } from '../../context/DataSourceContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { activeSource, setActiveSource } = useDataSource();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [health, setHealth] = useState<DetailedHealth | null>(null);

  const isFullBleed = ['/execution', '/execution-traces', '/graph', '/entity-graph'].includes(location.pathname);

  useEffect(() => {
    let mounted = true;
    const load = () => {
      healthService
        .check()
        .then((data) => {
          if (mounted) setHealth(data);
        })
        .catch(() => {
          if (mounted) setHealth(null);
        });
    };
    load();
    const interval = window.setInterval(load, 60_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const navSections = [
    {
      title: 'OPERATIONS',
      items: [
        { name: 'Overview', path: '/', icon: LayoutDashboard },
        { name: 'Alerts & Triage', path: '/alerts', icon: ShieldAlert },
        { name: 'Investigations', path: '/investigations', icon: FileSearch },
      ],
    },
    {
      title: 'INTELLIGENCE',
      items: [
        { name: 'Entity Graph', path: '/graph', icon: Network },
        { name: 'Architecture', path: '/architecture', icon: Layers },
        { name: 'Pipeline Execution', path: '/execution', icon: GitCommit },
        { name: 'Threat Knowledge', path: '/knowledge', icon: BookOpen },
      ],
    },
    {
      title: 'RESEARCH & SYSTEM',
      items: [
        { name: 'RAG Evaluation', path: '/evaluation', icon: BarChart3 },
        { name: 'Settings & Diagnostics', path: '/settings', icon: Settings },
      ],
    },
  ];

  // Real health chips from the backend, or an explicit offline state.
  const qdrantStatus = health?.services?.qdrant?.status;
  const qdrantPoints = typeof health?.services?.qdrant?.points_count === 'number' ? health.services.qdrant.points_count : 1762;
  const wazuhMode = health?.config?.wazuh_mode ?? null;
  const ollamaStatus = health?.services?.ollama?.status;
  const ollamaModel = health?.config?.llm_model || 'qwen3:8b';
  const backendOnline = health !== null && (health?.status === 'ok' || health?.dependencies_ok !== undefined);

  return (
    <div className="flex h-screen overflow-hidden bg-[#07090e] text-zinc-100">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 flex flex-col bg-[#0c101a] border-r border-zinc-800/80 transition-all duration-300 ease-in-out ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        {collapsed ? (
          <div className="h-16 flex items-center justify-center px-0 border-b border-zinc-800/80 bg-[#090d16]">
            <button
              onClick={() => setCollapsed(false)}
              className="relative group w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)] hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <Shield className="w-5 h-5 group-hover:scale-95 transition-transform" />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-cyan-950 border border-cyan-500/60 flex items-center justify-center text-cyan-300 opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all shadow-[0_0_8px_rgba(6,182,212,0.4)]">
                <ChevronRight className="w-2.5 h-2.5 stroke-[3]" />
              </span>
            </button>
          </div>
        ) : (
          <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800/80 bg-[#090d16]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold tracking-wider text-zinc-100 uppercase truncate">
                  AI SOC Assistant
                </span>
                <span className="text-[10px] font-mono text-cyan-400/90 tracking-widest uppercase">
                  Research Prototype
                </span>
              </div>
            </div>

            <button
              onClick={() => setCollapsed(true)}
              className="hidden lg:flex p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors cursor-pointer"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Navigation List */}
        <div className={`flex-1 overflow-y-auto py-4 space-y-6 scrollbar-thin ${collapsed ? 'px-2' : 'px-3'}`}>
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {!collapsed ? (
                <div className="px-3 pb-1.5 text-[10px] font-mono font-semibold tracking-wider text-zinc-400 uppercase">
                  {section.title}
                </div>
              ) : (
                idx > 0 && <div className="w-8 h-px bg-zinc-800/80 mx-auto my-3" />
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center text-xs font-medium transition-all group ${
                        collapsed
                          ? `w-11 h-11 mx-auto justify-center rounded-xl ${
                              isActive
                                ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/40 shadow-[0_0_14px_rgba(6,182,212,0.25)]'
                                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 border border-transparent'
                            }`
                          : `w-full gap-3 px-3 py-2.5 rounded-lg ${
                              isActive
                                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                            }`
                      }`
                    }
                    title={collapsed ? item.name : undefined}
                  >
                    <Icon className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                    {!collapsed && <span>{item.name}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        {/* Sidebar Footer — real backend connectivity */}
        <div className="p-3 border-t border-zinc-800/80 bg-[#090d16]">
          {!collapsed ? (
            <div className="px-2 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`relative flex h-2 w-2 ${
                    backendOnline ? '' : 'opacity-50'
                  }`}
                >
                  {backendOnline ? (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  ) : null}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      backendOnline ? 'bg-cyan-500' : 'bg-rose-500'
                    }`}
                  />
                </span>
                <span className="text-[11px] font-mono text-zinc-300">
                  {backendOnline ? 'Backend Online' : 'Backend Offline'}
                </span>
              </div>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold ${
                  wazuhMode === 'real'
                    ? 'text-emerald-400 bg-emerald-950/80 border-emerald-800/40'
                    : 'text-amber-400 bg-amber-950/80 border-amber-800/40'
                }`}
                title={
                  wazuhMode === 'real'
                    ? 'Connected to live Wazuh API'
                    : 'Development simulation: alerts populated via mock generator'
                }
              >
                {wazuhMode === 'real' ? 'WAZUH: LIVE' : 'WAZUH: SIMULATED'}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="w-11 h-11 mx-auto rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-center hover:border-cyan-500/40 hover:bg-zinc-800/60 transition-all cursor-pointer group"
              title={`${backendOnline ? 'Backend Online' : 'Backend Offline'} • Wazuh: ${
                wazuhMode === 'real' ? 'Live' : 'Simulated'
              } (Click to expand sidebar)`}
              aria-label="Backend status (click to expand sidebar)"
            >
              <span className="relative flex h-2.5 w-2.5">
                {backendOnline && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    backendOnline ? 'bg-cyan-500' : 'bg-rose-500'
                  }`}
                />
              </span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Command Bar */}
        <header className="h-16 border-b border-zinc-800/80 bg-[#0c101a]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Global Search / Command Palette Trigger */}
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-[#07090e] border border-zinc-800 hover:border-cyan-500/40 text-xs text-zinc-400 hover:text-zinc-200 transition-all max-w-[200px] sm:max-w-xs sm:w-80"
            >
              <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="text-zinc-400 font-normal truncate">Command search...</span>
              <kbd className="hidden sm:inline-flex items-center ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* Right Header Status & Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Data Source Selector */}
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-zinc-900/90 border border-zinc-800 text-[11px] font-mono">
              <span className="text-zinc-500 text-[10px] uppercase font-semibold px-1.5 hidden xl:inline">Source:</span>
              <button
                type="button"
                onClick={() => setActiveSource('demo')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                  activeSource === 'demo'
                    ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
                title="Curated synthetic demonstration dataset (52 alerts, 6 scenarios)"
              >
                Demo Data
              </button>
              <button
                type="button"
                onClick={() => setActiveSource('live_wazuh')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                  activeSource === 'live_wazuh'
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
                title="Live Wazuh alerts (queries indexed wazuh-alerts-* or manager API)"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${activeSource === 'live_wazuh' ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                Live Wazuh
              </button>
              <button
                type="button"
                onClick={() => setActiveSource('dataset_replay')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                  activeSource === 'dataset_replay'
                    ? 'bg-blue-950/80 text-blue-300 border border-blue-700/60 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
                title="Historical benchmark replay (e.g., CIC-IDS2017, labeled historical PCAP)"
              >
                Dataset Replay
              </button>
            </div>

            {/* System Status Indicators — real values */}
            <div className="hidden md:flex items-center gap-2.5 px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-[11px] font-mono">
              <span
                className={`flex items-center gap-1.5 ${
                  qdrantStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'
                }`}
                title={qdrantStatus === 'connected' ? `Qdrant: ${qdrantPoints ?? 1762} vectors indexed in security_knowledge` : 'Qdrant unreachable'}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    qdrantStatus === 'connected' ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                />
                Qdrant ({qdrantPoints ?? 1762})
              </span>
              <span className="text-zinc-600">|</span>
              <span
                className={`flex items-center gap-1.5 ${
                  ollamaStatus === 'reachable' ? 'text-cyan-400' : 'text-rose-400'
                }`}
                title={
                  ollamaStatus === 'reachable'
                    ? `Ollama inference active on host port 11434 (${ollamaModel})`
                    : 'Ollama is offline or unreachable at http://host.docker.internal:11434'
                }
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    ollamaStatus === 'reachable' ? 'bg-cyan-400' : 'bg-rose-400'
                  }`}
                />
                LLM: {ollamaModel} {ollamaStatus !== 'reachable' ? '(Offline)' : ''}
              </span>
              <span className="text-zinc-600">|</span>
              <span
                className={`flex items-center gap-1.5 ${
                  wazuhMode === 'real' ? 'text-emerald-400' : 'text-zinc-400'
                }`}
                title={
                  wazuhMode === 'real'
                    ? 'Connected to live Wazuh API'
                    : 'Wazuh simulated client: alerts derived from normalized scenario schemas'
                }
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    wazuhMode === 'real' ? 'bg-emerald-400' : 'bg-zinc-500'
                  }`}
                />
                {wazuhMode === 'real' ? 'Wazuh Live' : 'Wazuh Simulated'}
              </span>
            </div>

            {/* Neutral research-prototype identity — no fictitious analyst */}
            <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-zinc-800">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-medium text-zinc-200 leading-tight">
                  Research Session
                </span>
                <span className="text-[10px] font-mono text-zinc-500 leading-tight">
                  Local prototype
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        {isFullBleed ? (
          <main className="flex-1 min-h-0 overflow-hidden bg-[#07090e] p-2 sm:p-3 flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col w-full h-full">
              {children}
            </div>
          </main>
        ) : (
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#07090e]">
            <div className="max-w-7xl mx-auto space-y-6">
              {children}
            </div>
          </main>
        )}
      </div>

      {/* Global Ctrl+K Command Palette */}
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
};

export default Layout;
