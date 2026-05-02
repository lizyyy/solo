import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const statusApi = {
  getStatus: () => api.get('/status'),
  getHealth: () => api.get('/health'),
};

export const roomsApi = {
  getAll: () => api.get('/rooms'),
  getById: (id) => api.get(`/rooms/${id}`),
  create: (data) => api.post('/rooms', data),
  update: (id, data) => api.put(`/rooms/${id}`, data),
  delete: (id) => api.delete(`/rooms/${id}`),
  sealWindow: (id) => api.post(`/rooms/${id}/seal-window`),
  batchCreate: (data) => api.post('/rooms/batch', { rooms: data }),
};

export const guestsApi = {
  getAll: (params = {}) => api.get('/guests', { params }),
  getById: (id) => api.get(`/guests/${id}`),
  getPriority: () => api.get('/guests/priority'),
  create: (data) => api.post('/guests', data),
  update: (id, data) => api.put(`/guests/${id}`, data),
  delete: (id) => api.delete(`/guests/${id}`),
  evacuate: (id) => api.post(`/guests/${id}/evacuate`),
  assignBatch: (id, batchId) => api.post(`/guests/${id}/assign-batch`, { batch_id: batchId }),
  removeBatch: (id) => api.post(`/guests/${id}/remove-batch`),
  batchCreate: (data) => api.post('/guests/batch', { guests: data }),
};

export const shipsApi = {
  getAll: () => api.get('/ships'),
  getAvailable: () => api.get('/ships/available'),
  getById: (id) => api.get(`/ships/${id}`),
  create: (data) => api.post('/ships', data),
  update: (id, data) => api.put(`/ships/${id}`, data),
  delete: (id) => api.delete(`/ships/${id}`),
  batchCreate: (data) => api.post('/ships/batch', { ships: data }),
};

export const suppliesApi = {
  getAll: (params = {}) => api.get('/supplies', { params }),
  getStatus: () => api.get('/supplies/status'),
  getById: (id) => api.get(`/supplies/${id}`),
  create: (data) => api.post('/supplies', data),
  update: (id, data) => api.put(`/supplies/${id}`, data),
  delete: (id) => api.delete(`/supplies/${id}`),
  updateQuantity: (id, delta, reason) => 
    api.post(`/supplies/${id}/update-quantity`, { delta, reason }),
  getSandbags: () => api.get('/supplies/sandbags'),
  createSandbag: (data) => api.post('/supplies/sandbags', data),
  updateSandbag: (id, data) => api.put(`/supplies/sandbags/${id}`, data),
  batchCreate: (data) => api.post('/supplies/batch', { supplies: data }),
};

export const batchesApi = {
  getAll: (params = {}) => api.get('/batches', { params }),
  getById: (id) => api.get(`/batches/${id}`),
  create: (data) => api.post('/batches', data),
  update: (id, data) => api.put(`/batches/${id}`, data),
  delete: (id) => api.delete(`/batches/${id}`),
  start: (id) => api.post(`/batches/${id}/start`),
  complete: (id) => api.post(`/batches/${id}/complete`),
  generatePlan: (options = {}) => api.post('/batches/generate-plan', options),
  savePlan: (plan) => api.post('/batches/save-plan', { plan }),
};

export const exportApi = {
  getDutySheet: () => api.get('/export/preview/duty-sheet'),
  getShipList: (batchId) => api.get('/export/preview/ship-list', { params: { batch_id: batchId } }),
  getAuditPackage: () => api.get('/export/preview/audit-package'),
  downloadDutySheet: () => window.open('/api/export/duty-sheet', '_blank'),
  downloadShipList: (batchId) => {
    const url = batchId 
      ? `/api/export/ship-list?batch_id=${batchId}`
      : '/api/export/ship-list';
    window.open(url, '_blank');
  },
  downloadAuditPackage: () => window.open('/api/export/audit-package', '_blank'),
};

export default api;
