import axios, { type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '../../shared/types';

const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
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
  (response: AxiosResponse<ApiResponse>) => {
    const res = response.data;
    if (res.success) {
      return res.data as any;
    } else {
      return Promise.reject(new Error(res.message || res.error || '请求失败'));
    }
  },
  (error) => {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || '网络错误';
    return Promise.reject(new Error(message));
  }
);

export const get = <T = any>(url: string, params?: any): Promise<T> => {
  return api.get(url, { params });
};

export const post = <T = any>(url: string, data?: any): Promise<T> => {
  return api.post(url, data);
};

export const put = <T = any>(url: string, data?: any): Promise<T> => {
  return api.put(url, data);
};

export const del = <T = any>(url: string, params?: any): Promise<T> => {
  return api.delete(url, { params });
};

export default api;
