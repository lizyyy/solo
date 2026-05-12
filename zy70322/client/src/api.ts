import axios from 'axios';
import type { Batch, BatchDetail, Tenant, TenantDetail } from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const batchApi = {
  getAll: () => api.get<Batch[]>('/batches'),
  create: (data: { name: string; description?: string }) => api.post<Batch>('/batches', data),
  getById: (id: string) => api.get<BatchDetail>(`/batches/${id}`),
  close: (id: string) => api.post(`/batches/${id}/close`),
  getReport: (id: string) => api.get(`/batches/${id}/report`)
};

export const tenantApi = {
  addToBatch: (batchId: string, data: { tenantId: string; tenantName: string }) => 
    api.post<Tenant>(`/batches/${batchId}/tenants`, data),
  getById: (id: string) => api.get<TenantDetail>(`/tenants/${id}`),
  importSnapshot: (tenantId: string, data: { environment: 'old' | 'new'; data: any }) =>
    api.post(`/tenants/${tenantId}/snapshots`, data),
  validate: (tenantId: string) => api.post(`/tenants/${tenantId}/validate`)
};

export const diffApi = {
  confirm: (diffId: string, data: { status: string; conclusion?: string }) =>
    api.post(`/diffs/${diffId}/confirm`, data),
  retry: (diffId: string) => api.post(`/diffs/${diffId}/retry`)
};

export const taskApi = {
  freeze: (taskId: string) => api.post(`/tasks/${taskId}/freeze`),
  unfreeze: (taskId: string) => api.post(`/tasks/${taskId}/unfreeze`)
};

export const callbackApi = {
  switch: (callbackId: string) => api.post(`/callbacks/${callbackId}/switch`)
};

export default api;
