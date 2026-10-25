import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Evaluation from './Evaluation';

vi.mock('../services/api', () => ({
  evaluationService: {
    getLatest: vi.fn(),
    listRuns: vi.fn(),
    getRun: vi.fn(),
    listDatasets: vi.fn(),
  },
}));

import { evaluationService } from '../services/api';

const mockRuns = [
  {
    run_id: '20261024-120000-abc123',
    timestamp_utc: '2026-10-24T12:00:00Z',
    dataset_version: 'v2',
    num_cases: 40,
    modes: ['llm_only', 'standard_rag', 'evidence_aware'],
    status: 'completed',
    llm_model: 'qwen3:8b',
    synthetic: true,
    modes_evaluated: ['llm_only', 'standard_rag', 'evidence_aware'],
  },
];

const mockDatasets = [
  {
    filename: 'dataset_v2.json',
    dataset_version: 'v2',
    description: 'Curated 40 synthetic security alert scenarios',
    synthetic: true,
    num_cases: 40,
    categories: ['credential_access', 'benign_control', 'malware_ransomware'],
    benign_cases: 4,
    attack_cases: 36,
  },
];

const mockEvaluationData = {
  run_id: '20261024-120000-abc123',
  status: 'completed',
  meta: {
    run_id: '20261024-120000-abc123',
    timestamp_utc: '2026-10-24T12:00:00Z',
    dataset_version: 'v2',
    dataset_path: 'backend/evaluation/dataset_v2.json',
    synthetic: true,
    num_cases: 40,
    llm_model: 'qwen3:8b',
    embedding_model: 'sentence-transformers/all-MiniLM-L6-v2',
    qdrant_collection: 'security_knowledge',
    modes: ['llm_only', 'standard_rag', 'evidence_aware'],
    temperature: 0.0,
  },
  aggregate: {
    llm_only: {
      cases: 40,
      errors: 0,
      wall_latency_seconds: { mean: 35.2, median: 34.0, stdev: 3.5 },
      llm_latency_seconds: { mean: 35.0, median: 33.8, stdev: 3.5 },
      severity_band_accuracy: 0.75,
      severity_parseable_count: 40,
      technique_precision: 0.70,
      technique_recall: 0.65,
      technique_f1: 0.67,
      cve_f1: 0.0,
      benign_cases_count: 4,
      false_alarms_on_benign: 2,
      false_alarm_rate_on_benign: 0.50,
      benign_accuracy: 0.50,
      valid_evidence_reference_rate: null,
      grounding_coverage: 0,
      'retrieval_recall@5': null,
      'retrieval_recall@1': null,
      retrieval_mrr: null,
    },
    evidence_aware: {
      cases: 40,
      errors: 0,
      wall_latency_seconds: { mean: 42.1, median: 41.0, stdev: 4.1 },
      llm_latency_seconds: { mean: 40.5, median: 39.5, stdev: 4.0 },
      severity_band_accuracy: 0.95,
      severity_parseable_count: 40,
      technique_precision: 0.92,
      technique_recall: 0.89,
      technique_f1: 0.90,
      cve_f1: 1.0,
      benign_cases_count: 4,
      false_alarms_on_benign: 0,
      false_alarm_rate_on_benign: 0.0,
      benign_accuracy: 1.0,
      valid_evidence_reference_rate: 1.0,
      grounding_coverage: 40,
      'retrieval_recall@5': 0.98,
      'retrieval_recall@1': 0.90,
      retrieval_mrr: 0.94,
    },
  },
  records: [
    {
      case_id: 'case-01-ssh-bruteforce',
      category: 'credential_access',
      mode: 'evidence_aware',
      is_benign: false,
      expected_severity_band: 'high',
      severity_band_match: true,
      technique_prf1: { precision: 1.0, recall: 1.0, f1: 1.0 },
      expected_cves: [],
      valid_evidence_reference_rate: 1.0,
      wall_latency_seconds: 38.5,
      summary: 'SSH brute force attack identified from external IP.',
    },
    {
      case_id: 'case-37-authorized-nessus-scan',
      category: 'benign_control',
      mode: 'evidence_aware',
      is_benign: true,
      expected_severity_band: 'low',
      severity_band_match: true,
      technique_prf1: { precision: 1.0, recall: 1.0, f1: 1.0 },
      expected_cves: [],
      valid_evidence_reference_rate: 1.0,
      wall_latency_seconds: 29.1,
      summary: 'Authorized vulnerability scan matched against change ticket.',
    },
  ],
};

function renderEvaluation() {
  return render(
    <MemoryRouter>
      <Evaluation />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Evaluation Page', () => {
  it('renders synthetic benchmark banner, run metadata, and comparative results table', async () => {
    (evaluationService.listRuns as Mock).mockResolvedValue(mockRuns);
    (evaluationService.listDatasets as Mock).mockResolvedValue(mockDatasets);
    (evaluationService.getLatest as Mock).mockResolvedValue(mockEvaluationData);

    renderEvaluation();

    // Verify Synthetic Benchmark banner
    expect(await screen.findByText(/Synthetic Evaluation Telemetry/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulated Wazuh/i)).toBeInTheDocument();

    // Verify Run Configuration
    expect(screen.getByText(/run 20261024-120000-abc123/i)).toBeInTheDocument();
    expect(screen.getByText('qwen3:8b')).toBeInTheDocument();

    // Verify comparative table metrics
    expect(screen.getByText('Technique F1 score')).toBeInTheDocument();
    expect(screen.getByText('Benign false alarm rate')).toBeInTheDocument();
    expect(screen.getByText('Valid evidence citation rate')).toBeInTheDocument();

    // Verify per-case items
    expect(screen.getByText('case-01-ssh-bruteforce')).toBeInTheDocument();
    expect(screen.getByText('case-37-authorized-nessus-scan')).toBeInTheDocument();
    expect(screen.getByText('BENIGN CONTROL')).toBeInTheDocument();
  });

  it('toggles metric definitions explanation on click', async () => {
    (evaluationService.listRuns as Mock).mockResolvedValue(mockRuns);
    (evaluationService.listDatasets as Mock).mockResolvedValue(mockDatasets);
    (evaluationService.getLatest as Mock).mockResolvedValue(mockEvaluationData);

    renderEvaluation();

    const toggleButton = await screen.findByRole('button', { name: /metric definitions/i });
    await userEvent.click(toggleButton);

    expect(screen.getByText(/Exact-set comparison between predicted MITRE ATT&CK technique IDs/i)).toBeInTheDocument();
  });

  it('filters per-case records by benign controls', async () => {
    (evaluationService.listRuns as Mock).mockResolvedValue(mockRuns);
    (evaluationService.listDatasets as Mock).mockResolvedValue(mockDatasets);
    (evaluationService.getLatest as Mock).mockResolvedValue(mockEvaluationData);

    renderEvaluation();

    expect(await screen.findByText('case-01-ssh-bruteforce')).toBeInTheDocument();
    expect(screen.getByText('case-37-authorized-nessus-scan')).toBeInTheDocument();

    // Click 'Benign Controls' filter button
    const benignFilterBtn = screen.getByRole('button', { name: /Benign Controls/i });
    await userEvent.click(benignFilterBtn);

    // Only benign case should remain
    expect(screen.getByText('case-37-authorized-nessus-scan')).toBeInTheDocument();
    expect(screen.queryByText('case-01-ssh-bruteforce')).not.toBeInTheDocument();
  });
});
