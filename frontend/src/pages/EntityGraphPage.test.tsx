import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EntityGraphPage from './EntityGraphPage';

vi.mock('../services/api', () => ({
  alertService: {
    getInvestigationGraph: vi.fn(),
    getGlobalGraph: vi.fn(),
    getDemoManifest: vi.fn(),
  },
}));

import { alertService } from '../services/api';

const mockGraphData = {
  scenario_id: 'scenario-001',
  total_alerts: 5,
  node_count: 6,
  edge_count: 5,
  nodes: [
    {
      id: 'alert-1',
      type: 'alert' as const,
      label: 'Alert #1: SSH Brute Force',
      provenance: 'observed' as const,
      status: 'severity_10',
      attributes: { id: 1, severity: 10, scenario_id: 'scenario-001' },
    },
    {
      id: 'host-srv-edge-linux01',
      type: 'host' as const,
      label: 'srv-edge-linux01',
      provenance: 'observed' as const,
      status: 'active',
      attributes: { hostname: 'srv-edge-linux01', scenario_id: 'scenario-001' },
    },
    {
      id: 'ip-203.0.113.45',
      type: 'ip' as const,
      label: '203.0.113.45',
      provenance: 'observed' as const,
      status: 'external',
      attributes: { ip: '203.0.113.45', direction: 'source', scenario_id: 'scenario-001' },
    },
    {
      id: 'rule-5710',
      type: 'rule' as const,
      label: 'Rule: 5710',
      provenance: 'observed' as const,
      status: 'triggered',
      attributes: { description: 'sshd: login attempt', scenario_id: 'scenario-001' },
    },
    {
      id: 'mitre-T1110.001',
      type: 'mitre' as const,
      label: 'ATT&CK T1110.001',
      provenance: 'knowledge_base' as const,
      status: 'mapped',
      attributes: { technique_id: 'T1110.001', scenario_id: 'scenario-001' },
    },
    {
      id: 'cve-CVE-2021-44228',
      type: 'cve' as const,
      label: 'CVE-2021-44228',
      provenance: 'knowledge_base' as const,
      status: 'contextual',
      attributes: { cve_id: 'CVE-2021-44228', scenario_id: 'scenario-004' },
    },
  ],
  edges: [
    {
      id: 'e-1',
      source: 'alert-1',
      target: 'host-srv-edge-linux01',
      relationship: 'occurred_on_host',
      provenance: 'observed',
      status: 'confirmed',
    },
    {
      id: 'e-2',
      source: 'alert-1',
      target: 'ip-203.0.113.45',
      relationship: 'source_ip',
      provenance: 'observed',
      status: 'confirmed',
    },
    {
      id: 'e-3',
      source: 'alert-1',
      target: 'rule-5710',
      relationship: 'triggered_rule',
      provenance: 'observed',
      status: 'confirmed',
    },
    {
      id: 'e-4',
      source: 'rule-5710',
      target: 'mitre-T1110.001',
      relationship: 'maps_to_technique',
      provenance: 'knowledge_base',
      status: 'confirmed',
    },
    {
      id: 'e-5',
      source: 'alert-1',
      target: 'cve-CVE-2021-44228',
      relationship: 'potential_vulnerability',
      provenance: 'knowledge_base',
      status: 'confirmed',
    },
  ],
};

const mockManifest = {
  dataset_version: 'demo-v1',
  data_origin: 'synthetic_demo',
  generation_method: 'Deterministic',
  provenance_statement: 'Demonstration dataset',
  scenario_count: 1,
  total_records: 5,
  scenarios: [
    {
      id: 'scenario-001',
      title: 'SSH Credential Access & Brute Force',
      category: 'Credential Access',
      mitre_techniques: ['T1110.001'],
      target_host: 'srv-edge-linux01',
      attacker_ip: '203.0.113.45',
      event_count: 5,
      max_severity: 10,
    },
  ],
};

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

function renderEntityGraph(initialEntries = ['/graph']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <EntityGraphPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  (alertService.getGlobalGraph as Mock).mockResolvedValue(mockGraphData);
  (alertService.getDemoManifest as Mock).mockResolvedValue(mockManifest);
});

describe('EntityGraphPage', () => {
  it('renders header, graph view panel, controls, and nodes correctly', async () => {
    renderEntityGraph();

    expect(screen.getByText('Obsidian Entity Graph')).toBeInTheDocument();
    expect(screen.getByText(/TOPOLOGICAL CLUSTER EXPLORER/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Graph view')).toBeInTheDocument();
      expect(screen.getAllByText(/6 nodes/i).length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByTitle(/Fit to View/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Zoom In/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Zoom Out/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Reset View/i)).toBeInTheDocument();
  });

  it('filters nodes based on search input and shows empty state when nothing matches', async () => {
    renderEntityGraph();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search node or label.../i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search node or label.../i);
    fireEvent.change(searchInput, { target: { value: 'nonexistent-entity-xyz' } });

    await waitFor(() => {
      expect(screen.getByText(/No matching entities found/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reset Filters/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Reset Filters/i }));

    await waitFor(() => {
      expect(screen.queryByText(/No matching entities found/i)).not.toBeInTheDocument();
    });
  });

  it('opens and closes contextual inspector when selecting a node', async () => {
    const { container } = renderEntityGraph();

    let nodeEl: Element | null = null;
    await waitFor(() => {
      const nodes = container.querySelectorAll('.graph-node');
      expect(nodes.length).toBeGreaterThan(0);
      nodeEl = nodes[0];
    });

    // Click on node
    if (nodeEl) fireEvent.click(nodeEl);

    await waitFor(() => {
      expect(screen.getByRole('complementary', { name: /Entity Inspector/i })).toBeInTheDocument();
      expect(screen.getByText(/Observed Telemetry/i)).toBeInTheDocument();
    });

    // Close inspector
    const closeBtn = screen.getByTitle(/Close inspector/i);
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: /Entity Inspector/i })).not.toBeInTheDocument();
    });
  });

  it('displays error state gracefully when API fails', async () => {
    (alertService.getGlobalGraph as Mock).mockRejectedValue(new Error('Database network timeout'));
    renderEntityGraph();

    await waitFor(() => {
      expect(screen.getByText(/Failed to render entity graph/i)).toBeInTheDocument();
      expect(screen.getByText(/Database network timeout/i)).toBeInTheDocument();
    });
  });

  it('allows adjusting node scale and toggling adaptive zoom sizing', async () => {
    renderEntityGraph();

    await waitFor(() => {
      expect(screen.getByText('Display & Physics')).toBeInTheDocument();
      expect(screen.getByText('Adaptive Zoom Sizing')).toBeInTheDocument();
      expect(screen.getByText('Node Size')).toBeInTheDocument();
    });

    expect(screen.getByText('100%')).toBeInTheDocument();

    const slider = screen.getByLabelText(/Node Size Slider/i);
    fireEvent.change(slider, { target: { value: '1.4' } });

    expect(screen.getByText('140%')).toBeInTheDocument();
  });
});
