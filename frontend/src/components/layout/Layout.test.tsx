import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from './Layout';

vi.mock('../../services/api', () => ({
  healthService: {
    check: vi.fn().mockResolvedValue({
      status: 'ok',
      dependencies_ok: true,
      services: {
        postgres: { status: 'connected' },
        qdrant: { status: 'connected', points_count: 1762 },
        ollama: { status: 'reachable' },
        wazuh: { status: 'connected', mode: 'mock' },
      },
      config: {
        llm_provider: 'ollama',
        llm_model: 'qwen3:8b',
        wazuh_mode: 'mock',
      },
    }),
  },
  alertService: {
    getAlerts: vi.fn().mockResolvedValue([]),
  },
}));

describe('Layout component', () => {
  it('renders standard max-w-7xl padded container on standard routes like /alerts', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/alerts']}>
        <Layout>
          <div>Alerts Content</div>
        </Layout>
      </MemoryRouter>
    );

    const main = container.querySelector('main');
    expect(main).toHaveClass('overflow-y-auto');
    expect(main?.querySelector('.max-w-7xl')).toBeInTheDocument();
  });

  it('renders full-bleed container without max-w-7xl constraint on /execution', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/execution']}>
        <Layout>
          <div>Execution Canvas Content</div>
        </Layout>
      </MemoryRouter>
    );

    const main = container.querySelector('main');
    expect(main).toHaveClass('overflow-hidden');
    expect(main?.querySelector('.max-w-7xl')).not.toBeInTheDocument();
  });

  it('renders full-bleed container without max-w-7xl constraint on /graph', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/graph']}>
        <Layout>
          <div>Graph Canvas Content</div>
        </Layout>
      </MemoryRouter>
    );

    const main = container.querySelector('main');
    expect(main).toHaveClass('overflow-hidden');
    expect(main?.querySelector('.max-w-7xl')).not.toBeInTheDocument();
  });

  it('collapses and expands the sidebar smoothly with the dedicated toggles', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Layout>
          <div>Dashboard Content</div>
        </Layout>
      </MemoryRouter>
    );

    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('w-64');

    // Click collapse button
    const collapseBtn = screen.getByTitle('Collapse sidebar');
    act(() => {
      fireEvent.click(collapseBtn);
    });
    expect(aside).toHaveClass('w-20');

    // In collapsed state, expand button is available on the centered shield tile
    const expandBtn = screen.getByTitle('Expand sidebar');
    act(() => {
      fireEvent.click(expandBtn);
    });
    expect(aside).toHaveClass('w-64');
  });
});
