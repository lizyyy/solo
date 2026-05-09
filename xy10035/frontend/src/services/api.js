import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000
});

export const logApi = {
  ingest: (data) => api.post('/logs/ingest', data),
  search: (params) => api.get('/logs/search', { params }),
  getById: (id) => api.get(`/logs/${id}`),
  getStatistics: (params) => api.get('/logs/statistics', { params }),
  getServices: () => api.get('/logs/services'),
  cleanup: (days) => api.delete('/logs/cleanup', { params: { days } })
};

export const replayApi = {
  getTimeline: (traceId) => api.get(`/replay/trace/${traceId}`),
  getStep: (traceId, stepIndex) => api.get(`/replay/trace/${traceId}/step/${stepIndex}`),
  getSummary: (traceId) => api.get(`/replay/trace/${traceId}/summary`),
  searchInTrace: (traceId, query) => api.get(`/replay/trace/${traceId}/search`, { params: { q: query } }),
  getCriticalPath: (traceId) => api.get(`/replay/trace/${traceId}/critical`),
  listTraces: (params) => api.get('/replay/traces', { params }),
  exportTrace: (traceId) => api.get(`/replay/trace/${traceId}/export`, { responseType: 'blob' })
};

export const reportApi = {
  generate: (data) => api.post('/reports/generate', data, { 
    responseType: data.format !== 'json' ? 'blob' : 'json'
  }),
  list: (params) => api.get('/reports', { params }),
  getById: (reportId) => api.get(`/reports/${reportId}`),
  exportExisting: (reportId, format) => api.post(`/reports/${reportId}/export`, { format }, {
    responseType: format !== 'json' ? 'blob' : 'json'
  }),
  preview: (filters) => api.post('/reports/preview', filters)
};

export default api;
