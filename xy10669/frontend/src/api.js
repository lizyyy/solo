import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10000
});

export const getStats = () => api.get('/stats');
export const getPackages = () => api.get('/packages');
export const getItems = () => api.get('/items');
export const getExclusions = () => api.get('/item-exclusions');
export const getAppointments = (params) => api.get('/appointments', { params });
export const getExceptions = (params) => api.get('/exceptions', { params });
export const resolveException = (id, data) => api.put(`/exceptions/${id}/resolve`, data);
export const getReports = (params) => api.get('/reports', { params });
export const generateReport = (appointmentId, data) => api.post(`/reports/generate/${appointmentId}`, data);
export const exportReports = (reportIds) => api.post('/reports/export', { reportIds }, { responseType: 'blob' });
export const getHistory = (entityType, entityId) => api.get(`/history/${entityType}/${entityId}`);
export const addAddon = (appointmentId, data) => api.post(`/appointments/${appointmentId}/addons`, data);
export const addWaiver = (appointmentId, data) => api.post(`/appointments/${appointmentId}/waivers`, data);
export const updatePackage = (id, data) => api.put(`/packages/${id}`, data);
export const updateItem = (id, data) => api.put(`/items/${id}`, data);
export const updateAppointment = (id, data) => api.put(`/appointments/${id}`, data);

export default api;
