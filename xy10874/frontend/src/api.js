import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export const pluginAPI = {
  create: (data) => api.post('/plugins', data),
  list: (params) => api.get('/plugins', { params }),
  get: (id) => api.get(`/plugins/${id}`),
  addPermission: (id, data) => api.post(`/plugins/${id}/permissions`, data),
  addScreenshot: (id, data) => api.post(`/plugins/${id}/screenshots`, data),
  addCompatibleVersion: (id, data) => api.post(`/plugins/${id}/compatible-versions`, data),
  deleteCompatibleVersion: (pluginId, versionId) => api.delete(`/plugins/${pluginId}/compatible-versions/${versionId}`),
  updateCompatibleVersion: (pluginId, versionId, data) => api.put(`/plugins/${pluginId}/compatible-versions/${versionId}`, data),
  validate: (id) => api.post(`/plugins/${id}/validate`),
  submit: (id, data) => api.post(`/plugins/${id}/submit`, data),
  approve: (id, data) => api.post(`/plugins/${id}/approve`, data),
  reject: (id, data) => api.post(`/plugins/${id}/reject`, data),
  release: (id, data) => api.post(`/plugins/${id}/release`, data),
  rollback: (id, data) => api.post(`/plugins/${id}/rollback`, data),
  exportCSV: () => api.get('/plugins/export/csv', { responseType: 'blob' }),
};

export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
};

export const auditAPI = {
  list: (params) => api.get('/audit-records', { params }),
};

export default api;
