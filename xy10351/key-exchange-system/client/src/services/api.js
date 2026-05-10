import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const keyApi = {
  getAll: () => api.get('/keys'),
  getById: (id) => api.get(`/keys/${id}`),
  create: (data) => api.post('/keys', data),
  update: (id, data) => api.put(`/keys/${id}`, data),
  pickup: (id, data) => api.post(`/keys/${id}/pickup`, data),
  return: (id, data) => api.post(`/keys/${id}/return`, data),
  getHistory: (id) => api.get(`/keys/${id}/history`),
  getOverdue: () => api.get('/keys/status/overdue'),
};

export const orderApi = {
  getAll: () => api.get('/orders'),
  getById: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  getAvailable: () => api.get('/orders/available/list'),
  getByCleaner: (name) => api.get(`/orders/cleaner/${name}`),
};

export const auditApi = {
  getLogs: (params) => api.get('/audit/logs', { params }),
  getHistory: (params) => api.get('/audit/history', { params }),
  exportReport: (format, params) => api.get('/audit/export', { 
    params: { format, ...params },
    responseType: 'blob' 
  }),
  getKeyTimeline: (keyId) => api.get(`/audit/key-timeline/${keyId}`),
  getDiff: (entityType, entityId) => api.get(`/audit/diff/${entityType}/${entityId}`),
  cancelRecord: (recordId, data) => api.post(`/audit/record/${recordId}/cancel`, data),
  modifyRecord: (recordId, data) => api.post(`/audit/record/${recordId}/modify`, data),
};

export default api;
