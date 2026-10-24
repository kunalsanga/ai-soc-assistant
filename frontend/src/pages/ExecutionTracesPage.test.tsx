import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExecutionTracesPage from './ExecutionTracesPage';

vi.mock('../services/api', () => ({
  alertService: {
    getAlerts: vi.fn(),
    getExecutionTrace: vi.fn(),
    streamExecutionTrace: vi.fn(),
  },
  healthService: {
    check: vi.fn(),
  },
  analysisService: {
    getEvidence: vi.fn(),
  },
}));

import { alertService, healthService, analysisService } from '../services/api';

const mockAlerts = [
  {
    id: 1,
    rule_id: 5710,
    rule_description: 'sshd: Attempt to login using a non-existent user',
    severity: 10,
    agent_name: 'srv-edge-linux01',
    agent_id: '001',
    timestamp: '2026-10-23T10:00:00Z',
    status: 'open',
    source_ip: '203.0.113.45',
    username: 'invalid_user',
  },
];

const mockTraceData = {
  alert_id: 1,
  analysis_id: 101,
  mode: 'evidence_aware',
  model_name: 'qwen3:8b',
  created_at: '2026-10-23T10:05:00Z',
  has_run: true,
  status: 'completed',
  total_duration_ms: 4350,
  stages: [
    {
      step: 1,
      stage_id: 'ingestion',
      name: 'Alert Ingestion & Normalization',
      component: 'app.wazuh.service.AlertService',
      purpose: 'Normalize raw payload',
      status: 'succeeded' as const,
      duration_ms: 14,
      interface: 'Internal function call',
      input_summary: 'Raw Wazuh JSON payload',
      output_summary: 'Normalized Alert #1',
      details: 'Normalized alert #1',
      records_processed: 1,
    },
    {
      step: 2,
      stage_id: 'context',
      name: 'Security Context Extraction',
      component: 'app.security.normalization',
      purpose: 'Extract security context',
      status: 'succeeded' as const,
      duration_ms: 8,
      interface: 'Internal function call',
      input_summary: 'Alert #1 attributes',
      output_summary: 'Extracted host, user, IP',
      details: 'Host: srv-edge-linux01, User: invalid_user',
      records_processed: 1,
    },
    {
      step: 8,
      stage_id: 'llm_inference',
      name: 'Local LLM Inference',
      component: 'app.llm.providers.ollama.OllamaLLMProvider',
      purpose: 'Execute local inference',
      status: 'succeeded' as const,
      duration_ms: 4200,
      interface: 'HTTP REST / qwen3:8b',
      input_summary: 'Structured analysis prompt',
      output_summary: 'Raw JSON response',
      details: 'Executed inference via qwen3:8b',
      records_processed: 1,
    },
  ],
  runs: [
    {
      id: 101,
      mode: 'evidence_aware',
      model_name: 'qwen3:8b',
      created_at: '2026-10-23T10:05:00Z',
      evidence_count: 3,
      severity_assessment: 'HIGH',
      confidence: 'HIGH',
    },
  ],
};

const mockEvidence = [
  {
    id: 1,
    analysis_id: 101,
    source: 'mitre_attack',
    document_id: 'T1110.001',
    title: 'Password Guessing',
    content: 'Adversaries may try passwords against accounts to gain valid credentials.',
    relevance_score: 0.895,
    citation: '[T1110.001] Password Guessing',
  },
];

const mockHealthData = {
  status: 'ok',
  dependencies_ok: true,
  services: {
    postgres: { status: 'connected' },
    qdrant: { status: 'connected', points_count: 1762 },
    ollama: { status: 'connected', model: 'qwen3:8b' },
    wazuh: { status: 'using_mock_client' },
  },
  config: {
    llm_provider: 'ollama',
    llm_model: 'qwen3:8b',
    embedding_provider: 'semantic',
    qdrant_collection: 'security_knowledge',
    wazuh_mode: 'mock',
  },
};

function renderPage(initialEntries = ['/execution']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ExecutionTracesPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  (alertService.getAlerts as Mock).mockResolvedValue(mockAlerts);
  (alertService.getExecutionTrace as Mock).mockResolvedValue(mockTraceData);
  (healthService.check as Mock).mockResolvedValue(mockHealthData);
  (analysisService.getEvidence as Mock).mockResolvedValue(mockEvidence);
});

describe('ExecutionTracesPage', () => {
  it('renders header, telemetry badges, health strip, and architecture canvas', async () => {
    renderPage();

    expect(screen.getByText('Pipeline Execution')).toBeInTheDocument();
    expect(screen.getByText(/LIVE DATA-FLOW OBSERVABILITY/i)).toBeInTheDocument();
    expect(screen.getByText(/SYNTHETIC DEMO DATA/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Alert #1/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Local LLM Inference/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Qdrant Vector Retrieval/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Execution Timeline Waterfall/i)).toBeInTheDocument();
    });
  });

  it('opens and updates Technical Inspector when selecting a canvas node or waterfall item', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/Local LLM Inference/i).length).toBeGreaterThanOrEqual(1);
    });

    // Inspector is default closed to maximize canvas viewport. Clicking opens it.
    const inspectorBtn = screen.getByRole('button', { name: /Inspector/i });
    fireEvent.click(inspectorBtn);

    expect(screen.getByText('Stage Objective')).toBeInTheDocument();
    expect(screen.getByText('Stage #8')).toBeInTheDocument();
    expect(screen.getByText(/Why This Matters to a SOC Analyst/i)).toBeInTheDocument();

    // Switch inspector tab to Inputs
    const inputsTab = screen.getByRole('button', { name: 'Inputs' });
    fireEvent.click(inputsTab);
    expect(screen.getByText(/Sanitized Input Payload/i)).toBeInTheDocument();

    // Switch to Outputs
    const outputsTab = screen.getByRole('button', { name: 'Outputs' });
    fireEvent.click(outputsTab);
    expect(screen.getByText(/Operation Result/i)).toBeInTheDocument();
  });

  it('switches bottom panels between Timeline Waterfall, Live Event Log, Retrieved Evidence, and Mode Comparison', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Live Event Log/i)).toBeInTheDocument();
      expect(screen.getByText(/Retrieved Evidence/i)).toBeInTheDocument();
    });

    // Click Live Event Log (expands bottom drawer)
    fireEvent.click(screen.getByText(/Live Event Log/i));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Filter events.../i)).toBeInTheDocument();
    });

    // Click Retrieved Evidence
    const evidenceTabBtn = screen.getByRole('button', { name: /Retrieved Evidence/i });
    fireEvent.click(evidenceTabBtn);
    await waitFor(() => {
      expect(screen.getByText(/T1110.001: Password Guessing/i)).toBeInTheDocument();
      expect(screen.getByText(/89.5% match/i)).toBeInTheDocument();
    });

    // Click Mode Comparison
    const comparisonBtn = screen.getByRole('button', { name: /Mode Comparison/i });
    fireEvent.click(comparisonBtn);
    expect(screen.getAllByText('LLM Only (Ablation)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('RECOMMENDED')).toBeInTheDocument();
    expect(screen.getByText('BASELINE')).toBeInTheDocument();
  });

  it('toggles bottom drawer expand and collapse', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Expand Drawer/i)).toBeInTheDocument();
    });

    const toggleBtn = screen.getByRole('button', { name: /Expand Drawer/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/Collapse/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Collapse/i }));
    expect(screen.getByText(/Expand Drawer/i)).toBeInTheDocument();
  });

  it('allows starting historical replay without calling backend LLM', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Run: #101')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Replay/i })).toBeInTheDocument();
    });

    const replayBtn = screen.getByRole('button', { name: /Replay/i });
    fireEvent.click(replayBtn);

    await waitFor(() => {
      expect(screen.getByText(/HISTORICAL REPLAY/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument();
    });
  });

  it('handles backend error state gracefully', async () => {
    (alertService.getExecutionTrace as Mock).mockRejectedValue(new Error('Backend connection refused'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Backend connection refused/i)).toBeInTheDocument();
    });
  });
});
