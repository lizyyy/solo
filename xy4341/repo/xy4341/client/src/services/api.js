import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    throw error.response?.data || error;
  }
);

export const floorsApi = {
  getAll: () => api.get('/floors'),
  getById: (id) => api.get(`/floors/${id}`),
  create: (data) => api.post('/floors', data),
  update: (id, data) => api.put(`/floors/${id}`, data),
  delete: (id) => api.delete(`/floors/${id}`),
};

export const exitsApi = {
  getAll: () => api.get('/exits'),
  getByFloor: (floorId) => api.get(`/exits/floor/${floorId}`),
  getById: (id) => api.get(`/exits/${id}`),
  create: (data) => api.post('/exits', data),
  update: (id, data) => api.put(`/exits/${id}`, data),
  delete: (id) => api.delete(`/exits/${id}`),
};

export const personsApi = {
  getAll: () => api.get('/persons'),
  getSummary: () => api.get('/persons/summary'),
  getByFloor: (floorId) => api.get(`/persons/floor/${floorId}`),
  getById: (id) => api.get(`/persons/${id}`),
  create: (data) => api.post('/persons', data),
  bulkCreate: (persons) => api.post('/persons/bulk', { persons }),
  importCsv: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/persons/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  update: (id, data) => api.put(`/persons/${id}`, data),
  delete: (id) => api.delete(`/persons/${id}`),
  deleteByFloor: (floorId) => api.delete(`/persons/floor/${floorId}`),
  deleteAll: () => api.delete('/persons'),
};

export const drillsApi = {
  getAll: () => api.get('/drills'),
  getActive: () => api.get('/drills/active'),
  getById: (id) => api.get(`/drills/${id}`),
  create: (data) => api.post('/drills', data),
  start: (id) => api.post(`/drills/${id}/start`),
  pause: (id) => api.post(`/drills/${id}/pause`),
  resume: (id) => api.post(`/drills/${id}/resume`),
  step: (id) => api.post(`/drills/${id}/step`),
  addFirePoint: (id, data) => api.post(`/drills/${id}/fire-point`, data),
  addBroadcasts: (id, broadcasts) => api.post(`/drills/${id}/broadcasts`, { broadcasts }),
  getState: (id) => api.get(`/drills/${id}/state`),
  complete: (id) => api.post(`/drills/${id}/complete`),
  delete: (id) => api.delete(`/drills/${id}`),
};

export const exportsApi = {
  getReport: (sessionId) => api.get(`/exports/${sessionId}/report`, {
    responseType: 'blob',
  }),
  getAudit: (sessionId) => api.get(`/exports/${sessionId}/audit`, {
    responseType: 'blob',
  }),
  exportAll: (sessionId) => api.post(`/exports/${sessionId}/all`),
  previewReport: (sessionId) => api.get(`/exports/${sessionId}/preview/report`),
  previewAudit: (sessionId) => api.get(`/exports/${sessionId}/preview/audit`),
};

export const healthApi = {
  check: () => api.get('/health'),
  reset: () => api.get('/reset'),
};

export default api;
