import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';

class ApiClient {
  private client: AxiosInstance;
  private pendingRequests: Map<string, Promise<any>> = new Map();

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        if (!config.headers['X-Request-Id']) {
          config.headers['X-Request-Id'] = uuidv4();
        }

        return config;
      },
      (error) => Promise.reject(error),
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      },
    );
  }

  async request<T>(config: AxiosRequestConfig & { idempotent?: boolean }): Promise<T> {
    const { idempotent, ...axiosConfig } = config;

    if (idempotent && axiosConfig.method?.toUpperCase() === 'POST') {
      const requestId = axiosConfig.headers?.['X-Request-Id'] || uuidv4();

      if (this.pendingRequests.has(requestId)) {
        return this.pendingRequests.get(requestId)!;
      }

      const request = this.client
        .request<T>({ ...axiosConfig, headers: { ...axiosConfig.headers, 'X-Request-Id': requestId } })
        .then((response) => response.data)
        .finally(() => {
          this.pendingRequests.delete(requestId);
        });

      this.pendingRequests.set(requestId, request);
      return request;
    }

    const response = await this.client.request<T>(axiosConfig);
    return response.data;
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ method: 'GET', url, ...config });
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig & { idempotent?: boolean }): Promise<T> {
    return this.request<T>({ method: 'POST', url, data, ...config });
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ method: 'PUT', url, data, ...config });
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ method: 'DELETE', url, ...config });
  }

  async download(url: string, filename: string) {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api${url}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });

    if (!response.ok) {
      throw new Error('下载失败');
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  }
}

export const api = new ApiClient();
