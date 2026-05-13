import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export const consignorAPI = {
  getAll: (params) => api.get('/consignors', { params }),
  getById: (id) => api.get(`/consignors/${id}`),
  create: (data) => api.post('/consignors', data),
  update: (id, data) => api.put(`/consignors/${id}`, data),
  batchImport: (data) => api.post('/consignors/batch', data)
};

export const bookAPI = {
  getAll: (params) => api.get('/books', { params }),
  getById: (id) => api.get(`/books/${id}`),
  create: (data) => api.post('/books', data),
  evaluate: (data) => api.post('/books/evaluate', data),
  requestPriceReduction: (data) => api.post('/books/price-reduction', data),
  approvePriceReduction: (data) => api.post('/books/price-reduction/approve', data),
  markForSale: (data) => api.post('/books/for-sale', data)
};

export const saleAPI = {
  getAll: (params) => api.get('/sales', { params }),
  create: (data) => api.post('/sales', data),
  handleException: (data) => api.post('/sales/exception', data),
  createReturn: (data) => api.post('/returns', data),
  inspectReturn: (data) => api.post('/returns/inspect', data)
};

export const settlementAPI = {
  getAll: (params) => api.get('/settlements', { params }),
  getById: (id) => api.get(`/settlements/${id}`),
  generate: (data) => api.post('/settlements', data),
  markPaid: (id, data) => api.post(`/settlements/${id}/paid`, data),
  export: (id) => window.open(`/api/settlements/${id}/export`, '_blank')
};

export default api;
