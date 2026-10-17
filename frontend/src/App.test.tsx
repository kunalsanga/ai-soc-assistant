import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

vi.mock('./services/api', () => ({
  dashboardService: { getStats: vi.fn() },
  alertService: {
    getAlerts: vi.fn().mockResolvedValue([]),
    getAnalysis: vi.fn(),
    analyzeAlert: vi.fn(),
    syncAlerts: vi.fn(),
    getSecurityContext: vi.fn(),
  },
  knowledgeService: { search: vi.fn(), getStats: vi.fn() },
  evaluationService: { getLatest: vi.fn() },
  healthService: { check: vi.fn().mockResolvedValue({ status: 'ok', dependencies_ok: true, services: {}, config: { llm_provider: 'ollama', llm_model: 'qwen3:8b', embedding_provider: 'semantic', qdrant_collection: 'security_knowledge', wazuh_mode: 'mock' } }) },
}));

import { dashboardService } from './services/api';

vi.mocked(dashboardService.getStats).mockRejectedValue({
  message: 'Backend unreachable in test',
});

describe('App Routing', () => {
  it('renders the dashboard route by default', () => {
    render(<App />);
    expect(
      screen.getByRole('link', { name: 'Dashboard' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alert Stream' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AI Analysis' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Security Knowledge' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'RAG Evaluation' })).toBeInTheDocument();
    // Retired pages must not appear in the navigation.
    expect(screen.queryByRole('link', { name: 'Investigations' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Threat Intelligence' })).not.toBeInTheDocument();
    expect(screen.queryByText('Bivan')).not.toBeInTheDocument();
  });
});
