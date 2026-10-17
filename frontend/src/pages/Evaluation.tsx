import React, { useState, useEffect, useCallback } from 'react';
import { Beaker, RefreshCw, TriangleAlert } from 'lucide-react';
import { evaluationService } from '../services/api';
import type { EvaluationLatest, EvaluationAggregateMode } from '../services/api';
import PageHeader from '../components/common/PageHeader';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

const Evaluation: React.FC = () => {
  const [data, setData] = useState<EvaluationLatest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await evaluationService.getLatest(true);
      setData(result);
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as { message?: string })?.message ||
        'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const modeOrder = ['llm_only', 'standard_rag', 'evidence_aware'];
  const modesInData = data?.aggregate
    ? modeOrder.filter((m) => data.aggregate?.[m])
    : [];

  const rows: Array<{ label: string; pick: (a: EvaluationAggregateMode) => string }> = [
    { label: 'Cases run', pick: (a) => String(a.cases) },
    { label: 'Errors', pick: (a) => String(a.errors) },
    { label: 'Wall latency mean (s)', pick: (a) => a.wall_latency_seconds.mean?.toFixed(1) ?? 'N/A' },
    { label: 'LLM latency mean (s)', pick: (a) => a.llm_latency_seconds.mean?.toFixed(1) ?? 'N/A' },
    { label: 'Severity band accuracy*', pick: (a) => (a.severity_band_accuracy != null ? `${(a.severity_band_accuracy * 100).toFixed(0)}%` : 'N/A') },
    { label: '— severity parseable cases', pick: (a) => String(a.severity_parseable_count) },
    { label: 'Technique precision', pick: (a) => a.technique_precision?.toFixed(3) ?? 'N/A' },
    { label: 'Technique recall', pick: (a) => a.technique_recall?.toFixed(3) ?? 'N/A' },
    { label: 'Technique F1', pick: (a) => a.technique_f1?.toFixed(3) ?? 'N/A' },
    { label: 'Valid evidence-ref rate', pick: (a) => (a.valid_evidence_reference_rate != null ? `${(a.valid_evidence_reference_rate * 100).toFixed(0)}%` : 'N/A (no evidence in mode)') },
    { label: 'Retrieval Recall@5', pick: (a) => a['retrieval_recall@5']?.toFixed(3) ?? 'N/A' },
    { label: 'Retrieval Recall@1', pick: (a) => a['retrieval_recall@1']?.toFixed(3) ?? 'N/A' },
    { label: 'Retrieval MRR', pick: (a) => a.retrieval_mrr?.toFixed(3) ?? 'N/A' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="RAG Evaluation"
        subtitle="Measured comparison of the three analysis modes over the hand-authored dataset. All numbers come from real recorded runs produced by scripts/run_evaluation.py."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'RAG Evaluation' }]}
        actions={
          <button onClick={load} className="btn btn-secondary flex items-center gap-2 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        }
      />

      {loading ? (
        <LoadingSkeleton type="table" count={6} />
      ) : error ? (
        <div className="card p-10 border-rose-500/30 flex flex-col items-center space-y-3">
          <TriangleAlert className="w-10 h-10 text-rose-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Could not load evaluation results</h2>
          <p className="text-xs font-mono text-rose-300 break-all max-w-xl">{error}</p>
          <button onClick={load} className="btn btn-secondary text-xs">
            Retry
          </button>
        </div>
      ) : data && data.available === false ? (
        <div className="card p-12 flex flex-col items-center space-y-3">
          <Beaker className="w-12 h-12 text-zinc-600" />
          <h2 className="text-sm font-semibold text-zinc-200">Evaluation not run yet</h2>
          <p className="text-xs text-zinc-400 text-center max-w-lg">
            {data.reason}
          </p>
          <div className="p-3 rounded bg-zinc-900/70 border border-zinc-800 text-[11px] font-mono text-zinc-400 text-left">
            <div>cd backend</div>
            <div>python scripts/run_evaluation.py</div>
          </div>
        </div>
      ) : data?.meta && data.aggregate ? (
        <>
          {/* Run metadata */}
          <div className="card p-5">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
              <h2 className="text-sm font-semibold text-zinc-200">Run Configuration</h2>
              <span className="font-mono text-xs text-cyan-400">run {data.meta.run_id}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
              {[
                ['Dataset', `${data.meta.dataset_version} (${data.meta.num_cases} cases)`],
                ['LLM', data.meta.llm_model],
                ['Embedding', data.meta.embedding_model],
                ['Qdrant collection', data.meta.qdrant_collection],
                ['Modes tested', data.meta.modes.join(', ')],
                ['Temperature', String(data.meta.temperature)],
                ['Timestamp (UTC)', new Date(data.meta.timestamp_utc).toLocaleString()],
                ['Source', 'produced by scripts/run_evaluation.py'],
              ].map(([label, value]) => (
                <div key={label} className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <div className="text-[10px] uppercase text-zinc-500">{label}</div>
                  <div className="text-zinc-200 mt-1 break-all">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Results table */}
          <div className="card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-[#0a0e17]">
              <h2 className="text-base font-semibold text-zinc-100">Measured Results per Mode</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Every value below was computed from recorded artifacts of the shown run. Nothing is
                projected or theoretical.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800/80 bg-[#080b12] text-zinc-400 font-mono uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Metric</th>
                    {modesInData.map((m) => (
                      <th key={m} className="py-3 px-4 font-mono text-cyan-400">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-sans">
                  {rows.map((row) => (
                    <tr key={row.label} className="hover:bg-cyan-950/10">
                      <td className="py-2.5 px-4 text-zinc-300">{row.label}</td>
                      {modesInData.map((m) => {
                        const modeData = data.aggregate?.[m];
                        return (
                          <td key={m} className="py-2.5 px-4 font-mono text-zinc-200">
                            {modeData ? row.pick(modeData) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-zinc-800/80 text-[11px] text-zinc-500 space-y-1.5">
              <p>
                * Severity band accuracy counts only analyses whose severity text yielded a band
                word (coverage shown separately). No imputation is applied.
              </p>
              <p>
                Valid evidence-reference rate measures citation-ID validity, not semantic support.
                Retrieval Recall@1/@5 and MRR are computed over per-case ranks of the first
                relevant record; fewer modes may produce them than were run.
              </p>
            </div>
          </div>

          {/* Per-case failures */}
          {data.records && data.records.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-3">
                <h2 className="text-sm font-semibold text-zinc-200">Per-Case Records</h2>
                <span className="text-[10px] font-mono text-zinc-500 uppercase">
                  {data.records.length} records
                </span>
              </div>
              <div className="space-y-1.5 max-h-96 overflow-y-auto font-mono text-[11px]">
                {data.records.map((rec, idx) => {
                  const r = rec as Record<string, unknown>;
                  const err = r.error ? String(r.error) : null;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between gap-3 px-3 py-1.5 rounded border ${
                        err
                          ? 'bg-rose-950/30 border-rose-800/40 text-rose-300'
                          : 'bg-zinc-900/50 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      <span>
                        {String(r.case_id)} [{String(r.mode)}]
                      </span>
                      <span className="truncate text-right">
                        {err ? (
                          <>ERROR: {err}</>
                        ) : (
                          <>
                            P={JSON.stringify(r.technique_prf1 ?? {}).length > 2 ? (r as any).technique_prf1?.precision ?? '—' : '—'} ·
                            grounding={r.valid_evidence_reference_rate ?? 'n/a'} ·
                            latency={Number(r.wall_latency_seconds ?? 0).toFixed(1)}s
                          </>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Honest scope limits */}
          <div className="card p-5 space-y-2 border-amber-800/40">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <TriangleAlert className="w-4 h-4 text-amber-400" />
              Interpretation Limits (do not over-claim)
            </h2>
            <ul className="list-disc list-inside text-xs text-zinc-400 space-y-1">
              <li>
                The dataset is small and hand-authored: results indicate behavior; they do not
                establish statistical significance.
              </li>
              <li>
                A higher valid-evidence-reference rate measures citation validity only — it does
                not by itself prove better final analysis quality.
              </li>
              <li>
                Do not claim the evidence-aware mode is superior unless the measured numbers above
                support it for the evaluated cases.
              </li>
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default Evaluation;
