import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message || '请求失败';
    return Promise.reject(new Error(message));
  }
);

export const tenantsApi = {
  list: () => api.get('/tenants'),
  create: (data) => api.post('/tenants', data),
  update: (id, data) => api.put(`/tenants/${id}`, data),
  delete: (id) => api.delete(`/tenants/${id}`),
};

export const interfaceGroupsApi = {
  list: () => api.get('/interface-groups'),
  create: (data) => api.post('/interface-groups', data),
  update: (id, data) => api.put(`/interface-groups/${id}`, data),
  delete: (id) => api.delete(`/interface-groups/${id}`),
};

export const rulesApi = {
  list: () => api.get('/rules'),
  create: (data) => api.post('/rules', data),
  update: (id, data) => api.put(`/rules/${id}`, data),
  delete: (id) => api.delete(`/rules/${id}`),
};

export const releasesApi = {
  list: () => api.get('/releases'),
  current: () => api.get('/releases/current'),
  preview: (data) => api.post('/releases/preview', data),
  create: (data) => api.post('/releases', data),
  publish: (id) => api.post(`/releases/${id}/publish`),
  pause: (id) => api.post(`/releases/${id}/pause`),
  rollback: (id) => api.post(`/releases/${id}/rollback`),
};

export const hitLogsApi = {
  list: (params) => api.get('/hit-logs', { params }),
  stats: (params) => api.get('/hit-logs/stats', { params }),
  simulate: (count) => api.post('/hit-logs/simulate', { count }),
  export: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return `/api/hit-logs/export?${queryString}`;
  },
};

export const commonApi = {
  health: () => api.get('/health'),
  regions: () => api.get('/regions'),
};
