import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export const customerApi = {
  getAll: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  getOrders: (id) => api.get(`/customers/${id}/orders`),
  getReturns: (id) => api.get(`/customers/${id}/returns`),
  getAdjustments: (id) => api.get(`/customers/${id}/adjustments`)
};

export const orderApi = {
  getAll: (params) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data)
};

export const returnApi = {
  getAll: (params) => api.get('/returns', { params }),
  getById: (id) => api.get(`/returns/${id}`),
  create: (data) => api.post('/returns', data)
};

export const adjustmentApi = {
  getAll: (params) => api.get('/adjustments', { params }),
  getById: (id) => api.get(`/adjustments/${id}`),
  create: (data) => api.post('/adjustments', data),
  approve: (id, data) => api.post(`/adjustments/${id}/approve`, data),
  reject: (id, data) => api.post(`/adjustments/${id}/reject`, data)
};

export const reportApi = {
  getStatistics: () => api.get('/reports/statistics'),
  getCreditHistory: (params) => api.get('/reports/credit-history', { params }),
  getRiskAlerts: (params) => api.get('/reports/risk-alerts', { params }),
  markAlertRead: (id) => api.post(`/reports/risk-alerts/${id}/read`),
  exportCreditHistory: (params) => {
    const queryString = new URLSearchParams(params || {}).toString();
    return `/api/reports/export/credit-history${queryString ? '?' + queryString : ''}`;
  },
  exportCustomers: () => '/api/reports/export/customers'
};

export default api;
