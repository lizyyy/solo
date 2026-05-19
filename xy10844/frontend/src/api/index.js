import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export const taskApi = {
  getTasks: (params) => api.get('/tasks', { params }),
  getTask: (id) => api.get(`/tasks/${id}`),
  createTask: (data) => api.post('/tasks', data),
  updateStage: (id, data) => api.put(`/tasks/${id}/stage`, data),
  pauseTask: (id, data) => api.put(`/tasks/${id}/pause`, data),
  resumeTask: (id, data) => api.put(`/tasks/${id}/resume`, data),
  verifyTask: (id, data) => api.put(`/tasks/${id}/verify`, data),
  updateGrayTraffic: (id, data) => api.put(`/tasks/${id}/gray-traffic`, data),
  rollbackTask: (id, data) => api.put(`/tasks/${id}/rollback`, data),
  getLogs: (id) => api.get(`/tasks/${id}/logs`),
  getSwitchRecords: (id) => api.get(`/tasks/${id}/switch-records`),
  getStats: () => api.get('/tasks/stats'),
  exportCsv: () => window.open('/api/tasks/export/csv', '_blank'),
};

export const constantsApi = {
  getConstants: () => api.get('/constants'),
};

export default api;