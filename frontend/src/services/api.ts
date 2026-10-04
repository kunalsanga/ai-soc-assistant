/**
 * AI SOC Assistant — API Client
 *
 * Central API client for communicating with the backend.
 * Architecture: Component → Hook → Service → API Client → Backend API
 *
 * The frontend NEVER contacts Wazuh / AI / Database directly.
 * All communication flows through our backend API.
 */

import axios from 'axios';
import type { Alert, Analysis } from '../types/alert';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

/* ── Alert endpoints ── */

export const alertService = {
  /** GET /alerts — list all alerts */
  getAlerts: async (): Promise<Alert[]> => {
    const response = await apiClient.get('/alerts');
    return response.data;
  },

  /** GET /alerts/:id — single alert */
  getAlert: async (id: string | number): Promise<Alert> => {
    const response = await apiClient.get(`/alerts/${id}`);
    return response.data;
  },

  /** POST /alerts/:id/analyze — trigger AI analysis */
  analyzeAlert: async (id: string | number): Promise<Analysis> => {
    const response = await apiClient.post(`/alerts/${id}/analyze`);
    return response.data;
  },

  /** GET /alerts/:id/analysis — retrieve latest analysis */
  getAnalysis: async (id: string | number): Promise<Analysis> => {
    const response = await apiClient.get(`/alerts/${id}/analysis`);
    return response.data;
  },

  /** POST /alerts/sync — sync from Wazuh */
  syncAlerts: async (): Promise<{ synced: number; skipped: number }> => {
    const response = await apiClient.post('/alerts/sync');
    return response.data;
  },
};

/* ── Health endpoint ── */

export const healthService = {
  check: async (): Promise<{ status: string }> => {
    const response = await apiClient.get('/health');
    return response.data;
  },
};
