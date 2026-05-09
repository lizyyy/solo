import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API错误:', error);
    return Promise.reject(error);
  }
);

export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getHealth: () => api.get('/health'),
};

export const stationsAPI = {
  getAll: () => api.get('/stations'),
  getById: (id) => api.get(`/stations/${id}`),
  create: (data) => api.post('/stations', data),
  update: (id, data) => api.put(`/stations/${id}`, data),
  delete: (id) => api.delete(`/stations/${id}`),
};

export const routesAPI = {
  getAll: () => api.get('/routes'),
  getById: (id) => api.get(`/routes/${id}`),
  getStations: (id) => api.get(`/routes/${id}/stations`),
  create: (data) => api.post('/routes', data),
  update: (id, data) => api.put(`/routes/${id}`, data),
};

export const employeesAPI = {
  getAll: () => api.get('/employees'),
  getById: (id) => api.get(`/employees/${id}`),
  getRegistrations: (id) => api.get(`/employees/${id}/registrations`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
};

export const registrationsAPI = {
  getAll: (params) => api.get('/registrations', { params }),
  getByStation: (stationId) => api.get(`/registrations/by-station/${stationId}`),
  create: (data) => api.post('/registrations', data),
  update: (id, data) => api.put(`/registrations/${id}`, data),
};

export const swipeAPI = {
  getAll: (params) => api.get('/swipe', { params }),
  getByStation: (stationId, params) => api.get(`/swipe/by-station/${stationId}`, { params }),
  create: (data) => api.post('/swipe', data),
};

export const adjustmentsAPI = {
  getAll: (params) => api.get('/adjustments', { params }),
  getById: (id) => api.get(`/adjustments/${id}`),
  getImpact: (id) => api.get(`/adjustments/${id}/impact`),
  create: (data) => api.post('/adjustments', data),
  review: (id, data) => api.post(`/adjustments/${id}/review`, data),
};

export const analyticsAPI = {
  getStationHeat: (params) => api.get('/analytics/station-heat', { params }),
  getHistorical: (params) => api.get('/analytics/historical', { params }),
  getTrends: (params) => api.get('/analytics/trends', { params }),
  getWarnings: () => api.get('/analytics/warnings'),
};

export const announcementsAPI = {
  getAll: (params) => api.get('/announcements', { params }),
  create: (data) => api.post('/announcements', data),
  update: (id, data) => api.put(`/announcements/${id}`, data),
  publish: (id) => api.post(`/announcements/${id}/publish`),
};

export default api;
