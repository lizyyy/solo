import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export const packagesAPI = {
  getAll: (params?: any) => api.get('/packages', { params }),
  getById: (id: number) => api.get(`/packages/${id}`),
  getHistory: (id: number) => api.get(`/packages/${id}/history`),
  create: (data: any) => api.post('/packages', data),
  update: (id: number, data: any) => api.put(`/packages/${id}`, data),
  delete: (id: number) => api.delete(`/packages/${id}`),
};

export const recoveryAPI = {
  getAll: (params?: any) => api.get('/recovery', { params }),
  getById: (id: number) => api.get(`/recovery/${id}`),
  getHistory: (id: number) => api.get(`/recovery/${id}/history`),
  create: (data: any) => api.post('/recovery', data),
  update: (id: number, data: any) => api.put(`/recovery/${id}`, data),
};

export const cleaningAPI = {
  getAll: (params?: any) => api.get('/cleaning', { params }),
  getById: (id: number) => api.get(`/cleaning/${id}`),
  getHistory: (id: number) => api.get(`/cleaning/${id}/history`),
  create: (data: any) => api.post('/cleaning', data),
  update: (id: number, data: any) => api.put(`/cleaning/${id}`, data),
};

export const sterilizationAPI = {
  getAll: (params?: any) => api.get('/sterilization', { params }),
  getById: (id: number) => api.get(`/sterilization/${id}`),
  create: (data: any) => api.post('/sterilization', data),
  update: (id: number, data: any) => api.put(`/sterilization/${id}`, data),
};

export const isolationAPI = {
  getAll: (params?: any) => api.get('/isolation', { params }),
  getById: (id: number) => api.get(`/isolation/${id}`),
  create: (data: any) => api.post('/isolation', data),
  update: (id: number, data: any) => api.put(`/isolation/${id}`, data),
};

export const distributionAPI = {
  getAll: (params?: any) => api.get('/distribution', { params }),
  getById: (id: number) => api.get(`/distribution/${id}`),
  create: (data: any) => api.post('/distribution', data),
  update: (id: number, data: any) => api.put(`/distribution/${id}`, data),
};

export const statisticsAPI = {
  getOverview: () => api.get('/statistics'),
  getAnomalies: () => api.get('/statistics/anomalies'),
  getReport: (params?: any) => api.get('/statistics/report', { params }),
  exportReport: (params?: any) => api.get('/statistics/export', { params, responseType: 'blob' }),
};

export default api;
