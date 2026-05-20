import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const vulnerabilityApi = {
  getAll: (params = {}) => api.get('/vulnerabilities', { params }),
  getById: (id) => api.get(`/vulnerabilities/${id}`),
  create: (data) => api.post('/vulnerabilities', data),
  analyze: (id, operator) => api.post(`/vulnerabilities/${id}/analyze`, { operator }),
  exempt: (id, reason, operator) => api.post(`/vulnerabilities/${id}/exempt`, { reason, operator }),
  startFix: (id, fixBatch, operator) => api.post(`/vulnerabilities/${id}/fix`, { fixBatch, operator }),
  verify: (id, verifier, result, comment) => api.post(`/vulnerabilities/${id}/verify`, { verifier, result, comment }),
  close: (id, operator) => api.post(`/vulnerabilities/${id}/close`, { operator }),
  merge: (targetId, sourceIds, operator) => api.post('/vulnerabilities/merge', { targetId, sourceIds, operator }),
  getAuditLogs: (id) => api.get(`/vulnerabilities/${id}/audit-logs`),
  getVerifications: (id) => api.get(`/vulnerabilities/${id}/verifications`),
  export: (format = 'csv', filters = {}) => api.post('/vulnerabilities/export', { format, filters })
};

export const auditApi = {
  getAll: () => api.get('/audit-logs')
};

export default api;
