/**
 * AI SOC Assistant — Mock Threat Intelligence Data
 *
 * ⚠ DEVELOPMENT DATA — Clearly marked mock threat intelligence.
 * Used for demonstrating MITRE ATT&CK, CVE mappings, and Indicator lookups.
 */

import type { ThreatIntelItem } from '../types/alert';

export const mockThreatIntelItems: ThreatIntelItem[] = [
  {
    id: 'T1110.001',
    type: 'mitre_technique',
    title: 'T1110.001 — Password Guessing',
    description:
      'Adversaries may iterate through common passwords or dictionaries against target network services (SSH, RDP, Web).',
    severity: 'critical',
    source: 'MITRE ATT&CK Framework Enterprise',
    last_updated: '2026-03-15',
  },
  {
    id: 'T1059.001',
    type: 'mitre_technique',
    title: 'T1059.001 — PowerShell Scripting',
    description:
      'Execution of obfuscated base64 PowerShell commands to bypass static defenses and download stage-2 implants.',
    severity: 'high',
    source: 'MITRE ATT&CK Framework Enterprise',
    last_updated: '2026-03-20',
  },
  {
    id: 'T1078',
    type: 'mitre_technique',
    title: 'T1078 — Valid Accounts',
    description:
      'Adversaries may obtain and abuse credentials of existing accounts as a means of gaining Initial Access or Persistence.',
    severity: 'high',
    source: 'MITRE ATT&CK Framework Enterprise',
    last_updated: '2026-02-28',
  },
  {
    id: 'CVE-2024-6387',
    type: 'cve',
    title: 'CVE-2024-6387 (RegreSSHion)',
    description:
      'Signal handler race condition in OpenSSH Server (sshd) on glibc-based Linux systems allowing remote code execution as root.',
    severity: 'critical',
    source: 'National Vulnerability Database (NVD)',
    last_updated: '2026-01-10',
  },
  {
    id: 'IOC-IP-45.33.32.156',
    type: 'ip_reputation',
    title: '45.33.32.156 — Known Cobalt Strike Beacon Node',
    description:
      'Observed actively hosting staging payload URIs and responding to malleable C2 profile traffic in honeypots.',
    severity: 'critical',
    source: 'Threat Feeds Aggregator (Staging)',
    last_updated: '2026-04-01',
  },
  {
    id: 'IOC-IP-198.51.100.42',
    type: 'ip_reputation',
    title: '198.51.100.42 — Suspicious Outbound Relay',
    description:
      'Uncategorized host with low reputation score displaying periodic heartbeats matching encrypted reverse shells.',
    severity: 'medium',
    source: 'Internal Telemetry Intel',
    last_updated: '2026-04-02',
  },
];
