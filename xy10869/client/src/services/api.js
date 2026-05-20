import axios from 'axios';

const api = axios.create({
  baseURL: '/api/migration',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const idempotencyKey = localStorage.getItem('idempotencyKey');
  if (idempotencyKey && (config.method === 'post' || config.method === 'put' || config.method === 'patch')) {
    config.headers['x-idempotency-key'] = idempotencyKey;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const generateIdempotencyKey = () => {
  const key = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  localStorage.setItem('idempotencyKey', key);
  return key;
};

export const migrationAPI = {
  getScripts: (page = 1, pageSize = 20) =>
    api.get(`/scripts?page=${page}&page_size=${pageSize}`),

  getScript: (id) =>
    api.get(`/scripts/${id}`),

  createScript: (data) =>
    api.post('/scripts', data),

  getDatabases: () =>
    api.get('/databases'),

  getDatabase: (id) =>
    api.get(`/databases/${id}`),

  createDatabase: (data) =>
    api.post('/databases', data),

  getBatches: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/batches${queryString ? `?${queryString}` : ''}`);
  },

  getBatch: (id) =>
    api.get(`/batches/${id}`),

  getBatchDetails: (id) =>
    api.get(`/batches/${id}/details`),

  createBatch: (data) =>
    api.post('/batches', data),

  updateBatchStatus: (id, status, operator, remarks) =>
    api.patch(`/batches/${id}/status`, { status, operator, remarks }),

  executeBatch: (id) =>
    api.post(`/batches/${id}/execute`),

  exportBatch: (id) =>
    api.get(`/batches/${id}/export`),

  createRollbackValidation: (batchId, data) =>
    api.post(`/batches/${batchId}/rollback-validation`, data),

  createCompensationAction: (batchId, data) =>
    api.post(`/batches/${batchId}/compensation-actions`, data),

  executeCompensation: (actionId, data) =>
    api.post(`/compensation-actions/${actionId}/execute`, data),

  getStatistics: () =>
    api.get('/statistics'),
};

export default api;
