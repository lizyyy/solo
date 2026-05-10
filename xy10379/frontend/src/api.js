import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10000,
});

export const roomsApi = {
  getAll: () => api.get('/rooms'),
  create: (data) => api.post('/rooms', data),
};

export const linenTypesApi = {
  getAll: () => api.get('/linen-types'),
};

export const inventoryApi = {
  getAll: () => api.get('/inventory'),
  getTransactions: () => api.get('/inventory-transactions'),
};

export const staffApi = {
  getAll: () => api.get('/staff'),
};

export const roomOrdersApi = {
  getAll: () => api.get('/room-orders'),
  get: (id) => api.get(`/room-orders/${id}`),
  create: (data) => api.post('/room-orders', data),
  checkout: (id, data) => api.post(`/room-orders/${id}/checkout`, data),
};

export const cleanInspectionsApi = {
  getAll: () => api.get('/clean-inspections'),
  create: (data) => api.post('/clean-inspections', data),
};

export const damageReportsApi = {
  getAll: () => api.get('/damage-reports'),
  create: (data) => api.post('/damage-reports', data),
  confirm: (id, data) => api.post(`/damage-reports/${id}/confirm`, data),
  cancel: (id) => api.post(`/damage-reports/${id}/cancel`),
};

export const compensationsApi = {
  getAll: () => api.get('/compensations'),
  pay: (id) => api.post(`/compensations/${id}/pay`),
};

export const statsApi = {
  get: () => api.get('/stats'),
};

export const exportApi = {
  downloadDaily: () => {
    const url = `http://localhost:3001/api/export/daily-report?date=${new Date().toISOString().split('T')[0]}`;
    window.open(url, '_blank');
  },
};

export default api;
