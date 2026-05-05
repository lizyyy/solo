import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const plotAPI = {
  getAll: () => api.get('/plots'),
  getById: (id) => api.get(`/plots/${id}`),
  create: (data) => api.post('/plots', data),
  update: (id, data) => api.put(`/plots/${id}`, data),
  delete: (id) => api.delete(`/plots/${id}`),
};

export const machineAPI = {
  getAll: () => api.get('/machines'),
  getById: (id) => api.get(`/machines/${id}`),
  create: (data) => api.post('/machines', data),
  update: (id, data) => api.put(`/machines/${id}`, data),
  delete: (id) => api.delete(`/machines/${id}`),
};

export const operatorAPI = {
  getAll: () => api.get('/operators'),
  getById: (id) => api.get(`/operators/${id}`),
  create: (data) => api.post('/operators', data),
  update: (id, data) => api.put(`/operators/${id}`, data),
  delete: (id) => api.delete(`/operators/${id}`),
};

export const reservationAPI = {
  getAll: (params) => api.get('/reservations', { params }),
  getById: (id) => api.get(`/reservations/${id}`),
  create: (data) => api.post('/reservations', data),
  update: (id, data) => api.put(`/reservations/${id}`, data),
  updateStatus: (id, status) => api.put(`/reservations/${id}/status`, { status }),
  delete: (id) => api.delete(`/reservations/${id}`),
};

export const subsidyAPI = {
  getAll: () => api.get('/subsidies'),
  getById: (id) => api.get(`/subsidies/${id}`),
  create: (data) => api.post('/subsidies', data),
  update: (id, data) => api.put(`/subsidies/${id}`, data),
  delete: (id) => api.delete(`/subsidies/${id}`),
};

export const importAPI = {
  importPlots: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/plots', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importMachines: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/machines', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importOperators: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/operators', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importReservations: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/reservations', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importSubsidies: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/subsidies', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importSample: () => api.post('/import/sample'),
};

export const exportAPI = {
  getDispatchNotes: () => api.get('/export/dispatch-notes', { responseType: 'blob' }),
  getAuditPackage: () => api.get('/export/audit-package', { responseType: 'blob' }),
  getDispatchNoteById: (id) => api.get(`/export/reservation/${id}/dispatch-note`, { responseType: 'blob' }),
};

export const validationAPI = {
  validateReservation: (id) => api.post(`/validation/reservation/${id}`),
  validateAll: () => api.post('/validation/all'),
  overrideRisk: (riskId, reason) => api.post(`/validation/override/${riskId}`, { override_reason: reason }),
  cancelOverride: (riskId) => api.post(`/validation/cancel-override/${riskId}`),
};

export default api;
