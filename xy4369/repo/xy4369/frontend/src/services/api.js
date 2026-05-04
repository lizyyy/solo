import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const ropeApi = {
  getAll: () => api.get('/ropes'),
  getById: (id) => api.get(`/ropes/${id}`),
  getTimeline: (id) => api.get(`/ropes/${id}/timeline`),
  assess: (id) => api.post(`/ropes/${id}/assess`),
  assessAll: () => api.post('/ropes/assess-all'),
  update: (id, data) => api.put(`/ropes/${id}`, data)
};

export const importApi = {
  importRopes: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/ropes', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  importUsage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/usage', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  importThresholds: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/thresholds', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

export const reviewApi = {
  getRiskLevels: () => api.get('/review/risk-levels'),
  createDecision: (data) => api.post('/review/decision', data),
  getDecisions: (assessmentId) => api.get(`/review/decisions/${assessmentId}`),
  getScrapHistory: () => api.get('/review/scrap-history')
};

export const exportApi = {
  getMarkdownReport: () => {
    return api.get('/export/markdown-report', { responseType: 'blob' });
  },
  getScrapList: () => {
    return api.get('/export/scrap-list', { responseType: 'blob' });
  },
  getRopeSummary: () => {
    return api.get('/export/rope-summary', { responseType: 'blob' });
  },
  getJsonReport: () => api.get('/export/json-report')
};

export default api;
