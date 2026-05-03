import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error.response?.data || error);
  }
);

export const statsApi = {
  get: () => api.get('/stats')
};

export const usersApi = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  createBatch: (data) => api.post('/users/batch', data)
};

export const segmentsApi = {
  getAll: () => api.get('/segments'),
  getById: (id) => api.get(`/segments/${id}`),
  create: (data) => api.post('/segments', data),
  update: (id, data) => api.put(`/segments/${id}`, data),
  delete: (id) => api.delete(`/segments/${id}`)
};

export const flagsApi = {
  getAll: () => api.get('/flags'),
  getById: (id) => api.get(`/flags/${id}`),
  create: (data) => api.post('/flags', data),
  update: (id, data) => api.put(`/flags/${id}`, data),
  delete: (id) => api.delete(`/flags/${id}`),
  toggle: (id) => api.patch(`/flags/${id}/toggle`),
  toggleKillSwitch: (id) => api.patch(`/flags/${id}/kill-switch`)
};

export const evaluationApi = {
  evaluateUser: (userId) => api.post(`/evaluation/user/${userId}`),
  evaluateUserByData: (userData) => api.post('/evaluation/user-by-id', { userData }),
  evaluateBatch: (userIds) => api.post('/evaluation/batch', { userIds, includeAnalysis: true }),
  checkSegment: (userId, segmentId) => api.post('/evaluation/check-segment', { userId, segmentId }),
  getHash: (userId, flagKey) => api.get(`/evaluation/hash/${userId}/${flagKey}`),
  getBatchHash: (userIds, flagKeys) => api.post('/evaluation/hash/batch', { userIds, flagKeys })
};

export const auditApi = {
  getAll: (options) => api.get('/audit', { params: options }),
  getByEntity: (entityType, entityId) => api.get(`/audit/entity/${entityType}/${entityId}`),
  clear: () => api.delete('/audit')
};

export const importExportApi = {
  export: () => api.get('/export', { responseType: 'blob' }),
  import: (data) => api.post('/import', data),
  initSample: () => api.post('/init-sample')
};

export const reportApi = {
  get: () => api.get('/report'),
  getMarkdown: () => api.get('/report/markdown', { responseType: 'blob' }),
  getHtml: () => api.get('/report/html', { responseType: 'blob' }),
  generateReport: (format) => {
    if (format === 'markdown') {
      return api.get('/report/markdown', { responseType: 'blob' });
    } else if (format === 'html') {
      return api.get('/report/html', { responseType: 'blob' });
    }
    return api.get('/report');
  }
};

export default {
  getStats: statsApi.get,
  ...usersApi,
  ...segmentsApi,
  ...flagsApi,
  ...evaluationApi,
  ...auditApi,
  ...importExportApi,
  ...reportApi
};
