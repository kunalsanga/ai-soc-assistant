/**
 * AI SOC Assistant — Core Type Definitions
 *
 * Aligned with backend schemas (backend/app/schemas/alert.py).
 * Frontend-only additions are clearly marked.
 */

/* ============================================================
   ALERT
   ============================================================ */

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Alert {
  id: number;
  external_alert_id: string;
  timestamp: string;
  severity: number;
  rule_id: string;
  rule_description: string;
  agent_name: string;
  source_ip?: string;
  destination_ip?: string;
  username?: string;
  raw_data?: string;
  status: string;
  created_at: string;
  data_origin?: 'synthetic_demo' | 'wazuh_mock' | 'live_wazuh' | string;
  dataset_version?: string;
  scenario_id?: string;
  scenario_title?: string;
}

/** Frontend helper: map numeric severity to named level */
export function getSeverityLevel(severity: number): SeverityLevel {
  if (severity >= 12) return 'critical';
  if (severity >= 8) return 'high';
  if (severity >= 5) return 'medium';
  if (severity >= 2) return 'low';
  return 'info';
}

/** Frontend helper: human label for severity */
export function getSeverityLabel(severity: number): string {
  const level = getSeverityLevel(severity);
  return level.charAt(0).toUpperCase() + level.slice(1);
}

/* ============================================================
   EVIDENCE
   ============================================================ */

export interface Evidence {
  id: number;
  analysis_id: number;
  source: string;
  document_id: string;
  title: string;
  content: string;
  relevance_score: number;
  citation: string;
}

/* ============================================================
   ANALYSIS
   ============================================================ */

export interface Analysis {
  status?: string;
  message?: string;
  id?: number;
  alert_id?: number;
  summary?: string;
  severity_assessment?: string;
  explanation?: string;
  recommended_investigation?: string;
  confidence?: string;
  model_name?: string;
  analysis_type?: string;
  created_at?: string;
  evidence?: Evidence[];
}

/* ============================================================
   SECURITY CONTEXT (Frontend-only display model)
   ============================================================ */

export interface NetworkContext {
  source_ip?: string;
  destination_ip?: string;
  protocol?: string;
  port?: number;
  connection_info?: string;
}

export interface IdentityContext {
  username?: string;
  agent_name?: string;
  hostname?: string;
}

export interface ExecutionContext {
  process?: string;
  command?: string;
  parent_process?: string;
}

export interface DetectionContext {
  rule_id?: string;
  rule_description?: string;
  decoder?: string;
  severity?: number;
}

export interface IntelligenceContext {
  mitre_techniques?: string[];
  cve_ids?: string[];
  reputation?: string;
  threat_intel?: string;
}

export interface SecurityContext {
  network: NetworkContext;
  identity: IdentityContext;
  execution: ExecutionContext;
  detection: DetectionContext;
  intelligence: IntelligenceContext;
}

/* ============================================================
   SECURITY CONTEXT (Backend shape — GET /alerts/{id}/security-context)
   Mirrors backend/app/security/schemas.py :: SecurityContext
   ============================================================ */

export interface BackendSecurityContext {
  alert_id: string;
  event_type?: string | null;
  severity: number;
  rule_id?: string | null;
  rule_description?: string | null;
  agent_name?: string | null;
  /** Structured entities extracted from the alert, e.g.
   *  { source_ip: ["192.168.1.20"], username: ["test-user"], ... } */
  entities: Record<string, string[]>;
  mitre_techniques: string[];
  mitre_tactics: string[];
  keywords: string[];
}

/* ============================================================
   SYSTEM STATUS (Frontend-only display model)
   ============================================================ */

export type SystemComponentStatus = 'operational' | 'degraded' | 'down' | 'integration_pending';

export interface SystemComponent {
  name: string;
  status: SystemComponentStatus;
  description?: string;
}
