import axios from 'axios';

const api = axios.create({
  baseURL: '/api/invoices',
  headers: { 'Content-Type': 'application/json' }
});

export const invoiceAPI = {
  create: (data) => api.post('/', data),
  getById: (id) => api.get(`/${id}`),
  getByRequestId: (requestId) => api.get(`/request/${requestId}`),
  query: (params) => api.get('/', { params }),
  callback: (requestId, data) => api.post(`/callback/${requestId}`, data),
  checkTimeout: () => api.post('/check-timeout'),
  compensate: (id, data) => api.post(`/${id}/compensate`, data),
  review: (id, data) => api.post(`/${id}/review`, data),
  redFlush: (data) => api.post('/red-flush', data),
  getDownload: (id) => api.get(`/${id}/download`),
  exportCSV: (params) => axios.get('/api/invoices/export/csv', { params, responseType: 'blob' }),
  batchImport: (invoices) => api.post('/batch/import', { invoices })
};

export default api;
