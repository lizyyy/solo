import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const releaseRequestApi = {
  getAll: (params?: any) => api.get('/release-requests', { params }),
  getById: (id: string) => api.get(`/release-requests/${id}`),
  create: (data: any) => api.post('/release-requests', data),
  update: (id: string, data: any) => api.put(`/release-requests/${id}`, data),
  delete: (id: string) => api.delete(`/release-requests/${id}`),
};

export const affectedServiceApi = {
  getAll: (params?: any) => api.get('/affected-services', { params }),
  getById: (id: string) => api.get(`/affected-services/${id}`),
  create: (data: any) => api.post('/affected-services', data),
  update: (id: string, data: any) => api.put(`/affected-services/${id}`, data),
  delete: (id: string) => api.delete(`/affected-services/${id}`),
};

export const approvalOpinionApi = {
  getAll: (params?: any) => api.get('/approval-opinions', { params }),
  getById: (id: string) => api.get(`/approval-opinions/${id}`),
  create: (data: any) => api.post('/approval-opinions', data),
  update: (id: string, data: any) => api.put(`/approval-opinions/${id}`, data),
  delete: (id: string) => api.delete(`/approval-opinions/${id}`),
};

export const grayBatchApi = {
  getAll: (params?: any) => api.get('/gray-batches', { params }),
  getById: (id: string) => api.get(`/gray-batches/${id}`),
  create: (data: any) => api.post('/gray-batches', data),
  update: (id: string, data: any) => api.put(`/gray-batches/${id}`, data),
  delete: (id: string) => api.delete(`/gray-batches/${id}`),
};

export const rollbackActionApi = {
  getAll: (params?: any) => api.get('/rollback-actions', { params }),
  getById: (id: string) => api.get(`/rollback-actions/${id}`),
  create: (data: any) => api.post('/rollback-actions', data),
  update: (id: string, data: any) => api.put(`/rollback-actions/${id}`, data),
  delete: (id: string) => api.delete(`/rollback-actions/${id}`),
};

export const releaseReportApi = {
  getAll: (params?: any) => api.get('/release-reports', { params }),
  getById: (id: string) => api.get(`/release-reports/${id}`),
  generate: (requestId: string, generatedBy: string) => 
    api.post(`/release-reports/generate/${requestId}`, { generatedBy }),
  export: (requestId: string) => 
    api.get(`/release-reports/export/${requestId}`, { responseType: 'blob' }),
};

export const statisticsApi = {
  getDashboard: () => api.get('/statistics/dashboard'),
};

export default api;
