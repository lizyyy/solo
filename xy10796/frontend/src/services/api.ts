import axios from 'axios';
import { Environment, DatasetVersion, SeedTask, CleanupStrategy, DashboardStats, TaskTrend, RollbackRecord, SeedRecord } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/dashboard/stats').then(res => res.data),
  getTrend: (days?: number) => api.get<TaskTrend[]>('/dashboard/trend', { params: { days } }).then(res => res.data),
};

export const environmentApi = {
  getAll: () => api.get<{ environments: Environment[] }>('/environments').then(res => res.data.environments),
  create: (data: Partial<Environment>) => api.post('/environments', data),
  update: (id: string, data: Partial<Environment>) => api.put(`/environments/${id}`, data),
  delete: (id: string) => api.delete(`/environments/${id}`),
};

export const datasetApi = {
  getAll: () => api.get<{ datasets: Dataset[] }>('/datasets').then(res => res.data.datasets),
  create: (data: Partial<Dataset>) => api.post('/datasets', data),
  update: (id: string, data: Partial<Dataset>) => api.put(`/datasets/${id}`, data),
  publish: (id: string) => api.post(`/datasets/${id}/publish`),
  delete: (id: string) => api.delete(`/datasets/${id}`),
};

export const taskApi = {
  getAll: (params?: any) => api.get<{ tasks: SeedTask[]; total: number }>('/tasks', { params }).then(res => res.data),
  getById: (id: string) => api.get<{ task: SeedTask; records: SeedRecord[]; rollbacks: RollbackRecord[] }>(`/tasks/${id}`).then(res => res.data),
  create: (data: { environmentId: string; datasetVersionId: string; requestId?: string }) => api.post('/tasks', data),
  retry: (id: string) => api.post(`/tasks/${id}/retry`),
  rollback: (id: string, reason: string) => api.post(`/tasks/${id}/rollback`, { reason }),
  export: (id: string) => api.get(`/tasks/${id}/export`, { responseType: 'blob' }),
};

export const rollbackApi = {
  review: (rollbackId: string, data: { reviewedBy: string; reviewComment: string }) => api.post(`/rollbacks/${rollbackId}/review`, data),
};

export const cleanupApi = {
  getAll: () => api.get<{ strategies: CleanupStrategy[] }>('/cleanup').then(res => res.data.strategies),
  getById: (id: string) => api.get<{ strategy: CleanupStrategy }>(`/cleanup/${id}`).then(res => res.data.strategy),
  create: (data: Partial<CleanupStrategy>) => api.post('/cleanup', data),
  execute: (id: string) => api.post(`/cleanup/${id}/execute`),
  updateCorrection: (id: string, correctionPath: string) => api.put(`/cleanup/${id}/correction`, { correctionPath }),
  markFailed: (id: string, errorMessage: string) => api.post(`/cleanup/${id}/fail`, { errorMessage }),
  delete: (id: string) => api.delete(`/cleanup/${id}`),
};

export default api;
