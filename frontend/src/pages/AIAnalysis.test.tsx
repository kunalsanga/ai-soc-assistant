/**
 * AI Analysis page tests: analysis success renders the persisted result with
 * genuine evidence, timeout/error states are visible, and modes are sent to
 * the backend verbatim.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AIAnalysis from './AIAnalysis';

vi.mock('../services/api', () => ({
  alertService: { getAlerts: vi.fn(), getAnalysis: vi.fn(), analyzeAlert: vi.fn() },
  dashboardService: { getStats: vi.fn() },
  knowledgeService: { search: vi.fn(), getStats: vi.fn() },
  evaluationService: { getLatest: vi.fn() },
  healthService: { check: vi.fn() },
}));

import { alertService } from '../services/api';

const alert = {
  id: 3,
  external_alert_id: 'wazuh-9',
  timestamp: '2026-10-16T09:00:00Z',
  severity: 10,
  rule_id: '31103',
  rule_description: 'Multiple authentication failures',
  agent_name: 'db-01',
  source_ip: '198.51.100.7',
  status: 'open',
  created_at: '2026-10-16T09:00:05Z',
};

const analysis = {
  id: 15,
  alert_id: 3,
  summary: 'Potential password spraying detected.',
  severity_assessment: 'High — credential compromise risk.',
  explanation: 'Reasoning... Limitations/Notes: evidence lacks X.',
  recommended_investigation: '1. Review auth logs\n2. Check lockout policy',
  confidence: 'HIGH',
  model_name: 'qwen3:8b',
  analysis_type: 'evidence_aware',
  evidence: [
    {
      id: 1,
      analysis_id: 15,
      source: 'mitre_attack',
      document_id: 'mitre_attack:technique:T1110',
      title: 'Brute Force',
      content: 'Adversaries may use brute force techniques.',
      relevance_score: 0.4993,
      citation: 'T1110 - Brute Force',
    },
  ],
};

function renderAnalysis() {
  return render(
    <MemoryRouter initialEntries={['/ai-analysis']}>
      <AIAnalysis />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AI Analysis page', () => {
  it('renders the persisted analysis and its real evidence', async () => {
    (alertService.getAlerts as Mock).mockResolvedValue([alert]);
    (alertService.getAnalysis as Mock).mockResolvedValue(analysis);

    renderAnalysis();

    expect(await screen.findByText('Potential password spraying detected.')).toBeInTheDocument();
    expect(screen.getByText('Model: qwen3:8b')).toBeInTheDocument();
    expect(screen.getByText(/evidence_aware/i)).toBeInTheDocument();
    expect(screen.getByText('mitre_attack:technique:T1110:')).toBeInTheDocument();
    // Scores are retrieval similarity, not a fabricated percent.
    expect(screen.getByText(/similarity 0.499/)).toBeInTheDocument();
    expect(screen.queryByText(/94% grounded/i)).not.toBeInTheDocument();
  });

  it('shows a not-run state when no analysis exists yet (404 is not an error)', async () => {
    (alertService.getAlerts as Mock).mockResolvedValue([alert]);
    (alertService.getAnalysis as Mock).mockRejectedValue({ response: { status: 404 } });

    renderAnalysis();

    expect(
      await screen.findByText(/No analysis has been run for alert #3/i)
    ).toBeInTheDocument();
  });

  it('shows a visible failure state when analysis times out, then retries', async () => {
    (alertService.getAlerts as Mock).mockResolvedValue([alert]);
    (alertService.getAnalysis as Mock).mockRejectedValue({ response: { status: 404 } });

    renderAnalysis();
    await screen.findByText(/No analysis has been run/i);

    (alertService.analyzeAlert as Mock).mockRejectedValue({
      code: 'ECONNABORTED',
      message: 'timeout of 300000ms exceeded',
    });

    await userEvent.click(screen.getByRole('button', { name: /run analysis/i }));

    await waitFor(() => {
      expect(screen.getByText(/Analysis unavailable/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/timed out/i)).toBeInTheDocument();
  });

  it('sends the selected mode to the backend verbatim', async () => {
    (alertService.getAlerts as Mock).mockResolvedValue([alert]);
    (alertService.getAnalysis as Mock).mockResolvedValue(analysis);
    (alertService.analyzeAlert as Mock).mockResolvedValue(analysis);

    renderAnalysis();
    await screen.findByText('Potential password spraying detected.');

    // Switch to llm_only mode and run.
    await userEvent.click(screen.getByText('LLM Only'));
    await userEvent.click(screen.getByRole('button', { name: /run new analysis/i }));

    await waitFor(() => {
      expect(alertService.analyzeAlert).toHaveBeenCalledWith(3, 'llm_only');
    });
  });
});
