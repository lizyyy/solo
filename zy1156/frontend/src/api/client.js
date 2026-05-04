import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const tasksApi = {
  getAll: (params = {}) => apiClient.get('/tasks', { params }),
  getById: (id) => apiClient.get(`/tasks/${id}`),
  create: (data) => apiClient.post('/tasks', data),
  update: (id, data) => apiClient.put(`/tasks/${id}`, data),
  delete: (id) => apiClient.delete(`/tasks/${id}`),
};

export const contextApi = {
  upload: (formData, onUploadProgress) => 
    apiClient.post('/context/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }),
  analyze: (data) => apiClient.post('/context/analyze', data),
  getById: (id) => apiClient.get(`/context/${id}`),
  delete: (id) => apiClient.delete(`/context/${id}`),
};

export const strategiesApi = {
  getAll: () => apiClient.get('/strategies'),
  getDefault: () => apiClient.get('/strategies/default'),
  getById: (id) => apiClient.get(`/strategies/${id}`),
  create: (data) => apiClient.post('/strategies', data),
  update: (id, data) => apiClient.put(`/strategies/${id}`, data),
  delete: (id) => apiClient.delete(`/strategies/${id}`),
};

export const evaluationsApi = {
  getAll: (params = {}) => apiClient.get('/evaluations', { params }),
  getById: (id) => apiClient.get(`/evaluations/${id}`),
  run: (data) => apiClient.post('/evaluations/run', data),
  runDry: (data) => apiClient.post('/evaluations/run/dry', data),
  compare: (data) => apiClient.post('/evaluations/compare', data),
  update: (id, data) => apiClient.put(`/evaluations/${id}`, data),
  delete: (id) => apiClient.delete(`/evaluations/${id}`),
};

export const reportsApi = {
  generate: (data) => apiClient.post('/reports/generate', data),
  getById: (id) => apiClient.get(`/reports/${id}`),
  getByEvaluationId: (evaluationId) => 
    apiClient.get(`/reports/evaluation/${evaluationId}`),
  preview: (data) => apiClient.post('/reports/preview', data),
};

export const healthApi = {
  check: () => apiClient.get('/health'),
};

export default apiClient;
