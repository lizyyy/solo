import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    const message = error.response?.data?.error || error.response?.data?.message || error.message;
    return Promise.reject(new Error(message));
  }
);

export const buildingsAPI = {
  getAll: () => api.get('/buildings'),
  getById: (id) => api.get(`/buildings/${id}`),
  create: (data) => api.post('/buildings', data),
  update: (id, data) => api.put(`/buildings/${id}`, data),
  delete: (id) => api.delete(`/buildings/${id}`),
};

export const workersAPI = {
  getAll: (params) => api.get('/workers', { params }),
  getById: (id) => api.get(`/workers/${id}`),
  create: (data) => api.post('/workers', data),
  update: (id, data) => api.put(`/workers/${id}`, data),
  delete: (id) => api.delete(`/workers/${id}`),
};

export const devicesAPI = {
  getAll: (params) => api.get('/devices', { params }),
  getById: (id) => api.get(`/devices/${id}`),
  create: (data) => api.post('/devices', data),
  update: (id, data) => api.put(`/devices/${id}`, data),
  delete: (id) => api.delete(`/devices/${id}`),
  getTypes: () => api.get('/devices/types'),
  exportCSV: (params) => api.get('/devices/export-csv', { params, responseType: 'blob' }),
  importCSV: (csvContent) => api.post('/devices/import-csv', { csvContent }),
};

export const templatesAPI = {
  getAll: (params) => api.get('/templates', { params }),
  getById: (id) => api.get(`/templates/${id}`),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
  addCheckItem: (templateId, data) => api.post(`/templates/${templateId}/check-items`, data),
  updateCheckItem: (itemId, data) => api.put(`/templates/check-items/${itemId}`, data),
  deleteCheckItem: (itemId) => api.delete(`/templates/check-items/${itemId}`),
};

export const patrolTasksAPI = {
  getAll: (params) => api.get('/patrol-tasks', { params }),
  getById: (id) => api.get(`/patrol-tasks/${id}`),
  create: (data) => api.post('/patrol-tasks', data),
  start: (id) => api.put(`/patrol-tasks/${id}/start`),
  complete: (id) => api.put(`/patrol-tasks/${id}/complete`),
  updateItem: (itemId, data) => api.put(`/patrol-tasks/items/${itemId}`, data),
  delete: (id) => api.delete(`/patrol-tasks/${id}`),
};

export const repairOrdersAPI = {
  getAll: (params) => api.get('/repair-orders', { params }),
  getById: (id) => api.get(`/repair-orders/${id}`),
  create: (data) => api.post('/repair-orders', data),
  update: (id, data) => api.put(`/repair-orders/${id}`, data),
  assign: (id, workerId) => api.put(`/repair-orders/${id}/assign`, { workerId }),
  submit: (id, processingNotes) => api.put(`/repair-orders/${id}/submit`, { processingNotes }),
  review: (id, data) => api.put(`/repair-orders/${id}/review`, data),
  delete: (id) => api.delete(`/repair-orders/${id}`),
  getStats: () => api.get('/repair-orders/stats'),
  exportCSV: (params) => api.get('/repair-orders/export-csv', { params, responseType: 'blob' }),
};

export const dashboardAPI = {
  getOverview: () => api.get('/dashboard'),
  getRepairTrend: () => api.get('/dashboard/repair-trend'),
  getBuildingStats: () => api.get('/dashboard/building-stats'),
  getDeviceTypeStats: () => api.get('/dashboard/device-type-stats'),
};

export default api;
