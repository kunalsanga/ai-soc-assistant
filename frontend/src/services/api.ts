/**
 * AI SOC Assistant — API Client
 *
 * Central API client for communicating with the backend.
 * Architecture: Component → Hook → Service → API Client → Backend API
 *
 * The frontend NEVER contacts Wazuh / AI / Database directly.
 * All communication flows through our backend API.
 */

import axios from 'axios';
import type { Alert, Analysis, Evidence } from '../types/alert';
export type { Alert, Analysis, Evidence };

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

/* ── Alert endpoints ── */

export const alertService = {
  /** GET /alerts — list all alerts with optional source isolation */
  getAlerts: async (source?: string): Promise<Alert[]> => {
    const params = source ? `?source=${encodeURIComponent(source)}` : '';
    const response = await apiClient.get(`/alerts${params}`);
    return response.data;
  },

  /** GET /alerts/:id — single alert */
  getAlert: async (id: string | number): Promise<Alert> => {
    const response = await apiClient.get(`/alerts/${id}`);
    return response.data;
  },

  /** POST /alerts/:id/analyze — trigger AI analysis. mode selects the
   * pipeline: llm_only | standard_rag | evidence_aware.
   * Long timeout: LLM analysis takes ~60s+ on local hardware and must
   * not be cut off by the client while the backend is still working. */
  analyzeAlert: async (
    id: string | number,
    mode: string = 'evidence_aware'
  ): Promise<Analysis> => {
    const response = await apiClient.post(
      `/alerts/${id}/analyze?mode=${encodeURIComponent(mode)}`,
      undefined,
      { timeout: 300_000 }
    );
    return response.data;
  },

  /** GET /alerts/:id/security-context */
  getSecurityContext: async (id: string | number) => {
    const response = await apiClient.get(`/alerts/${id}/security-context`);
    return response.data;
  },

  /** GET /alerts/:id/analysis — retrieve latest analysis */
  getAnalysis: async (id: string | number): Promise<Analysis> => {
    const response = await apiClient.get(`/alerts/${id}/analysis`);
    return response.data;
  },

  /** GET /alerts/:id/graph — Obsidian-style investigation entity graph */
  getInvestigationGraph: async (id: string | number): Promise<InvestigationGraphData> => {
    const response = await apiClient.get(`/alerts/${id}/graph`);
    return response.data;
  },

  /** GET /alerts/:id/trace — pipeline execution trace */
  getExecutionTrace: async (id: string | number, runId?: number): Promise<ExecutionTraceData> => {
    const url = runId ? `/alerts/${id}/trace?run_id=${runId}` : `/alerts/${id}/trace`;
    const response = await apiClient.get(url);
    return response.data;
  },

  /** Stream real-time stage execution trace events using Server-Sent Events (SSE) */
  streamExecutionTrace: (
    alertId: string | number,
    mode: string,
    onEvent: (event: any) => void,
    onError: (err: any) => void,
    onComplete: () => void
  ): (() => void) => {
    const baseURL = (apiClient.defaults.baseURL || '/api/v1').replace(/\/+$/, '');
    const url = `${baseURL}/alerts/${alertId}/analyze/stream?mode=${encodeURIComponent(mode)}`;
    const eventSource = new EventSource(url);

    eventSource.addEventListener('trace_event', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        onEvent(data);
        if (data.event_type === 'run_complete' || data.event_type === 'run_error') {
          eventSource.close();
          onComplete();
        }
      } catch (err) {
        onError(err);
      }
    });

    eventSource.onerror = (err) => {
      onError(err);
      eventSource.close();
      onComplete();
    };

    return () => {
      eventSource.close();
    };
  },

  /** GET /alerts/graph/global — Obsidian-style global environment entity graph */
  getGlobalGraph: async (scenarioId?: string, limit: number = 50, source?: string): Promise<InvestigationGraphData> => {
    const params = new URLSearchParams();
    if (scenarioId) params.append('scenario_id', scenarioId);
    if (limit) params.append('limit', limit.toString());
    if (source) params.append('source', source);
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await apiClient.get(`/alerts/graph/global${query}`);
    return response.data;
  },

  /** GET /alerts/demo-manifest — dataset provenance manifest */
  getDemoManifest: async (): Promise<DemoManifest> => {
    const response = await apiClient.get('/alerts/demo-manifest');
    return response.data;
  },

  /** POST /alerts/seed-demo — idempotently seed the demo scenarios */
  seedDemoAlerts: async (): Promise<{ status: string; created: number; skipped: number }> => {
    const response = await apiClient.post('/alerts/seed-demo');
    return response.data;
  },

  /** POST /alerts/sync — sync from Wazuh */
  syncAlerts: async (): Promise<SyncResult> => {
    const response = await apiClient.post('/alerts/sync');
    const data = response.data;
    return {
      ...data,
      synced: data.created ?? data.synced ?? 0,
      skipped: data.duplicates_skipped ?? data.skipped ?? 0,
    };
  },
};

export interface DemoScenario {
  id: string;
  title: string;
  category: string;
  mitre_techniques: string[];
  cve_ids?: string[];
  target_host: string;
  attacker_ip: string | null;
  event_count: number;
  max_severity: number;
}

export interface DemoManifest {
  dataset_version: string;
  data_origin: string;
  generation_method: string;
  provenance_statement: string;
  scenario_count: number;
  total_records: number;
  scenarios: DemoScenario[];
}

export interface GraphNode {
  id: string;
  type: 'alert' | 'host' | 'user' | 'ip' | 'rule' | 'mitre' | 'cve' | 'evidence' | 'analysis' | 'claim';
  label: string;
  provenance: 'observed' | 'retrieved' | 'knowledge_base' | 'inferred';
  status?: string;
  attributes?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  provenance: 'observed' | 'retrieved' | 'knowledge_base' | 'inferred';
  status?: string;
}

export interface InvestigationGraphData {
  alert_id: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  has_analysis: boolean;
  node_count: number;
  edge_count: number;
}

export interface ExecutionStage {
  step: number;
  stage_id?: string;
  name: string;
  component: string;
  purpose?: string;
  status: 'succeeded' | 'skipped' | 'failed' | 'running' | 'pending';
  duration_ms?: number;
  started_at?: string;
  completed_at?: string;
  interface: string;
  input_summary?: string;
  output_summary?: string;
  evidence_ids?: string[];
  error?: string;
  error_type?: string;
  safe_error_message?: string;
  details: string;
  records_processed: number;
  source_module?: string;
  tokens_used?: { prompt: number; completion: number };
}

export interface ExecutionRunSummary {
  id: number;
  mode: string;
  model_name: string;
  created_at: string | null;
  evidence_count: number;
  severity_assessment?: string;
  confidence?: string;
}

export interface ModeComparisonItem {
  id: number;
  mode: string;
  model_name: string;
  created_at: string | null;
  evidence_count: number;
  severity_assessment?: string;
  confidence?: string;
  total_duration_ms?: number;
}

export interface ExecutionTraceData {
  alert_id: number;
  analysis_id: number | null;
  mode: string;
  model_name: string;
  created_at: string | null;
  has_run: boolean;
  status?: string;
  total_duration_ms?: number;
  stages: ExecutionStage[];
  runs?: ExecutionRunSummary[];
  mode_comparison?: Record<string, ModeComparisonItem>;
}

export interface SyncResult {
  client_mode: 'mock' | 'real';
  fetched: number;
  created: number;
  duplicates_skipped: number;
  external_alert_ids: string[];
  synced?: number;
  skipped?: number;
}

export const analysisService = {
  /** GET /analyses — list persisted analyses */
  getAnalyses: async (alertId?: number): Promise<Analysis[]> => {
    const url = alertId ? `/analyses?alert_id=${alertId}` : '/analyses';
    const response = await apiClient.get(url);
    return response.data;
  },
  /** GET /analyses/:id — get analysis by id */
  getAnalysis: async (id: number): Promise<Analysis> => {
    const response = await apiClient.get(`/analyses/${id}`);
    return response.data;
  },
  /** GET /analyses/:id/evidence — get evidence for analysis */
  getEvidence: async (id: number) => {
    const response = await apiClient.get(`/analyses/${id}/evidence`);
    return response.data;
  },
};

/* ── Health / diagnostics ── */

export interface ServiceHealth {
  status: string;
  error?: string;
  [key: string]: unknown;
}

export interface DetailedHealth {
  status: string;
  dependencies_ok: boolean;
  services: Record<string, ServiceHealth>;
  config: {
    llm_provider: string;
    llm_model: string;
    embedding_provider: string;
    qdrant_collection: string;
    wazuh_mode: 'mock' | 'real';
  };
}

export const healthService = {
  /** GET /health — process status plus real per-dependency checks */
  check: async (): Promise<DetailedHealth> => {
    const response = await apiClient.get('/health');
    return response.data;
  },
};

/* ── Dashboard stats (real SQL aggregates + service health) ── */

export interface DashboardStats {
  generated_at: string;
  alerts: {
    total: number;
    severity_distribution: Record<'critical' | 'high' | 'medium' | 'low' | 'info', number>;
  };
  analyses: {
    total: number;
    by_mode: Record<string, number>;
    recent: Array<{
      id: number;
      alert_id: number;
      summary: string;
      severity_assessment: string;
      analysis_type?: string;
      model_name?: string;
      created_at: string;
    }>;
  };
  evidence: { total: number };
  services: Record<string, ServiceHealth>;
}

export const dashboardService = {
  getStats: async (source?: string): Promise<DashboardStats> => {
    const params = source ? `?source=${encodeURIComponent(source)}` : '';
    const response = await apiClient.get(`/dashboard/stats${params}`);
    return response.data;
  },
};

/* ── Data Sources (multi-source architecture: demo | live_wazuh | dataset_replay) ── */

export type DataSourceId = 'demo' | 'live_wazuh' | 'dataset_replay';

export interface DataSourceItem {
  id: DataSourceId;
  label: string;
  description: string;
  status: 'active' | 'ready' | 'unconfigured' | 'unreachable' | 'error';
  is_live: boolean;
  is_default: boolean;
  record_count: number;
  connector_type?: string;
  endpoint?: string;
  details: Record<string, unknown>;
}

export interface DataSourcesSummary {
  active_source: DataSourceId;
  sources: DataSourceItem[];
}

export const dataSourceService = {
  /** GET /datasources — retrieve available data sources and their status */
  getSources: async (active?: string): Promise<DataSourcesSummary> => {
    const params = active ? `?active=${encodeURIComponent(active)}` : '';
    const response = await apiClient.get(`/datasources${params}`);
    return response.data;
  },
};


/* ── Security Knowledge (real indexed records) ── */

export interface KnowledgeHit {
  score: number;
  source: string;
  document_id: string;
  source_identifier: string | null;
  source_url: string | null;
  title: string | null;
  chunk_index: number | null;
  content: string | null;
  cve_id: string | null;
  techniques: string[] | null;
}

export interface KnowledgeStats {
  collection: string;
  embedding: string;
  counts: Record<string, number>;
}

export interface ThreatIntelRecord {
  identifier: string;
  title: string;
  source: string;
  source_identifier: string;
  source_url: string | null;
  description: string;
  tactics: string[];
  platforms: string[];
  cvss_score: number | null;
  relevance_score: number;
  chunk_count: number;
  provenance: string;
}

export const knowledgeService = {
  search: async (
    query: string,
    source: 'all' | 'mitre_attack' | 'nvd_cve' = 'all',
    limit = 10
  ): Promise<KnowledgeHit[]> => {
    const response = await apiClient.get('/knowledge/search', {
      params: { q: query, source, limit },
    });
    return response.data;
  },

  getStats: async (): Promise<KnowledgeStats> => {
    const response = await apiClient.get('/knowledge/stats');
    return response.data;
  },

  getThreatIntel: async (identifier: string): Promise<ThreatIntelRecord> => {
    const response = await apiClient.get(`/knowledge/threat-intel/${encodeURIComponent(identifier)}`);
    return response.data;
  },
};

/* ── RAG Evaluation results (real runs from the evaluation runner) ── */

export interface EvaluationAggregateMode {
  cases: number;
  errors: number;
  wall_latency_seconds: { mean: number | null; median: number | null; stdev: number | null };
  llm_latency_seconds: { mean: number | null; median: number | null; stdev: number | null };
  severity_band_accuracy: number | null;
  severity_parseable_count: number;
  technique_precision: number | null;
  technique_recall: number | null;
  technique_f1: number | null;
  cve_precision?: number | null;
  cve_recall?: number | null;
  cve_f1?: number | null;
  benign_cases_count?: number;
  false_alarms_on_benign?: number;
  false_alarm_rate_on_benign?: number | null;
  benign_accuracy?: number | null;
  valid_evidence_reference_rate: number | null;
  grounding_coverage: number;
  'retrieval_recall@5': number | null;
  'retrieval_recall@1': number | null;
  retrieval_mrr: number | null;
}

export interface EvaluationLatest {
  available?: boolean;
  reason?: string;
  run_id?: string;
  status?: string;
  meta?: {
    run_id: string;
    timestamp_utc: string;
    dataset_version: string;
    dataset_path?: string;
    synthetic?: boolean;
    num_cases: number;
    llm_model: string;
    embedding_model: string;
    qdrant_collection: string;
    modes: string[];
    temperature: number;
  };
  aggregate?: Record<string, EvaluationAggregateMode>;
  records?: Array<Record<string, unknown>>;
  total_records?: number;
  report?: string | null;
  csv?: string | null;
}

export interface EvaluationRunSummary {
  run_id: string;
  timestamp_utc: string | null;
  dataset_version: string;
  num_cases: number;
  modes: string[];
  status: string;
  llm_model: string | null;
  synthetic: boolean;
  modes_evaluated: string[];
}

export interface EvaluationDatasetInfo {
  filename: string;
  dataset_version: string;
  description: string;
  synthetic: boolean;
  num_cases: number;
  categories: string[];
  benign_cases: number;
  attack_cases: number;
}

export const evaluationService = {
  getLatest: async (limit = 100): Promise<EvaluationLatest> => {
    const response = await apiClient.get('/evaluation/latest', {
      params: { limit },
      timeout: 15_000,
    });
    return response.data;
  },
  listRuns: async (): Promise<EvaluationRunSummary[]> => {
    const response = await apiClient.get('/evaluation/runs', { timeout: 10_000 });
    return response.data;
  },
  getRun: async (runId: string, limit = 100): Promise<EvaluationLatest> => {
    const response = await apiClient.get(`/evaluation/runs/${runId}`, {
      params: { limit },
      timeout: 15_000,
    });
    return response.data;
  },
  listDatasets: async (): Promise<EvaluationDatasetInfo[]> => {
    const response = await apiClient.get('/evaluation/datasets', { timeout: 10_000 });
    return response.data;
  },
};

