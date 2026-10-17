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
import type { Alert, Analysis } from '../types/alert';

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
  /** GET /alerts — list all alerts */
  getAlerts: async (): Promise<Alert[]> => {
    const response = await apiClient.get('/alerts');
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
  getStats: async (): Promise<DashboardStats> => {
    const response = await apiClient.get('/dashboard/stats');
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
  valid_evidence_reference_rate: number | null;
  grounding_coverage: number;
  'retrieval_recall@5': number | null;
  'retrieval_recall@1': number | null;
  retrieval_mrr: number | null;
}

export interface EvaluationLatest {
  available: boolean;
  reason?: string;
  run_id?: string;
  meta?: {
    run_id: string;
    timestamp_utc: string;
    dataset_version: string;
    num_cases: number;
    llm_model: string;
    embedding_model: string;
    qdrant_collection: string;
    modes: string[];
    temperature: number;
  };
  aggregate?: Record<string, EvaluationAggregateMode>;
  records?: Array<Record<string, unknown>>;
}

export const evaluationService = {
  getLatest: async (includeRecords = true): Promise<EvaluationLatest> => {
    const response = await apiClient.get('/evaluation/latest', {
      params: { include_records: includeRecords },
      timeout: 15_000,
    });
    return response.data;
  },
};
