import React, { useState } from 'react';
import { Search, Layers, ArrowRight } from 'lucide-react';
import { mockEvidenceList } from '../data/mockEvidence';
import PageHeader from '../components/common/PageHeader';
import MockDataDisclaimer from '../components/common/MockDataDisclaimer';

const Evidence: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [minRelevance, setMinRelevance] = useState<number>(0.7);

  const filteredEvidence = mockEvidenceList.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.document_id.toLowerCase().includes(q) ||
      item.source.toLowerCase().includes(q) ||
      item.content.toLowerCase().includes(q);
    const matchesScore = item.relevance_score >= minRelevance;
    return matchesSearch && matchesScore;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evidence Grounding & RAG Retrieval"
        subtitle="Authoritative security standards, NIST incident playbooks, and MITRE guidelines retrieved to ground AI recommendations."
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Intelligence' },
          { label: 'Evidence & RAG' },
        ]}
        badge={
          <span className="font-mono text-xs text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800/40">
            {filteredEvidence.length} Grounded Records
          </span>
        }
      />

      <MockDataDisclaimer
        label="MOCK / DEVELOPMENT DATA"
        detail="Retrieved documents simulated from development knowledge corpus. Qdrant vector database ingestion pipeline integration pending."
      />

      {/* Visual Retrieval Pipeline Ribbon */}
      <div className="card p-5 bg-[#090d16] border-zinc-800 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-zinc-200">
              Evidence-Aware Retrieval-Augmented Generation Flow
            </h2>
          </div>
          <span className="text-[10px] font-mono text-zinc-400 uppercase">
            Hallucination Safeguard
          </span>
        </div>

        <div className="flex flex-col lg:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-[#06080e] border border-zinc-800/80 overflow-x-auto text-xs font-mono">
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-center w-full lg:w-auto">
            <span className="text-zinc-500 text-[10px] block">Stage 1</span>
            <span className="text-zinc-200 font-semibold">Normalized Alert</span>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600 hidden lg:block" />
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-center w-full lg:w-auto">
            <span className="text-zinc-500 text-[10px] block">Stage 2</span>
            <span className="text-cyan-400 font-semibold">Context Extraction</span>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600 hidden lg:block" />
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-center w-full lg:w-auto">
            <span className="text-zinc-500 text-[10px] block">Stage 3</span>
            <span className="text-amber-400 font-semibold">Dense Vector Query</span>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600 hidden lg:block" />
          <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 text-center w-full lg:w-auto">
            <span className="text-emerald-500 text-[10px] block">Stage 4</span>
            <span className="font-semibold">Evidence Grounding</span>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-600 hidden lg:block" />
          <div className="p-3 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 text-center w-full lg:w-auto">
            <span className="text-cyan-500 text-[10px] block">Stage 5</span>
            <span className="font-semibold">Validated AI Claim</span>
          </div>
        </div>
      </div>

      {/* Search and Relevance Filters */}
      <div className="card p-4 bg-[#0c101a] space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search evidence corpus by keyword, NIST code, or MITRE doc ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#07090e] border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-3 font-mono text-xs text-zinc-400 px-2">
            <span>Min Relevance:</span>
            <input
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={minRelevance}
              onChange={(e) => setMinRelevance(parseFloat(e.target.value))}
              className="accent-cyan-500 cursor-pointer w-24"
            />
            <span className="text-cyan-400 font-bold">{(minRelevance * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Evidence Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredEvidence.map((ev) => (
          <div
            key={ev.id}
            className="card p-5 space-y-3 hover:border-emerald-500/40 transition-colors group flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-xs font-bold text-cyan-400">
                    {ev.document_id}
                  </span>
                  <h3 className="text-sm font-semibold text-zinc-200 mt-0.5">{ev.title}</h3>
                </div>
                <span className="font-mono text-xs text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-800/60 shrink-0">
                  Score: {(ev.relevance_score * 100).toFixed(0)}%
                </span>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed pt-1">{ev.content}</p>
            </div>

            <div className="pt-3 border-t border-zinc-800/80 space-y-1 font-mono text-[11px] text-zinc-400">
              <div className="flex justify-between">
                <span className="text-zinc-500">Source:</span>
                <span className="text-zinc-300">{ev.source}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Citation:</span>
                <span className="text-zinc-400 truncate max-w-xs">{ev.citation}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Evidence;
