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
  it('renders the operations, intelligence, and research navigation links', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /alerts & triage/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /investigations/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /entity graph/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /architecture/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pipeline execution/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /threat knowledge/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /rag evaluation/i })).toBeInTheDocument();
    expect(screen.queryByText('Bivan')).not.toBeInTheDocument();
  });
});
