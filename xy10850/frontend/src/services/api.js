import axios from 'axios';

const api = axios.create({
  baseURL: '/',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const pageModuleApi = {
  getAll: (params) => api.get('/page-modules/', { params }),
  get: (id) => api.get(`/page-modules/${id}`),
  create: (data) => api.post('/page-modules/', data),
  update: (id, data) => api.put(`/page-modules/${id}`, data),
  delete: (id) => api.delete(`/page-modules/${id}`),
};

export const upstreamApi = {
  getAll: (params) => api.get('/upstream-apis/', { params }),
  get: (id) => api.get(`/upstream-apis/${id}`),
  create: (data) => api.post('/upstream-apis/', data),
  update: (id, data) => api.put(`/upstream-apis/${id}`, data),
  delete: (id) => api.delete(`/upstream-apis/${id}`),
};

export const bffEndpointApi = {
  getAll: (params) => api.get('/bff-endpoints/', { params }),
  get: (id) => api.get(`/bff-endpoints/${id}`),
  create: (data) => api.post('/bff-endpoints/', data),
  update: (id, data) => api.put(`/bff-endpoints/${id}`, data),
  delete: (id) => api.delete(`/bff-endpoints/${id}`),
  transitionStatus: (id, data) => api.post(`/bff-endpoints/${id}/status`, data),
  getStatistics: (id, days) => api.get(`/bff-endpoints/${id}/statistics`, { params: { days } }),
  execute: (data) => api.post('/execute', data),
  batchImport: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/bff-endpoints/batch-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const callHistoryApi = {
  getAll: (params) => api.get('/call-history/', { params }),
  get: (id) => api.get(`/call-history/${id}`),
  export: (params) => api.get('/call-history/export', {
    params,
    responseType: 'blob',
  }),
};

export default api;
