import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  getCurrentUser: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
};

export const projectApi = {
  list: (params) => api.get('/projects', { params }),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  getTagRules: (projectId) => api.get(`/projects/${projectId}/tags`),
  createTagRule: (projectId, data) => api.post(`/projects/${projectId}/tags`, data),
  updateTagRule: (id, data) => api.put(`/projects/tags/${id}`, data),
  deleteTagRule: (id) => api.delete(`/projects/tags/${id}`),
};

export const sharedServiceApi = {
  list: (params) => api.get('/shared-services', { params }),
  get: (id) => api.get(`/shared-services/${id}`),
  create: (data) => api.post('/shared-services', data),
  update: (id, data) => api.put(`/shared-services/${id}`, data),
  delete: (id) => api.delete(`/shared-services/${id}`),
  getRatios: (sharedServiceId, effectiveMonth) =>
    api.get(`/shared-services/${sharedServiceId}/ratios${effectiveMonth ? `/${effectiveMonth}` : ''}`),
  saveRatios: (sharedServiceId, data) =>
    api.post(`/shared-services/${sharedServiceId}/ratios`, data),
};

export const billApi = {
  getImports: (params) => api.get('/bills/imports', { params }),
  getImport: (id) => api.get(`/bills/imports/${id}`),
  importBill: (formData, config) => api.post('/bills/import', formData, config),
  getRecords: (params) => api.get('/bills/records', { params }),
  getRecord: (id) => api.get(`/bills/records/${id}`),
  manualAssign: (id, data) => api.post(`/bills/records/${id}/assign`, data),
};

export const anomalyApi = {
  list: (params) => api.get('/anomalies', { params }),
  get: (id) => api.get(`/anomalies/${id}`),
  update: (id, data) => api.put(`/anomalies/${id}`, data),
  getStats: (params) => api.get('/anomalies/stats', { params }),
};

export const dashboardApi = {
  getStats: (billMonth) => api.get('/dashboard/stats', { params: { billMonth } }),
  getProjectCosts: (billMonth) => api.get('/dashboard/project-costs', { params: { billMonth } }),
  getAnomalies: (params) => api.get('/dashboard/anomalies', { params }),
  handleAnomaly: (id, data) => api.put(`/dashboard/anomalies/${id}`, data),
  getAlerts: (params) => api.get('/dashboard/alerts', { params }),
  acknowledgeAlert: (id) => api.post(`/dashboard/alerts/${id}/acknowledge`),
  getManualHistory: (params) => api.get('/dashboard/manual-history', { params }),
  exportReport: (billMonth) =>
    api.get('/dashboard/export', {
      params: { billMonth, format: 'json' },
      responseType: 'blob',
    }),
};

export default api;
