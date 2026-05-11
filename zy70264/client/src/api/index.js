import axios from 'axios';
import { ElMessage } from 'element-plus';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

api.interceptors.response.use(
  response => {
    return response.data;
  },
  error => {
    console.error('API Error:', error);
    ElMessage.error(error.response?.data?.message || error.message || '请求失败');
    return Promise.reject(error);
  }
);

export const batchAPI = {
  list: (params) => api.get('/batches', { params }),
  detail: (id) => api.get(`/batches/${id}`),
  create: (data) => api.post('/batches', data),
  update: (id, data) => api.put(`/batches/${id}`, data),
  complete: (id) => api.post(`/batches/${id}/complete`),
  delete: (id) => api.delete(`/batches/${id}`)
};

export const temperatureAPI = {
  list: (batchId) => api.get(`/temperature/batch/${batchId}`),
  create: (data) => api.post('/temperature', data),
  update: (id, data) => api.put(`/temperature/${id}`, data),
  delete: (id) => api.delete(`/temperature/${id}`),
  generateNormal: (data) => api.post('/temperature/generate-normal', data),
  generateAbnormal: (data) => api.post('/temperature/generate-abnormal', data)
};

export const receiptAPI = {
  list: (batchId) => api.get(`/receipts/batch/${batchId}`),
  create: (data) => api.post('/receipts', data),
  update: (id, data) => api.put(`/receipts/${id}`, data),
  delete: (id) => api.delete(`/receipts/${id}`)
};

export const returnAPI = {
  reasons: () => api.get('/returns/reasons'),
  list: (batchId) => api.get(`/returns/batch/${batchId}`),
  pending: () => api.get('/returns/pending'),
  create: (data) => api.post('/returns', data),
  update: (id, data) => api.put(`/returns/${id}`, data),
  approve: (id, data) => api.post(`/returns/${id}/approve`, data),
  reject: (id, data) => api.post(`/returns/${id}/reject`, data),
  delete: (id) => api.delete(`/returns/${id}`)
};

export const compensationAPI = {
  rules: () => api.get('/compensations/rules'),
  createRule: (data) => api.post('/compensations/rules', data),
  updateRule: (id, data) => api.put(`/compensations/rules/${id}`, data),
  deleteRule: (id) => api.delete(`/compensations/rules/${id}`),
  list: (params) => api.get('/compensations', { params }),
  pending: () => api.get('/compensations/pending'),
  approve: (id, data) => api.post(`/compensations/${id}/approve`, data),
  reject: (id, data) => api.post(`/compensations/${id}/reject`, data),
  createManual: (data) => api.post('/compensations/manual', data)
};

export const reportAPI = {
  dashboard: (params) => api.get('/reports/dashboard', { params }),
  incidents: (params) => api.get('/reports/incidents', { params }),
  closeIncident: (id, data) => api.post(`/reports/incidents/${id}/close`, data),
  exportBatches: (params) => `/api/reports/export/batches?${new URLSearchParams(params).toString()}`,
  exportTemperature: (params) => `/api/reports/export/temperature?${new URLSearchParams(params).toString()}`,
  exportCompensations: (params) => `/api/reports/export/compensations?${new URLSearchParams(params).toString()}`,
  exportIncidents: (params) => `/api/reports/export/incidents?${new URLSearchParams(params).toString()}`
};

export const sampleDataAPI = {
  createNormal: () => api.post('/sample-data/normal'),
  createAbnormal: () => api.post('/sample-data/abnormal'),
  initRules: () => api.post('/sample-data/init-rules')
};

export default api;
