import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const dashboardAPI = {
  getSummary: () => api.get('/dashboard/summary')
};

export const cagesAPI = {
  getAll: (params) => api.get('/cages', { params }),
  getById: (id) => api.get(`/cages/${id}`)
};

export const hospitalizationsAPI = {
  getAll: (params) => api.get('/hospitalizations', { params }),
  getById: (id) => api.get(`/hospitalizations/${id}`),
  create: (data) => api.post('/hospitalizations', data),
  discharge: (id, data) => api.post(`/hospitalizations/${id}/discharge`, data),
  transferCage: (id, data) => api.put(`/hospitalizations/${id}/cage`, data)
};

export const petsAPI = {
  getAll: () => api.get('/pets'),
  getById: (id) => api.get(`/pets/${id}`)
};

export const careTasksAPI = {
  getAll: (params) => api.get('/care-tasks', { params }),
  create: (data) => api.post('/care-tasks', data),
  complete: (id, data) => api.post(`/care-tasks/${id}/complete`, data)
};

export const transferRequestsAPI = {
  getAll: (params) => api.get('/transfer-requests', { params }),
  create: (data) => api.post('/transfer-requests', data),
  approve: (id, data) => api.post(`/transfer-requests/${id}/approve`, data),
  reject: (id, data) => api.post(`/transfer-requests/${id}/reject`, data),
  close: (id, data) => api.post(`/transfer-requests/${id}/close`, data)
};

export const alertsAPI = {
  getAll: (params) => api.get('/alerts', { params }),
  resolve: (id) => api.post(`/alerts/${id}/resolve`)
};

export const exportAPI = {
  exportHospitalizations: (params) => api.get('/export/hospitalizations', { params }),
  exportCareTasks: (params) => api.get('/export/care-tasks', { params })
};

export const masterDataAPI = {
  getSpecies: () => api.get('/species'),
  getCareLevels: () => api.get('/care-levels'),
  getLocations: () => api.get('/locations'),
  getOwners: () => api.get('/owners')
};

export default api;
