import axios from 'axios';
import { ReconciliationBatch, Discrepancy, ProcessingHistory, BatchStatistics, DiscrepancyStatistics, ReconciliationStatus } from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const batchApi = {
  list: (params?: { status?: ReconciliationStatus; channel?: string }) =>
    api.get<ReconciliationBatch[]>('/batches', { params }),
  
  get: (id: number) =>
    api.get<ReconciliationBatch>(`/batches/${id}`),
  
  create: (data: { batch_no: string; channel: string; reconciliation_date: string }) =>
    api.post<ReconciliationBatch>('/batches', data),
  
  reconcile: (id: number) =>
    api.post(`/batches/${id}/reconcile`),
  
  generateMock: (params: {
    batch_no?: string;
    channel?: string;
    channel_count?: number;
    internal_count?: number;
    discrepancy_rate?: number;
  }) => api.post('/batches/generate-mock', null, { params }),
  
  export: (id: number) =>
    api.get(`/batches/${id}/export`, { responseType: 'blob' }),
};

export const discrepancyApi = {
  list: (params?: { status?: ReconciliationStatus; batch_id?: number }) =>
    api.get<Discrepancy[]>('/discrepancies', { params }),
  
  get: (id: number) =>
    api.get<Discrepancy>(`/discrepancies/${id}`),
  
  resolve: (id: number, data: { resolved_note: string; operator?: string }) =>
    api.post<Discrepancy>(`/discrepancies/${id}/resolve`, data),
};

export const historyApi = {
  list: (params?: { batch_id?: number; discrepancy_id?: number }) =>
    api.get<ProcessingHistory[]>('/history', { params }),
};

export const statisticsApi = {
  batches: () => api.get<BatchStatistics>('/statistics/batches'),
  discrepancies: () => api.get<DiscrepancyStatistics>('/statistics/discrepancies'),
};

export default api;
