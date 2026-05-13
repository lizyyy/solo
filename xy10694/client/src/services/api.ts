import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const workOrderAPI = {
  create: (data: any) => api.post('/work-orders', data),
  list: (params?: any) => api.get('/work-orders', { params }),
  getById: (id: string) => api.get(`/work-orders/${id}`),
  getLogs: (id: string) => api.get(`/work-orders/${id}/logs`),
  process: (id: string, data: any) => api.post(`/work-orders/${id}/process`, data),
  complete: (id: string, data: any) => api.post(`/work-orders/${id}/complete`, data),
  review: (id: string, data: any) => api.post(`/work-orders/${id}/review`, data),
  getDissatisfactionStats: (params?: any) => api.get('/work-orders/stats/dissatisfaction', { params })
};

export const exportAPI = {
  exportWorkOrders: (data: any) => api.post('/export/work-orders', data, { responseType: 'blob' })
};

export const masterDataAPI = {
  getProblemTypes: () => api.get('/master/problem-types'),
  createProblemType: (data: any) => api.post('/master/problem-types', data),
  getGridWorkers: () => api.get('/master/grid-workers'),
  createGridWorker: (data: any) => api.post('/master/grid-workers', data),
  getResponsibleUnits: () => api.get('/master/responsible-units'),
  createResponsibleUnit: (data: any) => api.post('/master/responsible-units', data)
};

export default api;
