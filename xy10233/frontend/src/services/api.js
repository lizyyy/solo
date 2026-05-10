import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'X-Operator': 'admin'
  }
});

export const tankApi = {
  getAll: () => api.get('/tanks'),
  getById: (id) => api.get(`/tanks/${id}`),
  create: (data) => api.post('/tanks', data),
  update: (id, data) => api.put(`/tanks/${id}`, data),
  delete: (id) => api.delete(`/tanks/${id}`),
  getReport: (id, days = 7) => api.get(`/tanks/${id}/report?days=${days}`)
};

export const batchApi = {
  getAll: () => api.get('/batches'),
  getById: (id) => api.get(`/batches/${id}`),
  create: (data) => api.post('/batches', data),
  update: (id, data) => api.put(`/batches/${id}`, data),
  delete: (id) => api.delete(`/batches/${id}`),
  bind: (id, tankId) => api.post(`/batches/${id}/bind`, { tank_id: tankId })
};

export const waterQualityApi = {
  getAll: (params = {}) => api.get('/water-quality', { params }),
  getById: (id) => api.get(`/water-quality/${id}`),
  create: (data) => api.post('/water-quality', data),
  bulkImport: (records) => api.post('/water-quality/bulk', { records }),
  delete: (id) => api.delete(`/water-quality/${id}`)
};

export const alertApi = {
  getAll: (params = {}) => api.get('/alerts', { params }),
  getById: (id) => api.get(`/alerts/${id}`),
  acknowledge: (id) => api.post(`/alerts/${id}/acknowledge`),
  resolve: (id, notes) => api.post(`/alerts/${id}/resolve`, { resolution_notes: notes })
};

export const deathLossApi = {
  getAll: (params = {}) => api.get('/death-loss', { params }),
  getById: (id) => api.get(`/death-loss/${id}`),
  create: (data) => api.post('/death-loss', data),
  analyze: (id) => api.get(`/death-loss/${id}/analyze`),
  attribute: (id, data) => api.post(`/death-loss/${id}/attribute`, data)
};

export const logApi = {
  getAll: (params = {}) => api.get('/logs', { params })
};

export const dashboardApi = {
  getOverview: () => api.get('/dashboard'),
  getTankSummary: () => api.get('/dashboard/overview')
};

export default api;
