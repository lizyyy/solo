import axios from 'axios';
import { message } from 'antd';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = '';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const { token } = useAuthStore.getState();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    const { data } = response;
    if (data && data.success === false) {
      message.error(data.message || '请求失败');
      return Promise.reject(new Error(data.message));
    }
    return response;
  },
  (error) => {
    const { response } = error;

    if (response) {
      const { status, data } = response;

      if (status === 401) {
        useAuthStore.getState().logout();
        message.error('登录已过期，请重新登录');
        window.location.href = '/login';
      } else if (status === 403) {
        message.error(data?.message || '权限不足');
      } else if (status === 404) {
        message.error(data?.message || '资源不存在');
      } else if (status === 400) {
        if (data?.errors) {
          const messages = Object.values(data.errors).flat();
          message.error(messages.join('\n'));
        } else {
          message.error(data?.message || '请求参数错误');
        }
      } else if (status >= 500) {
        message.error('服务器错误，请稍后重试');
      }
    } else {
      message.error('网络错误，请检查网络连接');
    }

    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }),
  register: (data) => api.post('/api/auth/register', data),
  getProfile: () => api.get('/api/auth/profile'),
  getUsers: () => api.get('/api/auth/users'),
  updateUserRole: (id, role) =>
    api.put(`/api/auth/users/${id}/role`, { role })
};

export const activityApi = {
  list: (params) => api.get('/api/activities', { params }),
  get: (id) => api.get(`/api/activities/${id}`),
  create: (data) => api.post('/api/activities', data),
  update: (id, data) => api.put(`/api/activities/${id}`, data),
  updateStatus: (id, status) =>
    api.put(`/api/activities/${id}/status`, { status }),
  delete: (id) => api.delete(`/api/activities/${id}`),
  statistics: () => api.get('/api/activities/statistics')
};

export const registrationApi = {
  list: (params) => api.get('/api/registrations', { params }),
  get: (id) => api.get(`/api/registrations/${id}`),
  create: (data) => api.post('/api/registrations', data),
  update: (id, data) => api.put(`/api/registrations/${id}`, data),
  updateStatus: (id, status, reason) =>
    api.put(`/api/registrations/${id}/status`, { status, reason }),
  batchUpdateStatus: (ids, newStatus, reason) =>
    api.post('/api/registrations/batch/status', { ids, newStatus, reason }),
  delete: (id) => api.delete(`/api/registrations/${id}`),
  statistics: (activityId) =>
    api.get('/api/registrations/statistics', {
      params: activityId ? { activityId } : {}
    })
};

export const importExportApi = {
  import: (file, activityId, onUploadProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('activityId', activityId);

    return api.post('/api/import-export/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress
    });
  },
  export: (params) =>
    api.get('/api/import-export/export', {
      params,
      responseType: 'blob'
    }),
  getImportHistory: () => api.get('/api/import-export/import/history'),
  retryImport: (batchId) =>
    api.post(`/api/import-export/import/${batchId}/retry`)
};

export default api;
