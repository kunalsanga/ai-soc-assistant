/**
 * Alert Stream page tests: API success renders real rows, API failure shows
 * a visible error with retry, and zero records shows a real empty state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Alerts from './Alerts';

vi.mock('../services/api', () => ({
  alertService: { getAlerts: vi.fn(), syncAlerts: vi.fn(), analyzeAlert: vi.fn() },
  dashboardService: { getStats: vi.fn() },
  knowledgeService: { search: vi.fn(), getStats: vi.fn() },
  evaluationService: { getLatest: vi.fn() },
  healthService: { check: vi.fn() },
}));

import { alertService } from '../services/api';

const apiAlert = {
  id: 7,
  external_alert_id: 'wazuh-42',
  timestamp: '2026-10-16T10:00:00Z',
  severity: 13,
  rule_id: '5710',
  rule_description: 'sshd: brute force trying to access the system',
  agent_name: 'web-01',
  source_ip: '203.0.113.5',
  status: 'open',
  created_at: '2026-10-16T10:00:05Z',
};

function renderAlerts() {
  return render(
    <MemoryRouter>
      <Alerts />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Alerts page', () => {
  it('renders alerts from the real API — not fixtures', async () => {
    (alertService.getAlerts as Mock).mockResolvedValue([apiAlert]);
    renderAlerts();
    expect(
      await screen.findByText(/brute force trying to access the system/i)
    ).toBeInTheDocument();
    expect(screen.getByText('203.0.113.5')).toBeInTheDocument();
    expect(screen.getByText('web-01')).toBeInTheDocument();
  });

  it('shows an error with retry when the API fails (no mock fallback)', async () => {
    (alertService.getAlerts as Mock).mockRejectedValue({
      message: 'Backend is down',
    });
    renderAlerts();
    expect(await screen.findByText('Could not load alerts')).toBeInTheDocument();
    expect(screen.getByText('Backend is down')).toBeInTheDocument();
    // The deleted 8-alert fixture content must never appear.
    expect(screen.queryByText('Failing Password')).not.toBeInTheDocument();
  });

  it('shows a real empty state when the database has zero alerts', async () => {
    (alertService.getAlerts as Mock).mockResolvedValue([]);
    renderAlerts();
    expect(await screen.findByText('No Alerts in the Database')).toBeInTheDocument();
  });

  it('shows the no-matching-results state when filters exclude everything', async () => {
    (alertService.getAlerts as Mock).mockResolvedValue([apiAlert]);
    renderAlerts();
    const rows = await screen.findAllByText(/brute force/i);
    expect(rows.length).toBeGreaterThan(0);
    // Filter for a term that matches nothing via the search box.
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.type(
      screen.getByPlaceholderText(/search by rule description/i),
      'zzz-no-match-zzz'
    );
    await waitFor(() => {
      expect(screen.getByText('No Matching Security Alerts')).toBeInTheDocument();
    });
  });
});
