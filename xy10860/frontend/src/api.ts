import axios from 'axios';
import { ReleaseOrder, ReleaseOrderCreate, StatusTransition, CheckItemStatus, ReleaseTokenCreate, RollbackRecordCreate } from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const releaseOrderApi = {
  list: (params?: {
    status?: string;
    environment?: string;
    created_by?: string;
    search?: string;
  }) => api.get<ReleaseOrder[]>('/release-orders', { params }),

  get: (id: number) => api.get<ReleaseOrder>(`/release-orders/${id}`),

  create: (data: ReleaseOrderCreate) => api.post<ReleaseOrder>('/release-orders', data),

  updateStatus: (id: number, data: StatusTransition) =>
    api.post<ReleaseOrder>(`/release-orders/${id}/status`, data),

  issueToken: (id: number, data: ReleaseTokenCreate) =>
    api.post(`/release-orders/${id}/tokens`, data),

  useToken: (id: number, token: string, operator: string) =>
    api.post(`/release-orders/${id}/tokens/use`, null, {
      params: { token, operator },
    }),

  rollback: (id: number, data: RollbackRecordCreate) =>
    api.post(`/release-orders/${id}/rollback`, data),

  batchImport: (data: ReleaseOrderCreate[]) =>
    api.post('/release-orders/batch-import', data),

  export: (params?: { status?: string; environment?: string }) =>
    api.get('/release-orders/export/excel', {
      params,
      responseType: 'blob',
    }),
};

export const approvalApi = {
  approve: (id: number, comment?: string, operator?: string) =>
    api.post(`/approvals/${id}/approve`, null, {
      params: { comment, operator },
    }),

  reject: (id: number, comment?: string, operator?: string) =>
    api.post(`/approvals/${id}/reject`, null, {
      params: { comment, operator },
    }),
};

export const checkItemApi = {
  update: (id: number, status: CheckItemStatus, checked_by: string) =>
    api.put(`/check-items/${id}`, { status, checked_by }),
};
