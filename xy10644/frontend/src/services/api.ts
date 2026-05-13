import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api'
});

export const boxApi = {
  getAll: () => api.get('/boxes'),
  create: (data: any) => api.post('/boxes', data)
};

export const logApi = {
  getAll: () => api.get('/logs'),
  getByBox: (boxId: string) => api.get(`/boxes/${boxId}/logs`)
};

export const exportApi = {
  report: (data: any) => api.post('/export/report', data, { responseType: 'blob' }),
  timeline: (boxId: string, data: any) => api.post(`/export/timeline/${boxId}`, data, { responseType: 'blob' })
};

export const signoffApi = {
  execute: (data: any) => api.post('/signoff', data),
  review: (data: any) => api.post('/signoff/review', data),
  getRecords: (boxId?: string) => api.get('/signoff-records', { params: { boxId } })
};

export const personApi = {
  getAll: () => api.get('/persons')
};

export const exchangeApi = {
  getAll: () => api.get('/exchanges')
};

export default api;
