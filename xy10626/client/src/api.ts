import axios from 'axios';

const api = axios.create({
  baseURL: '/api/waitlist',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const waitlistApi = {
  getList: (params?: any) => api.get('/', { params }),
  getInventory: () => api.get('/inventory'),
  getAnomalies: () => api.get('/anomalies'),
  getSeats: (id: string) => api.get(`/${id}/seats`),
  lock: (id: string, operator: string) => api.post(`/${id}/lock`, { operator }),
  unlock: (id: string, operator: string) => api.post(`/${id}/unlock`, { operator }),
  confirm: (id: string, operator: string, seatNumbers: string[]) =>
    api.post(`/${id}/confirm`, { operator, seatNumbers }),
  pay: (id: string, operator: string) => api.post(`/${id}/pay`, { operator }),
  cancel: (id: string, operator: string, needReview?: boolean) =>
    api.post(`/${id}/cancel`, { operator, needReview }),
  modifySeats: (id: string, operator: string, seatNumbers: string[]) =>
    api.post(`/${id}/modify-seats`, { operator, seatNumbers }),
  getRecords: (params?: any) => api.get('/records/list', { params }),
  reviewRecord: (id: string, operator: string, approved: boolean) =>
    api.post(`/records/${id}/review`, { operator, approved }),
  exportReport: (params?: any) => api.get('/export/report', { params })
};

export default api;
