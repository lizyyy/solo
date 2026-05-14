import axios from 'axios';

const api = axios.create({
  baseURL: '/api/after-sales',
  timeout: 10000,
});

export const afterSalesApi = {
  createOrder: (data: any) => api.post('/orders', data),
  getOrders: () => api.get('/orders'),
  getOrderDetail: (id: string) => api.get(`/orders/${id}`),
  startQa: (id: string, data: any) => api.post(`/orders/${id}/start-qa`, data),
  submitQa: (id: string, data: any) => api.post(`/orders/${id}/submit-qa`, data),
  startRefund: (id: string, data: any) => api.post(`/orders/${id}/start-refund`, data),
  processRefund: (id: string, data: any) => api.post(`/orders/${id}/process-refund`, data),
  startCompensation: (id: string, data: any) => api.post(`/orders/${id}/start-compensation`, data),
  processCompensation: (id: string, data: any) => api.post(`/orders/${id}/process-compensation`, data),
  correctCompensation: (id: string, data: any) => api.post(`/orders/${id}/correct-compensation`, data),
  review: (id: string, data: any) => api.post(`/orders/${id}/review`, data),
  closeOrder: (id: string, data: any) => api.post(`/orders/${id}/close`, data),
  recalculate: (id: string) => api.post(`/orders/${id}/recalculate`),
  getStatistics: () => api.get('/statistics'),
  exportLedger: () => api.get('/ledger/export', { responseType: 'blob' }),
};

export default api;