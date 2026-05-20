import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const vulnerabilityApi = {
  getAll: (params = {}, operator) => api.get('/vulnerabilities', { params: { ...params, operator } }),
  getById: (id, operator) => api.get(`/vulnerabilities/${id}`, { params: { operator } }),
  create: (data) => api.post('/vulnerabilities', data),
  analyze: (id, operator) => api.post(`/vulnerabilities/${id}/analyze`, { operator }),
  exempt: (id, reason, operator) => api.post(`/vulnerabilities/${id}/exempt`, { reason, operator }),
  startFix: (id, fixBatch, operator) => api.post(`/vulnerabilities/${id}/fix`, { fixBatch, operator }),
  verify: (id, verifier, result, comment) => api.post(`/vulnerabilities/${id}/verify`, { verifier, result, comment }),
  close: (id, operator) => api.post(`/vulnerabilities/${id}/close`, { operator }),
  merge: (targetId, sourceIds, operator) => api.post('/vulnerabilities/merge', { targetId, sourceIds, operator }),
  getAuditLogs: (id) => api.get(`/vulnerabilities/${id}/audit-logs`),
  getVerifications: (id) => api.get(`/vulnerabilities/${id}/verifications`),
  export: (format = 'csv', filters = {}, operator, includeDetails = false) => 
    api.post('/vulnerabilities/export', { format, filters, operator, includeDetails })
};

export const auditApi = {
  getAll: () => api.get('/audit-logs')
};

export default api;
