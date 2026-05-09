import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { useAuthStore } from '@/stores/auth.store';

const API_BASE_URL = '/api';

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const authStore = useAuthStore.getState();
        const token = authStore.tokens?.accessToken;
        
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        if (!config.headers['X-Request-Id']) {
          config.headers['X-Request-Id'] = uuidv4();
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            return new Promise((resolve) => {
              this.refreshSubscribers.push((token) => {
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                }
                resolve(this.client(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const authStore = useAuthStore.getState();
            const refreshToken = authStore.tokens?.refreshToken;

            if (!refreshToken) {
              authStore.logout();
              return Promise.reject(error);
            }

            const response = await this.client.post('/auth/refresh', { refreshToken });
            const { accessToken, refreshToken: newRefreshToken } = response.data;

            authStore.setTokens({ accessToken, refreshToken: newRefreshToken });

            this.refreshSubscribers.forEach((callback) => callback(accessToken));
            this.refreshSubscribers = [];

            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            }

            return this.client(originalRequest);
          } catch (refreshError) {
            useAuthStore.getState().logout();
            this.refreshSubscribers = [];
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async patch<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }

  getInstance(): AxiosInstance {
    return this.client;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
