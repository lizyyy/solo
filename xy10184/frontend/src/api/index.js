import axios from 'axios';
import { message } from 'antd';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    if (error.response?.data?.error) {
      message.error(error.response.data.error);
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users')
};

export const appealApi = {
  getList: (params) => api.get('/appeals', { params }),
  getStats: () => api.get('/appeals/stats'),
  getDetail: (id) => api.get(`/appeals/${id}`),
  create: (data) => api.post('/appeals', data),
  update: (id, data) => api.put(`/appeals/${id}`, data),
  assign: (id, operatorId) => api.post(`/appeals/${id}/assign`, { operator_id: operatorId }),
  pickup: (id) => api.post(`/appeals/${id}/pickup`),
  submitReview: (id, data) => api.post(`/appeals/${id}/submit-review`, data),
  review: (id, data) => api.post(`/appeals/${id}/review`, data),
  getConstants: () => api.get('/appeals/constants')
};

export const attachmentApi = {
  upload: (appealId, formData) => 
    api.post(`/attachments/${appealId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  download: (id) => 
    `${import.meta.env.VITE_API_BASE || ''}/api/attachments/${id}/download`,
  delete: (id) => api.delete(`/attachments/${id}`)
};

export const logApi = {
  getList: (params) => api.get('/logs', { params }),
  getConstants: () => api.get('/logs/constants')
};

export const exportApi = {
  exportAppeals: (params) => {
    const queryString = new URLSearchParams(params).toString();
    window.location.href = `/api/export/appeals?${queryString}`;
  },
  exportAppealDetail: (id) => {
    window.location.href = `/api/export/appeal/${id}`;
  },
  exportLogs: (params) => {
    const queryString = new URLSearchParams(params).toString();
    window.location.href = `/api/logs/export?${queryString}`;
  }
};

export default api;
