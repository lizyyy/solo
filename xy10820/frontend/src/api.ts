import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const suppliersAPI = {
  list: () => api.get('/suppliers'),
  get: (id: number) => api.get(`/suppliers/${id}`),
  create: (data: any) => api.post('/suppliers', data),
  update: (id: number, data: any) => api.put(`/suppliers/${id}`, data),
};

export const productsAPI = {
  listBySupplier: (supplierId: number, params?: any) => api.get(`/products/supplier/${supplierId}`, { params }),
  get: (id: number) => api.get(`/products/${id}`),
};

export const catalogAPI = {
  list: () => api.get('/catalog'),
  get: (id: number) => api.get(`/catalog/${id}`),
  create: (data: any) => api.post('/catalog', data),
};

export const mappingsAPI = {
  list: () => api.get('/mappings'),
  get: (id: number) => api.get(`/mappings/${id}`),
  create: (data: any) => api.post('/mappings', data),
  update: (id: number, data: any) => api.put(`/mappings/${id}`, data),
  getTimeline: (id: number) => api.get(`/mappings/${id}/timeline`),
  listRules: () => api.get('/mappings/rules'),
  createRule: (data: any) => api.post('/mappings/rules', data),
};

export const syncAPI = {
  import: (data: any) => api.post('/sync/import', data),
  listBatches: () => api.get('/sync/batches'),
  getBatch: (batchId: string) => api.get(`/sync/batches/${batchId}`),
  getBatchConflicts: (batchId: string) => api.get(`/sync/batches/${batchId}/conflicts`),
  listConflicts: (status?: string) => api.get('/sync/conflicts', { params: { status } }),
  resolveConflict: (id: number, data: any) => api.put(`/sync/conflicts/${id}/resolve`, data),
  listPending: (status?: string) => api.get('/sync/pending', { params: { status } }),
  confirmPending: (id: number, data: any) => api.put(`/sync/pending/${id}/confirm`, data),
  generateReport: (data: any) => api.post('/sync/report', data),
  exportReport: (data: any) => api.post('/sync/report/export', data, { responseType: 'blob' }),
};

export default api;
