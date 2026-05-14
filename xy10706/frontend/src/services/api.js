import axios from 'axios';

const api = axios.create({
  baseURL: '/api/quota',
  timeout: 10000,
});

export const quotaApi = {
  processCall: (data) => api.post('/call', data),
  retryCall: (data) => api.post('/retry', data),
  reviewCall: (data) => api.post('/review', data),
  recalculateRecords: (data) => api.post('/recalculate', data),
  getStatistics: (params) => api.get('/statistics', { params }),
  exportBilling: (params) => api.get('/billing/export', { params }),
  getDailyTrend: (params) => api.get('/trend/daily', { params }),

  getCustomers: () => api.get('/customers'),
  createCustomer: (data) => api.post('/customers', data),
  getCustomerPackages: (customerId) => api.get(`/customers/${customerId}/packages`),
  assignPackage: (data) => api.post('/customer-packages', data),

  getPackages: () => api.get('/packages'),
  createPackage: (data) => api.post('/packages', data),

  getEndpoints: () => api.get('/endpoints'),
  createEndpoint: (data) => api.post('/endpoints', data),

  getCallRecords: (params) => api.get('/calls', { params }),
  getCallRecord: (id) => api.get(`/calls/${id}`),

  getReviewRecords: (params) => api.get('/reviews', { params }),
};

export default api;
