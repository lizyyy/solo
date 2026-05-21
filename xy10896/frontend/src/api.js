import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const getSubscriptions = () => api.get('/subscriptions');
export const createSubscription = (data) => api.post('/subscriptions', data);
export const getChanges = () => api.get('/changes');
export const createChange = (data) => api.post('/changes', data);
export const getConfirmations = (params) => api.get('/confirmations', { params });
export const confirmImpact = (id, note) => api.post(`/confirmations/${id}/confirm`, { note });
export const markAsUnaffected = (id, note) => api.post(`/confirmations/${id}/unaffected`, { note });
export const exportUnconfirmed = () => api.get('/export/unconfirmed', { responseType: 'blob' });

export default api;
