import React from 'react';
import { NavLink } from 'react-router-dom';
import { Shield, LayoutDashboard, AlertTriangle, Activity, Search, Settings } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'Alerts', path: '/alerts', icon: <AlertTriangle size={20} /> },
    { name: 'Analysis', path: '/analysis', icon: <Activity size={20} /> },
    { name: 'Investigation', path: '/investigation', icon: <Search size={20} /> },
    { name: 'Settings', path: '/settings', icon: <Settings size={20} /> },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
      {/* Sidebar */}
      <aside className="w-64 glass-panel border-r border-slate-800 flex flex-col transition-all duration-300">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <Shield className="text-[var(--color-primary)] mr-3" size={24} />
          <h1 className="text-xl font-bold tracking-wider text-white">SOC Assist</h1>
        </div>
        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--color-primary-hover)] bg-opacity-20 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-white'
                }`
              }
            >
              <span className="mr-3">{item.icon}</span>
              {item.name}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 glass-panel border-b border-slate-800 flex items-center justify-between px-6 z-10">
          <div className="text-sm text-[var(--color-text-muted)]">
            AI-Powered Security Operations Center Assistant
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-xs text-[var(--color-text-muted)]">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
              Wazuh (Mock)
            </div>
            <div className="flex items-center text-xs text-[var(--color-text-muted)]">
              <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></span>
              AI Pipeline (Pending)
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[var(--color-background)] p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
