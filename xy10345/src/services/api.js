import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000
});

export const propertyApi = {
  getAll: () => api.get('/properties'),
  getById: (id) => api.get(`/properties/${id}`)
};

export const orderApi = {
  getAll: (params) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  extend: (id, newCheckOut) => api.put(`/orders/${id}/extend`, { newCheckOut })
};

export const passwordApi = {
  getAll: (params) => api.get('/passwords', { params }),
  getById: (id) => api.get(`/passwords/${id}`),
  generate: (data) => api.post('/passwords/generate', data),
  revoke: (id, reason) => api.post(`/passwords/${id}/revoke`, { reason }),
  verify: (id) => api.post(`/passwords/${id}/verify`),
  getCalendar: (propertyId) => api.get(`/calendar/${propertyId}`)
};

export const anomalyApi = {
  getAll: (params) => api.get('/anomalies', { params }),
  resolve: (id, resolution) => api.put(`/anomalies/${id}/resolve`, { resolution })
};

export const auditApi = {
  getAll: (params) => api.get('/audit-logs', { params })
};

export const reportApi = {
  getPasswordStatus: (propertyId) => 
    api.get('/reports/password-status', { params: { propertyId } }),
  export: (format = 'json') => 
    api.get('/reports/export', { params: { format }, responseType: format === 'csv' ? 'blob' : 'json' })
};

export default api;
