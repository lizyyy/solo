import axios from 'axios';

const API_BASE_URL = process.env.NODE_ENV === 'production' ? '' : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const interfacesAPI = {
  getList: (params) => api.get('/interfaces', { params }),
  getById: (id) => api.get(`/interfaces/${id}`),
  create: (data) => api.post('/interfaces', data),
  update: (id, data) => api.put(`/interfaces/${id}`, data),
  delete: (id) => api.delete(`/interfaces/${id}`),
  batchImport: (data) => api.post('/interfaces/batch-import', data),
};

export const trafficModelsAPI = {
  getList: (params) => api.get('/traffic-models', { params }),
  getById: (id) => api.get(`/traffic-models/${id}`),
  create: (data) => api.post('/traffic-models', data),
  update: (id, data) => api.put(`/traffic-models/${id}`, data),
  delete: (id) => api.delete(`/traffic-models/${id}`),
};

export const testBatchesAPI = {
  getList: (params) => api.get('/test-batches', { params }),
  getById: (id) => api.get(`/test-batches/${id}`),
  getResults: (id) => api.get(`/test-batches/${id}/results`),
  create: (data) => api.post('/test-batches', data),
  update: (id, data) => api.put(`/test-batches/${id}`, data),
  delete: (id) => api.delete(`/test-batches/${id}`),
  setBaseline: (id) => api.post(`/test-batches/${id}/set-baseline`),
};

export const testResultsAPI = {
  getById: (id) => api.get(`/test-results/${id}`),
  create: (data) => api.post('/test-results', data),
  batchImport: (data) => api.post('/test-results/batch-import', data),
  update: (id, data) => api.put(`/test-results/${id}`, data),
  delete: (id) => api.delete(`/test-results/${id}`),
};

export const monitoringAPI = {
  getByBatch: (batchId) => api.get(`/monitoring/batch/${batchId}`),
  getStats: (batchId) => api.get(`/monitoring/batch/${batchId}/stats`),
  create: (data) => api.post('/monitoring', data),
  batchImport: (data) => api.post('/monitoring/batch-import', data),
};

export const tasksAPI = {
  getList: (params) => api.get('/tasks', { params }),
  getById: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
  complete: (id) => api.post(`/tasks/${id}/complete`),
};

export const reportsAPI = {
  getMarkdown: (batchId) => axios.get(`${API_BASE_URL}/reports/batch/${batchId}/markdown`, {
    responseType: 'blob',
  }),
  getJSON: (batchId) => axios.get(`${API_BASE_URL}/reports/batch/${batchId}/json`, {
    responseType: 'blob',
  }),
};

export const analysisAPI = {
  compare: (currentId, baselineId) => api.get(`/analysis/compare/${currentId}/${baselineId}`),
  assess: (batchId) => api.post(`/analysis/assess/${batchId}`),
  getAssessment: (batchId) => api.get(`/analysis/assess/${batchId}`),
};

export default api;
