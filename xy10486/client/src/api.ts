import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export const getProducts = () => api.get('/products');
export const getSalesHistory = (params?: any) => api.get('/sales-history', { params });
export const getStockRecords = () => api.get('/stock-records');
export const getWeatherTags = () => api.get('/weather-tags');
export const getHolidays = () => api.get('/holidays');
export const addWeatherTag = (data: any) => api.post('/weather-tags', data);
export const addHoliday = (data: any) => api.post('/holidays', data);
export const getPredictions = (targetDate?: string) => 
  api.get('/predictions', { params: { targetDate } });
export const getOrders = (params?: any) => api.get('/orders', { params });
export const createOrders = (data: any) => api.post('/orders', data);
export const receiveOrder = (id: number, data: any) => 
  api.put(`/orders/${id}/receive`, data);
export const getAdjustmentHistory = () => api.get('/adjustment-history');
export const getAlerts = () => api.get('/alerts');
export const resolveAlert = (id: number) => api.put(`/alerts/${id}/resolve`);
export const getDashboard = () => api.get('/dashboard');
export const getReview = () => api.get('/review');
export const seedData = () => api.post('/seed');

export default api;
