import React, { useState, useEffect } from 'react';
import {
  Target,
  Bug,
  ExternalLink,
  X,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { knowledgeService } from '../../services/api';
import type { ThreatIntelRecord } from '../../services/api';

interface ThreatIntelDrawerProps {
  identifier: string | null;
  onClose: () => void;
}

export const ThreatIntelDrawer: React.FC<ThreatIntelDrawerProps> = ({ identifier, onClose }) => {
  const [intel, setIntel] = useState<ThreatIntelRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!identifier) {
      setIntel(null);
      setError(null);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    knowledgeService
      .getThreatIntel(identifier)
      .then((data) => {
        if (mounted) setIntel(data);
      })
      .catch((err) => {
        if (mounted) {
          setError(
            err?.response?.data?.detail ||
              `Record for '${identifier}' not found in the indexed knowledge collection.`
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [identifier]);

  if (!identifier) return null;

  const isMitre = identifier.toUpperCase().startsWith('T');
  const isCve = identifier.toUpperCase().startsWith('CVE');

  return (
    <div className="fixed inset-y-0 right-0 w-96 max-w-full z-50 bg-[#0c101a] border-l border-zinc-800 shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-4 border-b border-zinc-800/80 bg-[#090d16] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              isMitre
                ? 'bg-emerald-950/80 border-emerald-800/50 text-emerald-400'
                : 'bg-rose-950/80 border-rose-800/50 text-rose-400'
            }`}
          >
            {isMitre ? <Target className="w-4 h-4" /> : <Bug className="w-4 h-4" />}
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              {isMitre ? 'MITRE ATT&CK TECHNIQUE' : isCve ? 'NVD CVE VULNERABILITY' : 'THREAT INTEL'}
            </div>
            <div className="text-sm font-bold text-zinc-100">{identifier}</div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center space-y-2">
            <div className="w-6 h-6 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
            <span className="text-xs font-mono text-zinc-400">Querying Knowledge Corpus...</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-lg border border-amber-800/60 bg-amber-950/30 text-amber-300 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Not Indexed in Qdrant</span>
            </div>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">{error}</p>
            <div className="pt-2 border-t border-amber-800/40 text-[10px] font-mono text-zinc-400">
              Note: Only verified STIX techniques and CVEs present in the local knowledge base are returned.
            </div>
          </div>
        )}

        {intel && (
          <div className="space-y-4">
            {/* Title & Provenance */}
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-100">{intel.title}</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/40 text-emerald-300">
                  {intel.source === 'mitre_attack' ? 'MITRE Enterprise ATT&CK' : 'NVD CVE Corpus'}
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  {intel.chunk_count} Knowledge Chunks
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Description / Scope</span>
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap">
                {intel.description || 'No detailed description available in the knowledge chunk.'}
              </div>
            </div>

            {/* Tactics / Kill Chain */}
            {intel.tactics && intel.tactics.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Kill Chain Tactics</span>
                <div className="flex flex-wrap gap-1.5">
                  {intel.tactics.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800/80 border border-zinc-700 text-zinc-200"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* External Reference Link */}
            {intel.source_url && (
              <a
                href={intel.source_url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary w-full flex items-center justify-center gap-2 text-xs py-2"
              >
                <span>Open Official Advisory</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Drawer Footer */}
      <div className="p-3 border-t border-zinc-800/80 bg-[#090d16] text-[10px] font-mono text-zinc-500 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Info className="w-3 h-3 text-cyan-400" />
          <span>Verified Contextual Knowledge</span>
        </span>
        <span>Local Qdrant Collection</span>
      </div>
    </div>
  );
};

export default ThreatIntelDrawer;
