import axios from 'axios';
import { Alert, Analysis } from '../types/alert';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const alertService = {
  getAlerts: async (): Promise<Alert[]> => {
    const response = await apiClient.get('/alerts');
    return response.data;
  },
  getAlert: async (id: string): Promise<Alert> => {
    const response = await apiClient.get(`/alerts/${id}`);
    return response.data;
  },
  analyzeAlert: async (id: string): Promise<Analysis> => {
    const response = await apiClient.post(`/alerts/${id}/analyze`);
    return response.data;
  }
};
