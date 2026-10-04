/**
 * AI SOC Assistant — Mock Alert Data
 *
 * ⚠ DEVELOPMENT DATA — Not sourced from a live Wazuh instance.
 * Used only when the backend API is unavailable.
 */

import type { Alert } from '../types/alert';

const now = Date.now();
const h = (hours: number) => new Date(now - hours * 3600_000).toISOString();
const m = (mins: number) => new Date(now - mins * 60_000).toISOString();

export const mockAlerts: Alert[] = [
  {
    id: 1,
    external_alert_id: 'mock-001',
    timestamp: m(12),
    severity: 14,
    rule_id: '5710',
    rule_description: 'Multiple SSH authentication failures',
    agent_name: 'linux-prod-01',
    source_ip: '10.0.3.47',
    destination_ip: '10.0.1.5',
    username: 'root',
    status: 'open',
    created_at: m(12),
  },
  {
    id: 2,
    external_alert_id: 'mock-002',
    timestamp: m(34),
    severity: 12,
    rule_id: '100001',
    rule_description: 'Suspicious binary execution detected',
    agent_name: 'win-desktop-03',
    source_ip: '192.168.1.20',
    username: 'admin',
    status: 'investigating',
    created_at: m(34),
  },
  {
    id: 3,
    external_alert_id: 'mock-003',
    timestamp: h(1),
    severity: 10,
    rule_id: '5501',
    rule_description: 'Privilege escalation attempt',
    agent_name: 'linux-lab',
    source_ip: '172.16.0.12',
    destination_ip: '172.16.0.1',
    username: 'developer',
    status: 'open',
    created_at: h(1),
  },
  {
    id: 4,
    external_alert_id: 'mock-004',
    timestamp: h(2),
    severity: 8,
    rule_id: '5402',
    rule_description: 'Firewall rule modification detected',
    agent_name: 'fw-edge-01',
    source_ip: '10.0.0.1',
    username: 'sysadmin',
    status: 'open',
    created_at: h(2),
  },
  {
    id: 5,
    external_alert_id: 'mock-005',
    timestamp: h(3),
    severity: 6,
    rule_id: '18104',
    rule_description: 'Windows audit policy changed',
    agent_name: 'win-srv-dc01',
    destination_ip: '10.0.1.10',
    username: 'SYSTEM',
    status: 'resolved',
    created_at: h(3),
  },
  {
    id: 6,
    external_alert_id: 'mock-006',
    timestamp: h(4),
    severity: 4,
    rule_id: '5104',
    rule_description: 'New user account created',
    agent_name: 'linux-prod-02',
    username: 'svc-deploy',
    status: 'resolved',
    created_at: h(4),
  },
  {
    id: 7,
    external_alert_id: 'mock-007',
    timestamp: h(6),
    severity: 10,
    rule_id: '100210',
    rule_description: 'Outbound connection to known C2 indicator',
    agent_name: 'win-desktop-07',
    source_ip: '192.168.1.55',
    destination_ip: '45.33.32.156',
    username: 'j.smith',
    status: 'open',
    created_at: h(6),
  },
  {
    id: 8,
    external_alert_id: 'mock-008',
    timestamp: h(8),
    severity: 3,
    rule_id: '5302',
    rule_description: 'User login after business hours',
    agent_name: 'linux-prod-01',
    source_ip: '10.0.3.22',
    username: 'ops-team',
    status: 'dismissed',
    created_at: h(8),
  },
];

/** Flag indicating this data is mock / development data */
export const MOCK_DATA_LABEL = 'MOCK / DEVELOPMENT DATA';
