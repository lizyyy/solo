import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const shipmentApi = {
  list: (params) => api.get('/shipments', { params }),
  get: (id) => api.get(`/shipments/${id}`),
  create: (data) => api.post('/shipments', data),
  update: (id, data) => api.put(`/shipments/${id}`, data),
  getAnalysis: (id) => api.get(`/shipments/${id}/analysis`)
};

export const temperatureApi = {
  list: (shipmentId) => api.get(`/temperature/shipment/${shipmentId}`),
  create: (data) => api.post('/temperature', data),
  import: (shipmentId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/temperature/import/${shipmentId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  delete: (id) => api.delete(`/temperature/${id}`)
};

export const nodeApi = {
  list: (shipmentId) => api.get(`/nodes/shipment/${shipmentId}`),
  create: (data) => api.post('/nodes', data),
  update: (id, data) => api.put(`/nodes/${id}`, data),
  delete: (id) => api.delete(`/nodes/${id}`)
};

export const signoffApi = {
  get: (shipmentId) => api.get(`/signoff/shipment/${shipmentId}`),
  create: (data) => api.post('/signoff', data),
  update: (id, data) => api.put(`/signoff/${id}`, data)
};

export const claimApi = {
  list: (params) => api.get('/claims', { params }),
  get: (id) => api.get(`/claims/${id}`),
  validate: (data) => api.post('/claims/validate', data),
  create: (data) => api.post('/claims', data),
  submit: (id, data) => api.post(`/claims/${id}/submit`, data),
  approve: (id, data) => api.post(`/claims/${id}/approve`, data),
  reject: (id, data) => api.post(`/claims/${id}/reject`, data),
  updateEvidence: (id, data) => api.put(`/claims/${id}/evidence`, data),
  getStats: () => api.get('/claims/stats/summary')
};

export const cargoTypeApi = {
  list: () => api.get('/cargo-types'),
  create: (data) => api.post('/cargo-types', data),
  update: (id, data) => api.put(`/cargo-types/${id}`, data)
};

export default api;
