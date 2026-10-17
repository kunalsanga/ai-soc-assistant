import React, { useState, useEffect, useCallback } from 'react';
import { Server, RefreshCw, TriangleAlert } from 'lucide-react';
import { healthService } from '../services/api';
import type { DetailedHealth } from '../services/api';
import PageHeader from '../components/common/PageHeader';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

const Settings: React.FC = () => {
  const [health, setHealth] = useState<DetailedHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHealth(await healthService.check());
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as { message?: string })?.message ||
        'backend not running';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const services = health?.services ?? {};

  const serviceRows = Object.entries(services).map(([name, svc]) => {
    const status = String(svc?.status ?? 'unknown');
    const ok = ['connected', 'reachable', 'using_mock_client', 'real_mode'].includes(status);
    return {
      name,
      status,
      ok,
      detail:
        Object.entries(svc)
          .filter(([k, v]) => k !== 'status' && v != null)
          .map(([k, v]) => `${k}=${String(v)}`)
          .join(' · ') || '—',
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Diagnostics"
        subtitle="Read-only view of the backend's live configuration and real service connectivity. Configuration is set through backend/.env — this page cannot change it."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Settings' }]}
        badge={
          health ? (
            <span
              className={`font-mono text-xs px-2.5 py-0.5 rounded-full border ${
                health.dependencies_ok
                  ? 'text-emerald-400 bg-emerald-950/80 border-emerald-800/40'
                  : 'text-amber-400 bg-amber-950/80 border-amber-800/40'
              }`}
            >
              {health.dependencies_ok ? 'All dependencies reachable' : 'Some dependencies unreachable'}
            </span>
          ) : null
        }
        actions={
          <button onClick={load} className="btn btn-secondary flex items-center gap-2 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh Diagnostics</span>
          </button>
        }
      />

      {loading ? (
        <LoadingSkeleton type="card" count={3} />
      ) : error || !health ? (
        <div className="card p-10 border-rose-500/30 flex flex-col items-center space-y-3">
          <TriangleAlert className="w-10 h-10 text-rose-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Backend unreachable</h2>
          <p className="text-xs font-mono text-rose-300 break-all max-w-xl">{error}</p>
          <p className="text-xs text-zinc-400">
            Start the API from backend/ with
            <code className="mx-1 text-cyan-400">python -m uvicorn app.main:app --reload</code>
            then refresh.
          </p>
          <button onClick={load} className="btn btn-secondary text-xs">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Active configuration (no secrets) */}
          <div className="card p-5">
            <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3 mb-4">
              <Server className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Active Configuration</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
              {Object.entries(health.config).map(([key, value]) => (
                <div key={key} className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <div className="text-[10px] uppercase text-zinc-500">{key}</div>
                  <div className="text-zinc-200 mt-1 break-all">
                    {key === 'wazuh_mode' && value === 'mock' ? (
                      <>
                        <span className="text-amber-400">mock</span>{' '}
                        <span className="text-zinc-500">(development mock alerts)</span>
                      </>
                    ) : (
                      String(value)
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Service connectivity — real checks */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-zinc-200 border-b border-zinc-800/80 pb-3 mb-4">
              Service Connectivity (bounded-timeout checks)
            </h2>
            <div className="space-y-2.5">
              {serviceRows.map((svc) => (
                <div
                  key={svc.name}
                  className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800/90 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-zinc-200 capitalize">{svc.name}</div>
                    <div className="text-[11px] font-mono text-zinc-400 mt-0.5 break-all">
                      {svc.detail}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-mono px-2.5 py-1 rounded border whitespace-nowrap ${
                      svc.ok
                        ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40'
                        : 'text-rose-400 bg-rose-950/60 border-rose-800/40'
                    }`}
                  >
                    {svc.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4 text-[11px] text-zinc-500">
            Note: this prototype has no authentication layer. It is a local research tool — the API
            must not be exposed to untrusted networks. Wazuh credentials live only in backend/.env
            and are never sent to the frontend.
          </div>
        </>
      )}
    </div>
  );
};

export default Settings;
