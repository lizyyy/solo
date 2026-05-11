import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export const contractsAPI = {
  getAll: () => api.get('/contracts'),
  getById: (id) => api.get(`/contracts/${id}`),
  create: (data) => api.post('/contracts', data),
  update: (id, data) => api.put(`/contracts/${id}`, data),
  delete: (id) => api.delete(`/contracts/${id}`)
};

export const workOrdersAPI = {
  getAll: (params = {}) => api.get('/workorders', { params }),
  getById: (id) => api.get(`/workorders/${id}`),
  create: (data) => api.post('/workorders', data),
  respond: (id, data = {}) => api.post(`/workorders/${id}/respond`, data),
  pause: (id, data) => api.post(`/workorders/${id}/pause`, data),
  resume: (id, data = {}) => api.post(`/workorders/${id}/resume`, data),
  repair: (id, data = {}) => api.post(`/workorders/${id}/repair`, data),
  close: (id, data = {}) => api.post(`/workorders/${id}/close`, data),
  getTimeline: (id) => api.get(`/workorders/${id}/timeline`)
};

export const exemptionsAPI = {
  getAll: (params = {}) => api.get('/exemptions', { params }),
  create: (data) => api.post('/exemptions', data),
  approve: (id, data = {}) => api.post(`/exemptions/${id}/approve`, data),
  reject: (id, data = {}) => api.post(`/exemptions/${id}/reject`, data)
};

export const settlementsAPI = {
  getAll: (params = {}) => api.get('/settlements', { params }),
  getPreview: (month, year) => api.get('/settlements/preview', { params: { month, year } }),
  create: (data) => api.post('/settlements', data),
  submit: (id, data = {}) => api.post(`/settlements/${id}/submit`, data),
  getWorkOrders: (id) => api.get(`/settlements/${id}/workorders`),
  export: (id) => api.get(`/settlements/${id}/export`)
};

export default api;
