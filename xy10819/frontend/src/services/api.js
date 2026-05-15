import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export const collections = {
  getAll: () => api.get('/collections'),
  getById: (id) => api.get(`/collections/${id}`),
  create: (data) => api.post('/collections', data),
  update: (id, data) => api.put(`/collections/${id}`, data),
  delete: (id) => api.delete(`/collections/${id}`),
};

export const steps = {
  getByCollection: (collectionId) => api.get(`/steps/collection/${collectionId}`),
  getById: (id) => api.get(`/steps/${id}`),
  create: (data) => api.post('/steps', data),
  update: (id, data) => api.put(`/steps/${id}`, data),
  delete: (id) => api.delete(`/steps/${id}`),
};

export const environments = {
  getAll: () => api.get('/environments'),
  getById: (id) => api.get(`/environments/${id}`),
  create: (data) => api.post('/environments', data),
  update: (id, data) => api.put(`/environments/${id}`, data),
  delete: (id) => api.delete(`/environments/${id}`),
};

export const batches = {
  getAll: () => api.get('/batches'),
  getByCollection: (collectionId) => api.get(`/batches/collection/${collectionId}`),
  getById: (id) => api.get(`/batches/${id}`),
  getResults: (id) => api.get(`/batches/${id}/results`),
  create: (data) => api.post('/batches', data),
  updateStatus: (id, data) => api.patch(`/batches/${id}/status`, data),
  delete: (id) => api.delete(`/batches/${id}`),
};

export const executions = {
  runCollection: (collectionId) => api.post(`/executions/collection/${collectionId}`),
  getStatus: (batchId) => api.get(`/executions/status/${batchId}`),
  retryStep: (resultId) => api.post(`/executions/retry/${resultId}`),
};

export const exports = {
  getBatchCsv: (batchId) => api.get(`/exports/batch/${batchId}/csv`),
  getBatchJson: (batchId) => api.get(`/exports/batch/${batchId}/json`),
  getSummary: (params) => api.get('/exports/summary', { params }),
};

export default api;
