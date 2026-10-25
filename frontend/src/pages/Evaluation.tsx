import React, { useState, useEffect, useCallback } from 'react';
import {
  Beaker,
  RefreshCw,
  TriangleAlert,
  ShieldCheck,
  Database,
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Cpu,
} from 'lucide-react';
import { evaluationService } from '../services/api';
import type {
  EvaluationLatest,
  EvaluationAggregateMode,
  EvaluationRunSummary,
  EvaluationDatasetInfo,
} from '../services/api';
import PageHeader from '../components/common/PageHeader';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

const Evaluation: React.FC = () => {
  const [data, setData] = useState<EvaluationLatest | null>(null);
  const [runs, setRuns] = useState<EvaluationRunSummary[]>([]);
  const [datasets, setDatasets] = useState<EvaluationDatasetInfo[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters for per-case records
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMode, setSelectedMode] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'attack' | 'benign' | 'errors'>('all');
  const [showMetricDefinitions, setShowMetricDefinitions] = useState<boolean>(false);

  const loadData = useCallback(async (runIdToLoad?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [allRuns, allDatasets] = await Promise.all([
        evaluationService.listRuns(),
        evaluationService.listDatasets(),
      ]);
      setRuns(allRuns);
      setDatasets(allDatasets);

      let result: EvaluationLatest;
      if (runIdToLoad) {
        result = await evaluationService.getRun(runIdToLoad, 200);
      } else if (allRuns.length > 0) {
        result = await evaluationService.getLatest(200);
      } else {
        result = await evaluationService.getLatest(200);
      }

      setData(result);
      if (result.run_id) {
        setSelectedRunId(result.run_id);
      }
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
    loadData();
  }, [loadData]);

  const handleSelectRun = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const runId = e.target.value;
    setSelectedRunId(runId);
    if (runId) {
      loadData(runId);
    }
  };

  const modeOrder = ['llm_only', 'standard_rag', 'evidence_aware'];
  const modesInData = data?.aggregate
    ? modeOrder.filter((m) => data.aggregate?.[m])
    : [];

  const rows: Array<{
    label: string;
    description: string;
    pick: (a: EvaluationAggregateMode) => string;
  }> = [
    {
      label: 'Cases run',
      description: 'Total alert scenarios processed in this mode',
      pick: (a) => String(a.cases),
    },
    {
      label: 'Execution errors',
      description: 'Number of alerts where analysis threw an exception or timed out',
      pick: (a) => String(a.errors),
    },
    {
      label: 'Wall latency mean (s)',
      description: 'Average end-to-end elapsed time including retrieval & inference',
      pick: (a) => (a.wall_latency_seconds?.mean != null ? `${a.wall_latency_seconds.mean.toFixed(1)}s` : 'N/A'),
    },
    {
      label: 'Wall latency median (s)',
      description: 'Median elapsed time across cases',
      pick: (a) => (a.wall_latency_seconds?.median != null ? `${a.wall_latency_seconds.median.toFixed(1)}s` : 'N/A'),
    },
    {
      label: 'LLM latency mean (s)',
      description: 'Average time spent purely waiting on Ollama model generation',
      pick: (a) => (a.llm_latency_seconds?.mean != null ? `${a.llm_latency_seconds.mean.toFixed(1)}s` : 'N/A'),
    },
    {
      label: 'Severity band accuracy*',
      description: 'Agreement between predicted severity and ground truth band (when parseable)',
      pick: (a) => (a.severity_band_accuracy != null ? `${(a.severity_band_accuracy * 100).toFixed(0)}%` : 'N/A'),
    },
    {
      label: '— severity parseable cases',
      description: 'Number of analyses with parseable severity keywords',
      pick: (a) => String(a.severity_parseable_count),
    },
    {
      label: 'Technique precision',
      description: 'Precision over MITRE ATT&CK IDs: True Positives / Total Predicted IDs',
      pick: (a) => (a.technique_precision != null ? a.technique_precision.toFixed(3) : 'N/A'),
    },
    {
      label: 'Technique recall',
      description: 'Recall over MITRE ATT&CK IDs: True Positives / Expected Ground Truth IDs',
      pick: (a) => (a.technique_recall != null ? a.technique_recall.toFixed(3) : 'N/A'),
    },
    {
      label: 'Technique F1 score',
      description: 'Harmonic mean of technique precision and recall',
      pick: (a) => (a.technique_f1 != null ? a.technique_f1.toFixed(3) : 'N/A'),
    },
    {
      label: 'CVE F1 score',
      description: 'Precision & recall over explicit CVE vulnerability mappings',
      pick: (a) => (a.cve_f1 != null ? a.cve_f1.toFixed(3) : 'N/A (no CVEs in mode)'),
    },
    {
      label: 'Benign false alarm rate',
      description: 'Fraction of negative control events incorrectly escalated as High or Critical',
      pick: (a) => (a.false_alarm_rate_on_benign != null ? `${(a.false_alarm_rate_on_benign * 100).toFixed(0)}%` : 'N/A'),
    },
    {
      label: 'Valid evidence citation rate',
      description: 'Fraction of LLM evidence references that exist in the retrieved evidence set',
      pick: (a) =>
        a.valid_evidence_reference_rate != null
          ? `${(a.valid_evidence_reference_rate * 100).toFixed(0)}%`
          : 'N/A (no retrieval in mode)',
    },
    {
      label: 'Retrieval Recall@5',
      description: 'Fraction of cases where first relevant knowledge chunk was in top 5 retrieved items',
      pick: (a) => (a['retrieval_recall@5'] != null ? a['retrieval_recall@5'].toFixed(3) : 'N/A'),
    },
    {
      label: 'Retrieval Recall@1',
      description: 'Fraction of cases where top retrieved item was relevant to ground truth',
      pick: (a) => (a['retrieval_recall@1'] != null ? a['retrieval_recall@1'].toFixed(3) : 'N/A'),
    },
    {
      label: 'Retrieval MRR',
      description: 'Mean Reciprocal Rank (1/rank) of first relevant security knowledge record',
      pick: (a) => (a.retrieval_mrr != null ? a.retrieval_mrr.toFixed(3) : 'N/A'),
    },
  ];

  // Filter records
  const records = data?.records || [];
  const uniqueCategories = Array.from(
    new Set(records.map((r) => String(r.category || 'unknown')).filter(Boolean))
  ).sort();

  const filteredRecords = records.filter((rec) => {
    const r = rec as Record<string, unknown>;
    const category = String(r.category || '');
    const mode = String(r.mode || '');
    const isBenign = Boolean(r.is_benign);
    const hasError = Boolean(r.error);

    if (selectedCategory !== 'all' && category !== selectedCategory) return false;
    if (selectedMode !== 'all' && mode !== selectedMode) return false;
    if (filterType === 'attack' && isBenign) return false;
    if (filterType === 'benign' && !isBenign) return false;
    if (filterType === 'errors' && !hasError) return false;

    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="RAG Evaluation Benchmark"
        subtitle="Reproducible empirical comparison of LLM Only, Standard RAG, and Evidence-Aware RAG. Evaluated on curated synthetic security scenarios with verified ground truth."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'RAG Evaluation' }]}
        actions={
          <div className="flex items-center gap-2">
            {runs.length > 1 && (
              <select
                value={selectedRunId}
                onChange={handleSelectRun}
                className="select select-sm text-xs bg-zinc-900 border-zinc-700 font-mono text-cyan-300"
              >
                {runs.map((r) => (
                  <option key={r.run_id} value={r.run_id}>
                    Run {r.run_id} ({r.dataset_version}, {r.num_cases} cases)
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => loadData(selectedRunId)}
              className="btn btn-secondary flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Synthetic Benchmark Telemetry Banner */}
      <div className="p-3.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-amber-300 flex items-center gap-2">
            <span>Synthetic Evaluation Telemetry · Negative Controls Included</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-900/80 border border-amber-700 font-mono uppercase">
              Simulated Wazuh
            </span>
          </div>
          <p className="text-amber-200/90 leading-relaxed text-[11px]">
            To ensure zero contamination with live enterprise networks, all evaluation scenarios are
            synthetically curated using RFC 5737/1918 test subnets, realistic Wazuh rule schemas, and
            formal MITRE ATT&CK technique definitions. Negative controls (benign scans, scheduled
            backups, routine updates) are incorporated to evaluate false-positive resistance.
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton type="table" count={6} />
      ) : error ? (
        <div className="card p-10 border-rose-500/30 flex flex-col items-center space-y-3">
          <TriangleAlert className="w-10 h-10 text-rose-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Could not load evaluation results</h2>
          <p className="text-xs font-mono text-rose-300 break-all max-w-xl">{error}</p>
          <button onClick={() => loadData()} className="btn btn-secondary text-xs">
            Retry
          </button>
        </div>
      ) : data && data.available === false ? (
        <div className="card p-12 flex flex-col items-center space-y-3">
          <Beaker className="w-12 h-12 text-zinc-600" />
          <h2 className="text-sm font-semibold text-zinc-200">Evaluation not run yet</h2>
          <p className="text-xs text-zinc-400 text-center max-w-lg">
            {data.reason || 'No recorded experiment runs found in backend/evaluation/results/.'}
          </p>
          <div className="p-3 rounded bg-zinc-900/70 border border-zinc-800 text-[11px] font-mono text-zinc-400 text-left">
            <div># Run evaluation smoke test</div>
            <div>python scripts/run_evaluation.py --limit 3 --no-ablation</div>
          </div>
        </div>
      ) : data?.meta && data.aggregate ? (
        <>
          {/* Run metadata & Available Datasets */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="card p-5 lg:col-span-2">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
                <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  Active Experiment Configuration
                </h2>
                <span className="font-mono text-xs text-cyan-400">run {data.meta.run_id}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
                {[
                  ['Dataset Version', `${data.meta.dataset_version} (${data.meta.num_cases} cases)`],
                  ['LLM Model', data.meta.llm_model],
                  ['Embedding', data.meta.embedding_model],
                  ['Qdrant Collection', data.meta.qdrant_collection],
                  ['Modes Tested', data.meta.modes?.join(', ') || 'all'],
                  ['Temperature', String(data.meta.temperature)],
                  ['Timestamp (UTC)', new Date(data.meta.timestamp_utc).toLocaleString()],
                  ['Run Status', data.status || 'completed'],
                ].map(([label, value]) => (
                  <div key={label} className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
                    <div className="text-[10px] uppercase text-zinc-500">{label}</div>
                    <div className="text-zinc-200 mt-1 font-semibold truncate" title={String(value)}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Benchmark Datasets Registry */}
            <div className="card p-5">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-3">
                <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                  <Database className="w-4 h-4 text-purple-400" />
                  Available Benchmarks
                </h2>
                <span className="text-[10px] font-mono text-zinc-500 uppercase">
                  {datasets.length} versions
                </span>
              </div>
              <div className="space-y-2.5 text-xs font-mono">
                {datasets.map((d) => (
                  <div
                    key={d.dataset_version}
                    className={`p-2.5 rounded border ${
                      data.meta?.dataset_version === d.dataset_version
                        ? 'bg-cyan-950/30 border-cyan-800 text-cyan-200'
                        : 'bg-zinc-900/40 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>{d.dataset_version.toUpperCase()} ({d.filename})</span>
                      <span className="text-amber-400">{d.num_cases} cases</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">
                      {d.attack_cases} attack scenarios · {d.benign_cases} benign controls
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5 truncate">
                      {d.categories.length} categories: {d.categories.slice(0, 4).join(', ')}...
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Comparative Results Table */}
          <div className="card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-[#0a0e17] flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">
                  Measured Comparative Performance per Mode
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Empirical results calculated directly from saved model outputs. Zero fabrication or imputation.
                </p>
              </div>
              <button
                onClick={() => setShowMetricDefinitions(!showMetricDefinitions)}
                className="btn btn-secondary text-xs flex items-center gap-1.5"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{showMetricDefinitions ? 'Hide Metric Definitions' : 'Metric Definitions'}</span>
              </button>
            </div>

            {/* Collapsible Metric Definitions */}
            {showMetricDefinitions && (
              <div className="p-4 bg-zinc-900/90 border-b border-zinc-800 text-xs text-zinc-300 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div>
                    <strong className="text-cyan-300">Technique Precision / Recall / F1:</strong> Exact-set comparison
                    between predicted MITRE ATT&CK technique IDs and ground truth. Empty predictions result in 0 precision.
                  </div>
                  <div>
                    <strong className="text-cyan-300">CVE F1 Score:</strong> Evaluates accuracy of detected vulnerability
                    identifiers (e.g. CVE-2021-44228). Only evaluated when CVEs are grounded in scenario.
                  </div>
                  <div>
                    <strong className="text-cyan-300">Benign False Alarm Rate:</strong> Percentage of benign/administrative events
                    incorrectly escalated to High or Critical severity. Lower is better.
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <strong className="text-cyan-300">Valid Evidence Citation Rate:</strong> Fraction of LLM-cited evidence IDs
                    that legitimately exist in the retrieved Qdrant chunk set.
                  </div>
                  <div>
                    <strong className="text-cyan-300">Retrieval Recall@5 / Recall@1 / MRR:</strong> Evaluates whether the Qdrant
                    retriever retrieved the true ground-truth knowledge chunk in top 5 or rank 1.
                  </div>
                  <div>
                    <strong className="text-cyan-300">Severity Band Accuracy:</strong> Agreement between parsed severity assessment
                    (low, medium, high, critical) and expected severity.
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800/80 bg-[#080b12] text-zinc-400 font-mono uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Evaluation Metric</th>
                    {modesInData.map((m) => (
                      <th key={m} className="py-3 px-4 font-mono text-cyan-400 whitespace-nowrap min-w-[180px]">
                        {m === 'llm_only'
                          ? 'A. LLM Only (No Retrieval)'
                          : m === 'standard_rag'
                          ? 'B. Standard RAG (Naive)'
                          : 'C. Evidence-Aware RAG (Production)'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-sans">
                  {rows.map((row) => (
                    <tr key={row.label} className="hover:bg-cyan-950/10">
                      <td className="py-2.5 px-4 text-zinc-300">
                        <div className="font-medium">{row.label}</div>
                        <div className="text-[10px] text-zinc-500">{row.description}</div>
                      </td>
                      {modesInData.map((m) => {
                        const modeData = data.aggregate?.[m];
                        return (
                          <td key={m} className="py-2.5 px-4 font-mono text-zinc-200 font-semibold text-sm">
                            {modeData ? row.pick(modeData) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-zinc-800/80 text-[11px] text-zinc-500 space-y-1">
              <p>
                * Severity band accuracy counts only analyses whose severity text yielded a band word (coverage shown separately).
              </p>
              <p>
                * All metrics are pure deterministic functions without LLM-as-a-judge fabrication.
              </p>
            </div>
          </div>

          {/* Per-Case Investigation Records with Filters */}
          {records.length > 0 && (
            <div className="card p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-200">Per-Case Investigation Records</h2>
                  <p className="text-xs text-zinc-400">
                    Showing {filteredRecords.length} of {records.length} total recorded evaluations
                  </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1">
                    <Filter className="w-3 h-3 text-zinc-400" />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="bg-transparent text-zinc-300 outline-none"
                    >
                      <option value="all">All Categories</option>
                      {uniqueCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <select
                    value={selectedMode}
                    onChange={(e) => setSelectedMode(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-300 outline-none"
                  >
                    <option value="all">All Modes</option>
                    <option value="llm_only">LLM Only</option>
                    <option value="standard_rag">Standard RAG</option>
                    <option value="evidence_aware">Evidence-Aware</option>
                  </select>

                  <div className="flex rounded border border-zinc-800 overflow-hidden">
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-2 py-1 ${
                        filterType === 'all' ? 'bg-cyan-900/60 text-cyan-300 font-bold' : 'bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterType('attack')}
                      className={`px-2 py-1 ${
                        filterType === 'attack' ? 'bg-amber-900/60 text-amber-300 font-bold' : 'bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      Attacks
                    </button>
                    <button
                      onClick={() => setFilterType('benign')}
                      className={`px-2 py-1 ${
                        filterType === 'benign' ? 'bg-emerald-900/60 text-emerald-300 font-bold' : 'bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      Benign Controls
                    </button>
                    <button
                      onClick={() => setFilterType('errors')}
                      className={`px-2 py-1 ${
                        filterType === 'errors' ? 'bg-rose-900/60 text-rose-300 font-bold' : 'bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      Errors
                    </button>
                  </div>
                </div>
              </div>

              {/* Records List */}
              <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-[11px] pr-1">
                {filteredRecords.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    No evaluation cases match the active filter criteria.
                  </div>
                ) : (
                  filteredRecords.map((rec, idx) => {
                    const r = rec as Record<string, unknown>;
                    const err = r.error ? String(r.error) : null;
                    const isBenign = Boolean(r.is_benign);
                    const prf = (r.technique_prf1 || {}) as Record<string, number | null>;
                    const cvePrf = (r.cve_prf1 || {}) as Record<string, number | null>;
                    const sevMatch = r.severity_band_match;

                    return (
                      <div
                        key={idx}
                        className={`p-2.5 rounded border transition-all ${
                          err
                            ? 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                            : isBenign
                            ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                            : 'bg-zinc-900/50 border-zinc-800 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-100">{String(r.case_id)}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700">
                              {String(r.category || 'unknown')}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800">
                              {String(r.mode)}
                            </span>
                            {isBenign && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-900 text-emerald-300 font-bold border border-emerald-700">
                                BENIGN CONTROL
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs">
                            {err ? (
                              <span className="text-rose-400 font-bold">ERROR: {err}</span>
                            ) : (
                              <>
                                <span className="flex items-center gap-1 text-[11px]">
                                  Severity:
                                  {sevMatch === true ? (
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400 inline" />
                                  ) : sevMatch === false ? (
                                    <XCircle className="w-3 h-3 text-amber-400 inline" />
                                  ) : (
                                    <span className="text-zinc-500">—</span>
                                  )}
                                  <span className="text-zinc-400">({String(r.expected_severity_band)})</span>
                                </span>

                                <span className="text-[11px] text-zinc-400">
                                  T-F1:{' '}
                                  <strong className="text-cyan-300">
                                    {prf.f1 != null ? prf.f1.toFixed(2) : '—'}
                                  </strong>
                                </span>

                                {Array.isArray(r.expected_cves) && r.expected_cves.length > 0 && (
                                  <span className="text-[11px] text-purple-300">
                                    CVE-F1: {cvePrf.f1 != null ? cvePrf.f1.toFixed(2) : '—'}
                                  </span>
                                )}

                                <span className="text-[11px] text-zinc-400">
                                  Citations:{' '}
                                  <strong className="text-zinc-200">
                                    {r.valid_evidence_reference_rate != null
                                      ? `${(Number(r.valid_evidence_reference_rate) * 100).toFixed(0)}%`
                                      : 'n/a'}
                                  </strong>
                                </span>

                                <span className="flex items-center gap-1 text-zinc-500 text-[11px]">
                                  <Clock className="w-3 h-3" />
                                  {Number(r.wall_latency_seconds ?? 0).toFixed(1)}s
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Summary preview */}
                        {Boolean(r.summary) && (
                          <div className="text-[10px] text-zinc-400 mt-1 line-clamp-1 italic">
                            &quot;{String(r.summary)}&quot;
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Research Interpretation Guidance */}
          <div className="card p-5 space-y-2 border-amber-800/40">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <TriangleAlert className="w-4 h-4 text-amber-400" />
              Scientific Claims & Interpretation Limits
            </h2>
            <ul className="list-disc list-inside text-xs text-zinc-400 space-y-1">
              <li>
                <strong>Evidence-Aware RAG Advantage:</strong> High citation validity proves grounding to retrieved evidence chunks, but must be paired with technique F1 to demonstrate security accuracy.
              </li>
              <li>
                <strong>Negative Control Defense:</strong> A model that sounds confident but flags authorized Nessus scans as CRITICAL produces analyst alert fatigue; lower false-alarm rate indicates operational viability.
              </li>
              <li>
                <strong>Honest Limitations:</strong> Deterministic scoring on synthetic datasets evaluates system architecture and retrieval mechanics; real-world efficacy requires validation against production Wazuh telemetry.
              </li>
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default Evaluation;
