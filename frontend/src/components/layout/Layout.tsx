import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Shield,
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
  Settings,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  User,
} from 'lucide-react';
import CommandPalette from '../common/CommandPalette';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const navSections = [
    {
      title: 'MAIN',
      items: [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Alert Stream', path: '/alerts', icon: ShieldAlert, badge: 'Live' },
        { name: 'Investigations', path: '/investigation', icon: SearchCode },
      ],
    },
    {
      title: 'INTELLIGENCE',
      items: [
        { name: 'Security Context', path: '/security-context', icon: Network },
        { name: 'Threat Intelligence', path: '/threat-intelligence', icon: Binary },
        { name: 'Evidence & RAG', path: '/evidence', icon: FileCheck },
        { name: 'AI Analysis', path: '/ai-analysis', icon: Cpu },
      ],
    },
    {
      title: 'PLATFORM',
      items: [
        { name: 'Architecture', path: '/architecture', icon: Layers },
        { name: 'RAG Evaluation', path: '/evaluation', icon: BarChart3 },
        { name: 'Project Status', path: '/project-status', icon: ListTodo },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        { name: 'Settings', path: '/settings', icon: Settings },
      ],
    },
  ];

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
                  Enterprise SecOps
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
                    {!collapsed && (
                      <div className="flex items-center justify-between w-full">
                        <span>{item.name}</span>
                        {item.badge && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        {/* Sidebar Footer — Status honest to development mode */}
        <div className="p-3 border-t border-zinc-800/80 bg-[#090d16]">
          {!collapsed ? (
            <div className="px-2 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                </span>
                <span className="text-[11px] font-mono text-zinc-300">SOC Console</span>
              </div>
              <span className="text-[10px] font-mono text-cyan-400/90 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/40">
                DEV ACTIVE
              </span>
            </div>
          ) : (
            <div className="flex justify-center" title="SOC Console: Active (Dev Mode)">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
              </span>
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
            {/* System Status Indicators */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-[11px] font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Backend API
              </span>
              <span className="text-zinc-600">|</span>
              <span className="flex items-center gap-1.5 text-amber-400" title="Wazuh integration pending">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Wazuh (Dev Mode)
              </span>
            </div>

            {/* Notification Icon */}
            <button
              onClick={() => setPaletteOpen(true)}
              className="relative p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#0c101a]" />
            </button>

            {/* Analyst Profile Menu */}
            <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-zinc-800">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-700 p-0.5 flex items-center justify-center text-zinc-100 font-semibold text-xs shadow-md">
                <User className="w-4 h-4" />
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-medium text-zinc-200 leading-tight">Bivan</span>
                <span className="text-[10px] font-mono text-cyan-400 leading-tight">Lead SecOps / Frontend</span>
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
