/**
 * Frontend honesty tests: real API data renders, zero records shows a real
 * empty state, API failures show a visible error and retry (never mock data).
 * services/api is mocked so no network is needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

vi.mock('../services/api', () => ({
  dashboardService: { getStats: vi.fn() },
  alertService: { getAlerts: vi.fn(), syncAlerts: vi.fn() },
  knowledgeService: { search: vi.fn(), getStats: vi.fn() },
  evaluationService: { getLatest: vi.fn() },
  healthService: { check: vi.fn() },
}));

import { dashboardService, alertService } from '../services/api';

const baseStats = {
  generated_at: '2026-10-17T00:00:00Z',
  alerts: {
    total: 11,
    severity_distribution: { critical: 4, high: 5, medium: 1, low: 1, info: 0 },
  },
  analyses: { total: 15, by_mode: { evidence_aware: 10 }, recent: [] },
  evidence: { total: 14 },
  services: {
    postgres: { status: 'connected' },
    qdrant: { status: 'connected', points_count: 1618, collection: 'security_knowledge' },
    ollama: { status: 'reachable', model: 'qwen3:8b', model_available: true },
    wazuh: { mode: 'mock', status: 'using_mock_client' },
  },
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Dashboard — real data flow', () => {
  it('renders real stats returned by the dashboard API', async () => {
    (dashboardService.getStats as Mock).mockResolvedValue(baseStats);
    (alertService.getAlerts as Mock).mockResolvedValue([]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Security Operations Center')).toBeInTheDocument();
    });
    // Real aggregate values appear ("11" total alerts, 1618 knowledge points).
    expect(await screen.findByText('Alerts in Database')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('1618')).toBeInTheDocument();
  });

  it('shows a visible error and retry when the backend is unreachable', async () => {
    (dashboardService.getStats as Mock).mockRejectedValue({
      message: 'Network Error',
    });

    renderDashboard();

    expect(await screen.findByText('Dashboard data unavailable')).toBeInTheDocument();
    expect(screen.getByText('Network Error')).toBeInTheDocument();

    // Retry calls the API again on click.
    (dashboardService.getStats as Mock).mockClear();
    const retry = screen.getByRole('button', { name: /retry/i });
    (dashboardService.getStats as Mock).mockResolvedValue(baseStats);
    await userEvent.click(retry);
    await waitFor(() => {
      expect(dashboardService.getStats).toHaveBeenCalled();
    });
  });

  it('shows a real empty state with zero alerts and honest mock Wazuh disclosure', async () => {
    (dashboardService.getStats as Mock).mockResolvedValue({
      ...baseStats,
      alerts: {
        total: 0,
        severity_distribution: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      },
      analyses: { total: 0, by_mode: {}, recent: [] },
      evidence: { total: 0 },
    });
    (alertService.getAlerts as Mock).mockResolvedValue([]);

    renderDashboard();

    expect(await screen.findByText(/No alerts in the database/i)).toBeInTheDocument();
    // The active Wazuh mode must be shown honestly.
    expect(screen.getAllByText(/mock/i).length).toBeGreaterThan(0);
  });

  it('never renders mock alert fixtures when the API fails', async () => {
    (dashboardService.getStats as Mock).mockRejectedValue({ message: 'boom' });
    (alertService.getAlerts as Mock).mockRejectedValue(new Error('offline'));

    renderDashboard();

    await screen.findByText('Dashboard data unavailable');
    // From the deleted fixtures — must NOT appear.
    expect(screen.queryByText(/Exampleseries/i)).not.toBeInTheDocument();
  });
});
