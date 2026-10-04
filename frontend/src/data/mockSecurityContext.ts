/**
 * AI SOC Assistant — Mock Security Context Data
 *
 * ⚠ DEVELOPMENT DATA — Clearly marked mock context.
 * Used when backend context extraction pipeline has not yet returned live enrichment.
 */

import type { SecurityContext } from '../types/alert';

export const mockSecurityContexts: Record<number, SecurityContext> = {
  1: {
    network: {
      source_ip: '10.0.3.47',
      destination_ip: '10.0.1.5',
      protocol: 'TCP',
      port: 22,
      connection_info: 'Repeated inbound TCP SYN packets to port 22 (SSH)',
    },
    identity: {
      username: 'root',
      agent_name: 'linux-prod-01',
      hostname: 'prod-bastion-01.infra.corp',
    },
    execution: {
      process: '/usr/sbin/sshd',
      command: 'sshd: root [net]',
      parent_process: 'systemd (PID 1)',
    },
    detection: {
      rule_id: '5710',
      rule_description: 'Multiple SSH authentication failures',
      decoder: 'sshd',
      severity: 14,
    },
    intelligence: {
      mitre_techniques: ['T1110.001 - Password Guessing', 'T1078 - Valid Accounts'],
      cve_ids: ['CVE-2024-6387 (RegreSSHion review)'],
      reputation: 'Internal subnet / suspicious automated credential stuffing',
      threat_intel: 'Matched known dictionary attack patterns from internal staging host',
    },
  },
  2: {
    network: {
      source_ip: '192.168.1.20',
      destination_ip: '198.51.100.42',
      protocol: 'HTTPS / TCP',
      port: 443,
      connection_info: 'Outbound beaconing interval 60s',
    },
    identity: {
      username: 'admin',
      agent_name: 'win-desktop-03',
      hostname: 'DESKTOP-FINANCE-03',
    },
    execution: {
      process: 'powershell.exe -enc SQBFAFgA...',
      command: 'powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -enc SQBFAFgA...',
      parent_process: 'excel.exe (PID 4820)',
    },
    detection: {
      rule_id: '100001',
      rule_description: 'Suspicious binary execution detected',
      decoder: 'sysmon_event1',
      severity: 12,
    },
    intelligence: {
      mitre_techniques: ['T1059.001 - PowerShell', 'T1204.002 - Malicious File'],
      cve_ids: [],
      reputation: 'External C2 IP flagged in staging threat feed',
      threat_intel: 'Suspicious macro-spawned PowerShell execution',
    },
  },
};

export const getSecurityContextForAlert = (alertId: number): SecurityContext => {
  return (
    mockSecurityContexts[alertId] || {
      network: {
        source_ip: '10.0.1.' + ((alertId * 17) % 250),
        destination_ip: '10.0.2.1',
        protocol: 'TCP',
        port: 443,
        connection_info: 'Standard TLS session',
      },
      identity: {
        username: 'analyst-dev',
        agent_name: `agent-${alertId}`,
        hostname: `host-${alertId}.corp.internal`,
      },
      execution: {
        process: 'system-agent',
        command: 'standard-service-invocation',
        parent_process: 'init',
      },
      detection: {
        rule_id: `RULE-${alertId}`,
        rule_description: 'Telemetry anomaly threshold exceeded',
        decoder: 'generic_decoder',
        severity: 8,
      },
      intelligence: {
        mitre_techniques: ['T1059 - Command and Scripting Interpreter'],
        cve_ids: [],
        reputation: 'Internal monitored node',
        threat_intel: 'Development baseline mock context',
      },
    }
  );
};
