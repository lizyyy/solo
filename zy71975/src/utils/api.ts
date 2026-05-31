import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@/types';

const BASE_URL = '';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
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
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    const data = response.data as ApiResponse;
    return response;
  },
  (error: AxiosError<ApiResponse>) => {
    if (error.response) {
      const data = error.response.data;
      if (data && data.user_friendly_message) {
        error.message = data.user_friendly_message;
      } else {
        switch (error.response.status) {
          case 400:
            error.message = '请求参数错误，请检查输入';
            break;
          case 401:
            error.message = '未授权，请重新登录';
            break;
          case 403:
            error.message = '拒绝访问，权限不足';
            break;
          case 404:
            error.message = '请求的资源不存在';
            break;
          case 500:
            error.message = '服务器内部错误，请稍后重试';
            break;
          case 502:
            error.message = '网关错误，请稍后重试';
            break;
          case 503:
            error.message = '服务不可用，请稍后重试';
            break;
          case 504:
            error.message = '网关超时，请稍后重试';
            break;
          default:
            error.message = `请求失败 (${error.response.status})`;
        }
      }
    } else if (error.request) {
      error.message = '网络连接失败，请检查网络设置';
    } else {
      error.message = '请求配置错误，请重试';
    }
    return Promise.reject(error);
  }
);

export const extractUserFriendlyMessage = (error: unknown): string => {
  if (error instanceof AxiosError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '操作失败，请重试';
};

export default api;
