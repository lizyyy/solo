import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const materialsAPI = {
  getAll: (params) => api.get('/materials', { params }),
  getById: (id) => api.get(`/materials/${id}`),
  create: (data) => api.post('/materials', data),
  update: (id, data) => api.put(`/materials/${id}`, data),
  delete: (id) => api.delete(`/materials/${id}`)
};

export const workOrdersAPI = {
  getAll: (params) => api.get('/work-orders', { params }),
  getById: (id) => api.get(`/work-orders/${id}`),
  create: (data) => api.post('/work-orders', data),
  update: (id, data) => api.put(`/work-orders/${id}`, data),
  takeMaterials: (id, data) => api.post(`/work-orders/${id}/take-materials`, data),
  consumeMaterials: (id, data) => api.post(`/work-orders/${id}/consume-materials`, data),
  returnMaterials: (id, data) => api.post(`/work-orders/${id}/return-materials`, data),
  confirm: (id, data) => api.post(`/work-orders/${id}/confirm`, data),
  settle: (id) => api.post(`/work-orders/${id}/settle`),
  getSettlement: (id) => api.get(`/work-orders/${id}/settlement`)
};

export const settlementsAPI = {
  getAll: (params) => api.get('/settlements', { params }),
  getById: (id) => api.get(`/settlements/${id}`)
};

export const dashboardAPI = {
  getStats: (params) => api.get('/dashboard/stats', { params }),
  exportMaterials: (params) => api.get('/dashboard/export/materials', { params })
};

export default api;
