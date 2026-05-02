import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const workOrderApi = {
  getAll: (status) => api.get('/work-orders', { params: { status } }),
  getById: (id) => api.get(`/work-orders/${id}`),
  create: (data) => api.post('/work-orders', data),
  updateStatus: (id, data) => api.put(`/work-orders/${id}/status`, data),
  addCommunication: (id, data) => api.post(`/work-orders/${id}/communications`, data)
};

export const sparePartApi = {
  getAll: (lowStock) => api.get('/spare-parts', { params: { low_stock: lowStock } }),
  getById: (id) => api.get(`/spare-parts/${id}`),
  create: (data) => api.post('/spare-parts', data),
  update: (id, data) => api.put(`/spare-parts/${id}`, data),
  delete: (id) => api.delete(`/spare-parts/${id}`)
};

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats')
};

export const healthApi = {
  check: () => api.get('/health')
};

export default api;
