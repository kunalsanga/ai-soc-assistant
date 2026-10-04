/**
 * AI SOC Assistant — Mock Investigations Data
 *
 * ⚠ DEVELOPMENT DATA — Clearly marked mock investigation cases.
 */

import type { Investigation } from '../types/alert';
import { mockAlerts } from './mockAlerts';
import { getMockAnalysisForAlert } from './mockAnalysis';

export const mockInvestigations: Investigation[] = [
  {
    id: 'INV-2026-001',
    alert_id: 1,
    alert: mockAlerts[0],
    status: 'in_progress',
    analyst: 'Bivan (Lead SecOps)',
    created_at: new Date(Date.now() - 45 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 60000).toISOString(),
    analysis: getMockAnalysisForAlert(1),
    timeline: [
      {
        stage: 'alert_detected',
        label: 'Alert Ingestion',
        description: 'Wazuh rule 5710 fired on linux-prod-01 (Severity 14)',
        status: 'completed',
        timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
      },
      {
        stage: 'normalized',
        label: 'Alert Normalization',
        description: 'Standardized schema mapping completed with IP and User tokens',
        status: 'completed',
        timestamp: new Date(Date.now() - 44 * 60000).toISOString(),
      },
      {
        stage: 'context_extracted',
        label: 'Security Context Extracted',
        description: 'Enriched network topology, agent metadata, and host posture',
        status: 'completed',
        timestamp: new Date(Date.now() - 43 * 60000).toISOString(),
      },
      {
        stage: 'threat_intelligence',
        label: 'Threat Intel Enriched',
        description: 'Mapped to MITRE T1110.001 (Password Guessing)',
        status: 'completed',
        timestamp: new Date(Date.now() - 42 * 60000).toISOString(),
      },
      {
        stage: 'evidence_retrieved',
        label: 'Evidence Grounding',
        description: 'Retrieved 2 authoritative NIST & MITRE reference documents',
        status: 'completed',
        timestamp: new Date(Date.now() - 41 * 60000).toISOString(),
      },
      {
        stage: 'ai_analysis',
        label: 'AI Incident Analysis',
        description: 'Synthesized root cause analysis and containment recommendations',
        status: 'completed',
        timestamp: new Date(Date.now() - 40 * 60000).toISOString(),
      },
      {
        stage: 'analyst_review',
        label: 'Human-in-the-Loop Review',
        description: 'Awaiting final containment sign-off by duty analyst',
        status: 'in_progress',
        timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      },
    ],
  },
  {
    id: 'INV-2026-002',
    alert_id: 2,
    alert: mockAlerts[1],
    status: 'open',
    analyst: 'Tier-1 Automated Triage',
    created_at: new Date(Date.now() - 35 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 15 * 60000).toISOString(),
    analysis: getMockAnalysisForAlert(2),
    timeline: [
      {
        stage: 'alert_detected',
        label: 'Alert Ingestion',
        description: 'Sysmon rule 100001 fired on win-desktop-03',
        status: 'completed',
        timestamp: new Date(Date.now() - 35 * 60000).toISOString(),
      },
      {
        stage: 'normalized',
        label: 'Alert Normalization',
        description: 'Process telemetry parsed successfully',
        status: 'completed',
        timestamp: new Date(Date.now() - 34 * 60000).toISOString(),
      },
      {
        stage: 'context_extracted',
        label: 'Security Context Extracted',
        description: 'Parent process excel.exe confirmed',
        status: 'completed',
        timestamp: new Date(Date.now() - 33 * 60000).toISOString(),
      },
      {
        stage: 'threat_intelligence',
        label: 'Threat Intel Enriched',
        description: 'Matched MITRE T1059.001 (PowerShell)',
        status: 'completed',
        timestamp: new Date(Date.now() - 32 * 60000).toISOString(),
      },
      {
        stage: 'evidence_retrieved',
        label: 'Evidence Grounding',
        description: 'Playbook SOP-EP-04 linked',
        status: 'completed',
        timestamp: new Date(Date.now() - 31 * 60000).toISOString(),
      },
      {
        stage: 'ai_analysis',
        label: 'AI Incident Analysis',
        description: 'Confidence 0.91 — Recommends immediate host isolation',
        status: 'completed',
        timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
      },
      {
        stage: 'analyst_review',
        label: 'Analyst Decision',
        description: 'Pending isolation execution',
        status: 'pending',
      },
    ],
  },
];
