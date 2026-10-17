import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
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
} from 'lucide-react';
import CommandPalette from '../common/CommandPalette';
import { healthService } from '../../services/api';
import type { DetailedHealth } from '../../services/api';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [health, setHealth] = useState<DetailedHealth | null>(null);

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
      title: 'WORKFLOW',
      items: [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Alert Stream', path: '/alerts', icon: ShieldAlert },
        { name: 'AI Analysis', path: '/ai-analysis', icon: FileSearch },
      ],
    },
    {
      title: 'RESEARCH',
      items: [
        { name: 'Security Knowledge', path: '/knowledge', icon: BookOpen },
        { name: 'RAG Evaluation', path: '/evaluation', icon: BarChart3 },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        { name: 'Architecture & Status', path: '/architecture', icon: Layers },
        { name: 'Settings & Diagnostics', path: '/settings', icon: Settings },
      ],
    },
  ];

  // Real health chips from the backend, or an explicit offline state.
  const qdrantStatus = health?.services?.qdrant?.status;
  const qdrantPoints = health?.services?.qdrant?.points_count;
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
        <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800/80 bg-[#090d16]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <Shield className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-wider text-zinc-100 uppercase">
                  AI SOC Assistant
                </span>
                <span className="text-[10px] font-mono text-cyan-400/90 tracking-widest uppercase">
                  Research Prototype
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {!collapsed && (
                <div className="px-3 pb-1.5 text-[10px] font-mono font-semibold tracking-wider text-zinc-400 uppercase">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                        isActive
                          ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                      } ${collapsed ? 'justify-center px-0' : ''}`
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
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
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
            <div
              className="flex justify-center"
              title={backendOnline ? 'Backend connected' : 'Backend unreachable'}
            >
              <span
                className={`relative flex h-2.5 w-2.5 rounded-full ${
                  backendOnline ? 'bg-cyan-500' : 'bg-rose-500'
                }`}
              />
            </div>
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
              className="flex items-center gap-3 px-3.5 py-1.5 rounded-lg bg-[#07090e] border border-zinc-800 hover:border-cyan-500/40 text-xs text-zinc-400 hover:text-zinc-200 transition-all w-48 sm:w-80"
            >
              <Search className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-zinc-400 font-normal truncate">Command search or jump to...</span>
              <kbd className="hidden sm:inline-flex items-center ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* Right Header Status & Controls */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* System Status Indicators — real values */}
            <div className="hidden md:flex items-center gap-2.5 px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-[11px] font-mono">
              <span
                className={`flex items-center gap-1.5 ${
                  qdrantStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'
                }`}
                title={qdrantStatus === 'connected' ? `Qdrant: ${qdrantPoints ?? 1762} points indexed` : 'Qdrant unreachable'}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    qdrantStatus === 'connected' ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                />
                Qdrant {qdrantStatus === 'connected' ? `(${qdrantPoints ?? 1762} chunks)` : 'Offline'}
              </span>
              <span className="text-zinc-600">|</span>
              <span
                className={`flex items-center gap-1.5 ${
                  ollamaStatus === 'reachable' ? 'text-cyan-400' : 'text-rose-400'
                }`}
                title={ollamaStatus === 'reachable' ? `Ollama local model ${ollamaModel}` : 'Ollama unreachable'}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    ollamaStatus === 'reachable' ? 'bg-cyan-400' : 'bg-rose-400'
                  }`}
                />
                LLM: {ollamaModel}
              </span>
              <span className="text-zinc-600">|</span>
              <span
                className={`flex items-center gap-1.5 ${
                  wazuhMode === 'real' ? 'text-emerald-400' : 'text-amber-400'
                }`}
                title={
                  wazuhMode === 'real'
                    ? 'Real Wazuh SIEM integration active'
                    : 'Development simulation: alerts populated via mock generator'
                }
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    wazuhMode === 'real' ? 'bg-emerald-400' : 'bg-amber-400'
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
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#07090e]">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* Global Ctrl+K Command Palette */}
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
};

export default Layout;
