import axios from 'axios';
import { SyncBatch, SyncRow, Stats, ApiMapping, CsvTemplate, SyncStatus } from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const syncApi = {
  getTemplates: (): Promise<CsvTemplate[]> =>
    api.get('/templates').then(r => r.data),

  getMappings: (): Promise<ApiMapping[]> =>
    api.get('/mappings').then(r => r.data),

  getBatches: (params?: {
    page?: number;
    pageSize?: number;
    status?: SyncStatus;
    mappingId?: string;
  }): Promise<{ batches: SyncBatch[]; total: number }> =>
    api.get('/batches', { params }).then(r => r.data),

  getBatch: (id: string): Promise<SyncBatch> =>
    api.get(`/batches/${id}`).then(r => r.data),

  getBatchRows: (id: string): Promise<SyncRow[]> =>
    api.get(`/batches/${id}/rows`).then(r => r.data),

  createBatch: (mappingId: string, file: File): Promise<SyncBatch> => {
    const formData = new FormData();
    formData.append('mappingId', mappingId);
    formData.append('csv', file);
    return api.post('/batches', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  validateBatch: (id: string): Promise<SyncBatch> =>
    api.post(`/batches/${id}/validate`).then(r => r.data),

  processBatch: (id: string): Promise<SyncBatch> =>
    api.post(`/batches/${id}/process`).then(r => r.data),

  retryBatch: (id: string, rowIds?: string[]): Promise<SyncBatch> =>
    api.post(`/batches/${id}/retry`, { rowIds }).then(r => r.data),

  getReport: (id: string) =>
    api.get(`/batches/${id}/report`).then(r => r.data),

  exportReport: (id: string) => {
    window.open(`/api/batches/${id}/export`, '_blank');
  },

  getStats: (): Promise<Stats> =>
    api.get('/stats').then(r => r.data),
};
