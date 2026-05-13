import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export const orderApi = {
  getAll: (params) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  delete: (id) => api.delete(`/orders/${id}`),
  export: (params) => window.open(`/api/reports/orders/export?${new URLSearchParams(params)}`)
};

export const deliveryApi = {
  getAll: (params) => api.get('/deliveries', { params }),
  getById: (id) => api.get(`/deliveries/${id}`),
  create: (data) => api.post('/deliveries', data),
  update: (id, data) => api.put(`/deliveries/${id}`, data),
  getReturnCheck: (deliveryId) => api.get(`/deliveries/${deliveryId}/return-check`)
};

export const inspectionApi = {
  getAll: (params) => api.get('/inspections', { params }),
  getById: (id) => api.get(`/inspections/${id}`),
  create: (data) => api.post('/inspections', data),
  update: (id, data) => api.put(`/inspections/${id}`, data),
  submit: (id, operator) => api.post(`/inspections/${id}/submit`, { operator }),
  processReturn: (id, operator) => api.post(`/inspections/${id}/return`, { operator }),
  export: (params) => window.open(`/api/reports/inspections/export?${new URLSearchParams(params)}`)
};

export const paymentApi = {
  verify: (data) => api.post('/payment/verify', data)
};

export const dashboardApi = {
  getData: () => api.get('/dashboard')
};

export const flowApi = {
  getByOrderId: (orderId) => api.get(`/flow-records/${orderId}`)
};

export const auditApi = {
  getLogs: (params) => api.get('/audit-logs', { params }),
  getByEntity: (entityType, entityId) => api.get(`/audit-logs/${entityType}/${entityId}`)
};

export default api;
