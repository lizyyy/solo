import axios from 'axios';
import type { Tenant, ExportTask, TaskResponse, CreateTaskRequest, ExportStatus, ExportCertificateType } from './types';

const api = axios.create({
  baseURL: '/api/export',
  headers: { 'Content-Type': 'application/json' }
});

export const apiClient = {
  getTenants: async (): Promise<Tenant[]> => {
    const res = await api.get('/tenants');
    return res.data.data;
  },

  getTasks: async (tenantId?: string, status?: ExportStatus): Promise<ExportTask[]> => {
    const params: Record<string, string> = {};
    if (tenantId) params.tenantId = tenantId;
    if (status) params.status = status;
    const res = await api.get('/tasks', { params });
    return res.data.data;
  },

  getTaskDetail: async (taskId: string): Promise<TaskResponse> => {
    const res = await api.get(`/tasks/${taskId}`);
    return res.data.data;
  },

  createTask: async (data: CreateTaskRequest): Promise<TaskResponse> => {
    const res = await api.post('/tasks', data);
    return res.data.data;
  },

  retryTask: async (taskId: string): Promise<TaskResponse> => {
    const res = await api.post(`/tasks/${taskId}/retry`);
    return res.data.data;
  },

  getDownloadToken: async (taskId: string): Promise<{ token: string; expiresAt: number }> => {
    const res = await api.post(`/tasks/${taskId}/download-token`, { userId: 'admin' });
    return res.data.data;
  },

  downloadFile: (token: string): void => {
    window.open(`/api/export/download/${token}`, '_blank');
  },

  getCertificate: async (taskId: string): Promise<ExportCertificateType> => {
    const res = await api.get(`/tasks/${taskId}/certificate`);
    return res.data.data;
  }
};
