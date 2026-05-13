import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

export const cylinderApi = {
  getAll: () => api.get('/cylinders'),
  getById: (id) => api.get(`/cylinders/${id}`),
  create: (data) => api.post('/cylinders', data),
  update: (id, data) => api.put(`/cylinders/${id}`, data),
  transition: (id, data) => api.post(`/cylinders/${id}/transition`, data),
  correct: (id, data) => api.post(`/cylinders/${id}/correct`, data),
  batchImport: (data) => api.post('/cylinders/batch-import', data),
  getHistory: (id) => api.get(`/cylinders/${id}/history`)
};

export const exportApi = {
  exportCylinders: (status) => {
    window.open(`/api/export/cylinders${status ? `?status=${status}` : ''}`, '_blank');
  },
  exportHistories: (params) => {
    const query = new URLSearchParams(params).toString();
    window.open(`/api/export/histories${query ? `?${query}` : ''}`, '_blank');
  },
  getOperators: () => api.get('/export/operators')
};

export default api;
