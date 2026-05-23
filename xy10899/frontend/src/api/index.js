import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const releaseApi = {
  create: (data) => api.post('/releases', data),
  list: (status) => api.get('/releases', { params: { status } }),
  detail: (id) => api.get(`/releases/${id}`),
  updateCheckItemStatus: (releaseId, checkItemId, status, operator, result) =>
    api.put(`/releases/${releaseId}/check-items/${checkItemId}/status`, { status, operator, result }),
  updateCheckItemAssignee: (releaseId, checkItemId, assignee, operator) =>
    api.put(`/releases/${releaseId}/check-items/${checkItemId}/assignee`, { assignee, operator }),
  compensateCheckItem: (releaseId, checkItemId, reason, operator) =>
    api.post(`/releases/${releaseId}/check-items/${checkItemId}/compensate`, { reason, operator }),
  addBlock: (releaseId, data) => api.post(`/releases/${releaseId}/blocks`, data),
  resolveBlock: (blockId, resolver) => api.put(`/releases/blocks/${blockId}/resolve`, { resolver }),
  applyExemption: (releaseId, data) => api.post(`/releases/${releaseId}/exemptions`, data),
  approveExemption: (exemptionId, approver) =>
    api.put(`/releases/exemptions/${exemptionId}/approve`, { approver }),
  updateStatus: (releaseId, status, operator) =>
    api.put(`/releases/${releaseId}/status`, { status, operator }),
  export: (id) => window.open(`/api/releases/${id}/export`, '_blank'),
  exportDetail: (id) => window.open(`/api/releases/${id}/export/detail`, '_blank')
};

export default api;
