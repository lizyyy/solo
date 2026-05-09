import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { v4 as uuidv4 } from 'uuid';
import { useUserStore } from '@/stores/user';
import router from '@/router';
import type { ApiResponse } from '@/types';

const service: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

const pendingRequests = new Map<string, AbortController>();

const getRequestKey = (config: InternalAxiosRequestConfig) => {
  const { method, url, params, data } = config;
  return [method, url, JSON.stringify(params), JSON.stringify(data)].join('&');
};

const addPendingRequest = (config: InternalAxiosRequestConfig) => {
  const requestKey = getRequestKey(config);
  if (!pendingRequests.has(requestKey)) {
    const controller = new AbortController();
    config.signal = controller.signal;
    pendingRequests.set(requestKey, controller);
  }
};

const removePendingRequest = (config: InternalAxiosRequestConfig | AxiosRequestConfig) => {
  const requestKey = getRequestKey(config as InternalAxiosRequestConfig);
  if (pendingRequests.has(requestKey)) {
    const controller = pendingRequests.get(requestKey);
    controller?.abort();
    pendingRequests.delete(requestKey);
  }
};

service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    removePendingRequest(config);
    addPendingRequest(config);

    if (!config.headers['X-Request-Id']) {
      config.headers['X-Request-Id'] = uuidv4();
    }

    const userStore = useUserStore();
    if (userStore.token) {
      config.headers['Authorization'] = `Bearer ${userStore.token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

service.interceptors.response.use(
  (response: AxiosResponse) => {
    removePendingRequest(response.config);

    const data = response.data as ApiResponse;

    if (data.success === false) {
      ElMessage.error(data.message || '请求失败');
      return Promise.reject(new Error(data.message || '请求失败'));
    }

    return data;
  },
  async (error) => {
    removePendingRequest(error.config || {});

    if (axios.isCancel(error)) {
      return Promise.reject(new Error('请求已取消'));
    }

    const response = error.response;

    if (response) {
      const data = response.data as ApiResponse;
      const message = data.message || error.message;

      switch (response.status) {
        case 401:
          ElMessageBox.confirm('登录已过期，请重新登录', '提示', {
            confirmButtonText: '重新登录',
            cancelButtonText: '取消',
            type: 'warning',
          }).then(() => {
            const userStore = useUserStore();
            userStore.logout();
            router.push('/login');
          });
          break;

        case 403:
          ElMessage.error('没有权限执行此操作');
          break;

        case 404:
          ElMessage.error('请求的资源不存在');
          break;

        case 409:
          if (data.code === 'CONCURRENT_MODIFICATION') {
            ElMessage.error('数据已被其他用户修改，请刷新后重试');
          } else if (data.code === 'DUPLICATE_REQUEST') {
            ElMessage.warning('请勿重复提交');
          } else {
            ElMessage.error(message);
          }
          break;

        case 422:
          ElMessage.error(data.message || '数据验证失败');
          break;

        case 500:
          ElMessage.error('服务器错误，请稍后重试');
          break;

        default:
          ElMessage.error(message);
      }
    } else {
      ElMessage.error('网络错误，请检查网络连接');
    }

    return Promise.reject(error);
  }
);

export interface RequestConfig extends AxiosRequestConfig {
  showLoading?: boolean;
  showSuccess?: boolean;
  successMessage?: string;
}

export const request = {
  get<T = any>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return service.get(url, config);
  },

  post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return service.post(url, data, config);
  },

  put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return service.put(url, data, config);
  },

  delete<T = any>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return service.delete(url, config);
  },

  download(url: string, data?: any, config?: RequestConfig): Promise<void> {
    return service
      .post(url, data, {
        ...config,
        responseType: 'blob',
      })
      .then((response: any) => {
        const contentDisposition = response.headers?.['content-disposition'];
        let filename = 'download';
        if (contentDisposition) {
          const matches = contentDisposition.match(/filename\*?=UTF-8''(.+)/);
          if (matches) {
            filename = decodeURIComponent(matches[1]);
          }
        }

        const blob = new Blob([response], {
          type: response.headers?.['content-type'],
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      });
  },
};

export default service;
