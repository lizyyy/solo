import { message } from 'antd';
import { useAuthStore } from '../store/authStore';

const API_BASE = '/api';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  isFormData?: boolean;
}

export async function api<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, isFormData = false } = options;
  const token = useAuthStore.getState().token;

  const config: RequestInit = {
    method,
    headers: {
      ...headers,
    },
  };

  if (token) {
    config.headers!['Authorization'] = `Bearer ${token}`;
  }

  if (body) {
    if (isFormData) {
      config.body = body;
    } else {
      config.headers!['Content-Type'] = 'application/json';
      config.body = JSON.stringify(body);
    }
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        useAuthStore.getState().logout();
        message.error('登录已过期，请重新登录');
        window.location.href = '/login';
      } else if (data.errorCode === 'PERMISSION_DENIED') {
        message.error({
          content: data.message || '权限不足',
          duration: 5,
        });
        console.warn('权限拦截记录:', data.auditLogId);
      } else {
        message.error(data.error || data.message || '请求失败');
      }
      throw new Error(data.error || data.message || '请求失败');
    }

    return data as T;
  } catch (error) {
    if (error instanceof Error && error.message === 'Failed to fetch') {
      message.error('网络连接失败，请检查服务器');
    }
    throw error;
  }
}

export const apiClient = {
  get: <T = any>(endpoint: string) => api<T>(endpoint),
  
  post: <T = any>(endpoint: string, body?: any) =>
    api<T>(endpoint, { method: 'POST', body }),
  
  postFormData: <T = any>(endpoint: string, body: FormData) =>
    api<T>(endpoint, { method: 'POST', body, isFormData: true }),
};
