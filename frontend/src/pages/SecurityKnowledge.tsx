import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Database,
  ExternalLink,
  RefreshCw,
  TriangleAlert,
  FileSearch,
} from 'lucide-react';
import { knowledgeService } from '../services/api';
import type { KnowledgeHit, KnowledgeStats } from '../services/api';
import PageHeader from '../components/common/PageHeader';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import EmptyState from '../components/common/EmptyState';

const SecurityKnowledge: React.FC = () => {
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'mitre_attack' | 'nvd_cve'>('all');
  const [results, setResults] = useState<KnowledgeHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const loadStats = useCallback(async () => {
    setStatsError(null);
    try {
      const data = await knowledgeService.getStats();
      setStats(data);
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as { message?: string })?.message ||
        'Unknown error';
      setStatsError(message);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setSearchError(null);
    setSearched(true);
    try {
      const hits = await knowledgeService.search(q, sourceFilter, 10);
      setResults(hits);
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as { message?: string })?.message ||
        'Unknown error';
      setSearchError(message);
      setResults(null);
    } finally {
      setSearching(false);
    }
  }, [query, sourceFilter]);

  const sourceLabel = (source: string | null) =>
    source === 'mitre_attack'
      ? 'MITRE ATT&CK'
      : source === 'nvd_cve'
        ? 'NVD / CVE'
        : (source || 'unknown source');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Knowledge Explorer"
        subtitle="Search the real indexed knowledge corpus (MITRE ATT&CK techniques, NVD/CVE records). Nothing is simulated."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Security Knowledge' }]}
        badge={
          stats ? (
            <span className="font-mono text-xs text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-800/40">
              {stats.counts.all} indexed records
            </span>
          ) : null
        }
        actions={
          <button
            onClick={() => {
              loadStats();
              if (query.trim().length >= 2) handleSearch();
            }}
            className="btn btn-secondary flex items-center gap-2 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Corpus identity — real and honest */}
      <div className="card p-4 flex flex-wrap items-center gap-4 text-xs font-mono">
        {stats ? (
          <>
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              Collection <span className="text-cyan-400">{stats.collection}</span>
            </span>
            <span className="text-zinc-400">
              Embeddings: <span className="text-zinc-200">{stats.embedding}</span>
            </span>
            <span className="text-zinc-400">
              MITRE ATT&CK records: <span className="text-emerald-400">{stats.counts.mitre_attack ?? 0}</span>
            </span>
            <span className="text-zinc-400">
              NVD/CVE records: <span className="text-emerald-400">{stats.counts.nvd_cve ?? 0}</span>
            </span>
            {(stats.counts.nvd_cve ?? 0) === 0 && (
              <span className="text-amber-400">
                NVD not ingested yet — run scripts/fetch_nvd.py + scripts/ingest.py
              </span>
            )}
          </>
        ) : statsError ? (
          <span className="flex items-center gap-2 text-rose-400">
            <TriangleAlert className="w-3.5 h-3.5" />
            Qdrant unreachable: {statsError}
          </span>
        ) : (
          <span className="text-zinc-500">Loading knowledge index stats...</span>
        )}
      </div>

      {/* Search */}
      <div className="card p-4 bg-[#0c101a]">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="e.g. 'brute force ssh', 'T1059', 'password spraying', 'CVE-2024-6387'..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-9 pr-4 py-2 bg-[#07090e] border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as 'all' | 'mitre_attack' | 'nvd_cve')}
            className="bg-[#07090e] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500/50 font-mono"
          >
            <option value="all">Source: All</option>
            <option value="mitre_attack">MITRE ATT&CK</option>
            <option value="nvd_cve">NVD / CVE</option>
          </select>
          <button
            onClick={handleSearch}
            disabled={searching || query.trim().length < 2}
            className="btn btn-primary text-xs flex items-center gap-2"
          >
            <FileSearch className="w-3.5 h-3.5" />
            <span>{searching ? 'Searching...' : 'Search Knowledge'}</span>
          </button>
        </div>
      </div>

      {/* Results — real Qdrant records */}
      {searching ? (
        <LoadingSkeleton type="card" count={3} />
      ) : searchError ? (
        <div className="card p-10 border-rose-500/30 flex flex-col items-center space-y-3">
          <TriangleAlert className="w-10 h-10 text-rose-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Search failed</h2>
          <p className="text-xs font-mono text-rose-300 break-all max-w-xl">{searchError}</p>
        </div>
      ) : searched && results && results.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="No Matching Knowledge Records"
          description="No indexed records matched the query. Try technique IDs (T1110), general terms, or check the selected source filter."
        />
      ) : searched && results ? (
        <div className="space-y-3">
          {results.map((hit, idx) => (
            <div key={`${hit.document_id}-${idx}`} className="card p-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="px-2 py-0.5 rounded font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
                    {sourceLabel(hit.source)}
                  </span>
                  {hit.source_identifier && (
                    <span className="px-2 py-0.5 rounded font-mono bg-zinc-800 text-zinc-300">
                      {hit.source_identifier}
                    </span>
                  )}
                  <span className="text-zinc-300 font-medium">{hit.title || hit.document_id}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[11px] text-zinc-400">
                    similarity {hit.score.toFixed(3)}
                  </span>
                  {hit.source_url && (
                    <a
                      href={hit.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] font-mono"
                    >
                      Source <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed line-clamp-4">{hit.content}</p>
              <div className="font-mono text-[10px] text-zinc-500">
                doc id: {hit.document_id}
                {hit.chunk_index != null ? ` · chunk ${hit.chunk_index}` : ''}
                {hit.cve_id ? ` · CVE ${hit.cve_id}` : ''}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-10 text-center text-xs text-zinc-500">
          Enter a query above to search the real indexed corpus. Results come directly from Qdrant
          with genuine cosine-similarity scores.
        </div>
      )}
    </div>
  );
};

export default SecurityKnowledge;
