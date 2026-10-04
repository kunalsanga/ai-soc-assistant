import React, { useState } from 'react';
import {
  Binary,
  ShieldAlert,
  Search,
  Layers,
  ArrowRight,
  Globe,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { mockThreatIntelItems } from '../data/mockThreatIntel';
import PageHeader from '../components/common/PageHeader';
import MockDataDisclaimer from '../components/common/MockDataDisclaimer';

const ThreatIntelligence: React.FC = () => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredItems = mockThreatIntelItems.filter((item) => {
    const matchesType = filterType === 'all' || item.type === filterType;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      item.id.toLowerCase().includes(q) ||
      item.title.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q));
    return matchesType && matchesQuery;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Threat Intelligence & Adversary Mapping"
        subtitle="Correlated tactics, techniques, procedures (TTPs), CVE advisories, and malicious indicator feeds."
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Intelligence' },
          { label: 'Threat Intelligence' },
        ]}
        badge={
          <span className="font-mono text-xs text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-800/40">
            Feed Status: Development Mock
          </span>
        }
      />

      <MockDataDisclaimer
        label="MOCK / DEVELOPMENT DATA"
        detail="Threat Intelligence integration pending live feed synchronization (STIX/TAXII & NVD API endpoints)."
      />

      {/* Intelligence Relationship Graph Visualization */}
      <div className="card p-5 bg-[#090d16] border-zinc-800 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-zinc-200">
              Correlated Threat Graph Relationship Flow
            </h2>
          </div>
          <span className="text-[10px] font-mono text-zinc-400 uppercase">
            Graph Topology Model
          </span>
        </div>

        <div className="flex flex-col lg:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-[#06080e] border border-zinc-800/80 overflow-x-auto text-xs font-mono">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800 w-full lg:w-auto justify-center">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>Alert #1 (Rule 5710)</span>
          </div>

          <ArrowRight className="w-4 h-4 text-zinc-600 hidden lg:block" />

          <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800 w-full lg:w-auto justify-center">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>IP: 10.0.3.47</span>
          </div>

          <ArrowRight className="w-4 h-4 text-zinc-600 hidden lg:block" />

          <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800 w-full lg:w-auto justify-center">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>Indicator: Dictionary Brute</span>
          </div>

          <ArrowRight className="w-4 h-4 text-zinc-600 hidden lg:block" />

          <div className="flex items-center gap-2 p-3 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 w-full lg:w-auto justify-center">
            <Binary className="w-4 h-4 text-cyan-400" />
            <span>MITRE T1110.001</span>
          </div>

          <ArrowRight className="w-4 h-4 text-zinc-600 hidden lg:block" />

          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 w-full lg:w-auto justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Grounding Evidence</span>
          </div>
        </div>
      </div>

      {/* Filter and Query Controls */}
      <div className="card p-4 bg-[#0c101a] space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search threat indicators, CVEs, or MITRE technique IDs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#07090e] border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg border transition-colors ${
                filterType === 'all'
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setFilterType('mitre_technique')}
              className={`px-3 py-1.5 rounded-lg border transition-colors ${
                filterType === 'mitre_technique'
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800'
              }`}
            >
              MITRE ATT&CK
            </button>
            <button
              onClick={() => setFilterType('cve')}
              className={`px-3 py-1.5 rounded-lg border transition-colors ${
                filterType === 'cve'
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800'
              }`}
            >
              CVE / NVD
            </button>
            <button
              onClick={() => setFilterType('ip_reputation')}
              className={`px-3 py-1.5 rounded-lg border transition-colors ${
                filterType === 'ip_reputation'
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800'
              }`}
            >
              Indicators / IP
            </button>
          </div>
        </div>
      </div>

      {/* Intelligence Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="card p-5 space-y-3 hover:border-cyan-500/40 transition-colors group"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-cyan-400">{item.id}</span>
                <h3 className="text-sm font-semibold text-zinc-200 mt-1 line-clamp-1">
                  {item.title}
                </h3>
              </div>
              <span
                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                  item.type === 'mitre_technique'
                    ? 'text-cyan-300 bg-cyan-950/80 border-cyan-800/60'
                    : item.type === 'cve'
                    ? 'text-amber-300 bg-amber-950/80 border-amber-800/60'
                    : 'text-rose-300 bg-rose-950/80 border-rose-800/60'
                }`}
              >
                {item.type.replace('_', ' ')}
              </span>
            </div>

            <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
              {item.description}
            </p>

            <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span className="truncate">{item.source}</span>
              <span className="text-zinc-500 shrink-0">{item.last_updated}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ThreatIntelligence;
