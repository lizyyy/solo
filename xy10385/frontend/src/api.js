import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default {
  getOrders: (filters = {}) => api.get('/orders', { params: filters }),
  getOrder: (id) => api.get(`/orders/${id}`),
  createOrder: (data) => api.post('/orders', data),
  updateOrder: (id, data) => api.put(`/orders/${id}`, data),
  advanceTimeline: (id, data) => api.post(`/orders/${id}/timeline`, data),
  addExamination: (id, data) => api.post(`/orders/${id}/examinations`, data),
  approveExamination: (id, data) => api.post(`/order-examinations/${id}/approve`, data),
  rejectExamination: (id, data) => api.post(`/order-examinations/${id}/reject`, data),
  getPendingApprovals: () => api.get('/approvals/pending'),
  billOrder: (id, data) => api.post(`/orders/${id}/bill`, data),
  cancelOrder: (id, data) => api.post(`/orders/${id}/cancel`, data),
  refundOrder: (id, data) => api.post(`/orders/${id}/refund`, data),
  getOrderReport: (id) => api.get(`/orders/${id}/report`),
  
  getPatients: () => api.get('/patients'),
  createPatient: (data) => api.post('/patients', data),
  
  getEscorts: () => api.get('/escorts'),
  createEscort: (data) => api.post('/escorts', data),
  getEscortSchedule: (id, params) => api.get(`/escorts/${id}/schedule`, { params }),
  
  getExaminations: () => api.get('/examinations'),
  createExamination: (data) => api.post('/examinations', data),
  
  checkSchedule: (data) => api.post('/schedules/check', data)
};
