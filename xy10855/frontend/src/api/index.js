import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const taskAPI = {
  create: (data) => api.post('/tasks/create', data),
  list: (params) => api.get('/tasks/list', { params }),
  detail: (taskId) => api.get(`/tasks/${taskId}`),
  progress: (taskId) => api.get(`/tasks/${taskId}/progress`),
  retry: (taskId) => api.post(`/tasks/${taskId}/retry`),
  authorizeDownload: (taskId, data) => api.post(`/tasks/${taskId}/authorize-download`, data),
  batchImport: (data) => api.post('/tasks/batch/import', data),
  queueStatus: () => api.get('/tasks/queue/status'),
  templates: () => api.get('/tasks/templates/list')
};

export const downloadAPI = {
  download: (token) => {
    window.open(`/api/download/${token}`, '_blank');
  }
};

export default api;
