import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export const statsAPI = {
  getStats: () => api.get('/stats')
};

export const inventoryAPI = {
  getAll: (params) => api.get('/inventory', { params }),
  getById: (id) => api.get(`/inventory/${id}`),
  getHistory: (id) => api.get(`/inventory/${id}/history`),
  create: (data) => api.post('/inventory', data),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  delete: (id) => api.delete(`/inventory/${id}`)
};

export const plansAPI = {
  getAll: (params) => api.get('/plans', { params }),
  getById: (id) => api.get(`/plans/${id}`),
  getHistory: (id) => api.get(`/plans/${id}/history`),
  create: (data) => api.post('/plans', data),
  update: (id, data) => api.put(`/plans/${id}`, data),
  delete: (id) => api.delete(`/plans/${id}`)
};

export const customersAPI = {
  getAll: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  getHistory: (id) => api.get(`/customers/${id}/history`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`)
};

export const claimsAPI = {
  getAll: (params) => api.get('/claims', { params }),
  getById: (id) => api.get(`/claims/${id}`),
  create: (data) => api.post('/claims', data),
  update: (id, data) => api.put(`/claims/${id}`, data),
  delete: (id) => api.delete(`/claims/${id}`)
};

export const expressAPI = {
  getAll: (params) => api.get('/express', { params }),
  getById: (id) => api.get(`/express/${id}`),
  create: (data) => api.post('/express', data),
  update: (id, data) => api.put(`/express/${id}`, data),
  delete: (id) => api.delete(`/express/${id}`)
};

export const returnsAPI = {
  getAll: (params) => api.get('/returns', { params }),
  getById: (id) => api.get(`/returns/${id}`),
  create: (data) => api.post('/returns', data),
  update: (id, data) => api.put(`/returns/${id}`, data),
  delete: (id) => api.delete(`/returns/${id}`)
};

export const exceptionsAPI = {
  getAll: (params) => api.get('/exceptions', { params }),
  getById: (id) => api.get(`/exceptions/${id}`),
  create: (data) => api.post('/exceptions', data),
  update: (id, data) => api.put(`/exceptions/${id}`, data),
  delete: (id) => api.delete(`/exceptions/${id}`)
};

export const reportsAPI = {
  export: (params) => api.get('/reports/export', { params }),
  getSummary: () => api.get('/reports/summary')
};

export default api;
