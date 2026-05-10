import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const message = error.response?.data?.error || error.message || '请求失败';
    return Promise.reject(new Error(message));
  }
);

export const departmentApi = {
  list: () => api.get('/departments'),
  get: (id) => api.get(`/departments/${id}`)
};

export const materialApi = {
  list: (params) => api.get('/materials', { params }),
  get: (id) => api.get(`/materials/${id}`),
  getLowStock: () => api.get('/materials/low-stock'),
  getCategories: () => api.get('/materials/categories'),
  getHistory: (id, limit) => api.get(`/materials/${id}/history`, { params: { limit } }),
  create: (data) => api.post('/materials', data),
  update: (id, data) => api.put(`/materials/${id}`, data),
  adjustStock: (id, data) => api.post(`/materials/${id}/adjust`, data)
};

export const treatmentApi = {
  list: (activeOnly) => api.get('/treatments', { params: { active: activeOnly } }),
  get: (id) => api.get(`/treatments/${id}`),
  checkStock: (id) => api.get(`/treatments/${id}/stock-check`),
  getSummary: (id) => api.get(`/treatments/${id}/summary`),
  getConsumptionReport: (id, days) => api.get(`/treatments/${id}/consumption-report`, { params: { days } }),
  create: (data) => api.post('/treatments', data),
  update: (id, data) => api.put(`/treatments/${id}`, data),
  bindMaterials: (id, materials) => api.post(`/treatments/${id}/bind-materials`, { materials })
};

export const consumptionApi = {
  getRecords: (params) => api.get('/consumption/records', { params }),
  getStats: (days) => api.get('/consumption/stats', { params: { days } }),
  getDepartments: () => api.get('/consumption/departments'),
  byTreatment: (data) => api.post('/consumption/by-treatment', data),
  manual: (data) => api.post('/consumption/manual', data)
};

export const replenishmentApi = {
  list: (params) => api.get('/replenishment', { params }),
  get: (id) => api.get(`/replenishment/${id}`),
  getStatusFlow: () => api.get('/replenishment/status-flow'),
  getStatusCounts: () => api.get('/replenishment/status-counts'),
  getSuggestions: () => api.get('/replenishment/suggestions'),
  create: (data) => api.post('/replenishment', data),
  approve: (id, data) => api.post(`/replenishment/${id}/approve`, data),
  reject: (id, data) => api.post(`/replenishment/${id}/reject`, data),
  fulfill: (id, data) => api.post(`/replenishment/${id}/fulfill`, data)
};

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getBlockages: () => api.get('/dashboard/blockages'),
  getSuggestions: () => api.get('/dashboard/suggestions'),
  getHistory: (limit) => api.get('/dashboard/history', { params: { limit } }),
  getFlowStatus: () => api.get('/dashboard/flow-status'),
  getMaterialTrend: (id, days) => api.get(`/dashboard/materials/${id}/trend`, { params: { days } }),
  getLogs: (params) => api.get('/dashboard/logs', { params }),
  getOverview: () => api.get('/dashboard/overview')
};

export const statusApi = {
  getFlow: () => api.get('/status-flow'),
  health: () => api.get('/health')
};

export default api;
