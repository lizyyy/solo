import axios, { AxiosError } from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

interface ApiErrorResponse {
  success: boolean;
  code: string;
  message: string;
  detail?: string;
}

export function handleApiError(error: AxiosError): string {
  if (error.response) {
    const data = error.response.data as ApiErrorResponse;
    if (data && data.message) {
      return data.message;
    }
    
    switch (error.response.status) {
      case 400:
        return '输入信息有误，请检查后重试';
      case 404:
        return '请求的资源不存在，请刷新页面后重试';
      case 500:
        return '系统繁忙，请稍后重试。如问题持续，请联系技术支持';
      default:
        return '操作失败，请稍后重试';
    }
  } else if (error.request) {
    return '网络连接失败，请检查网络后重试';
  } else {
    return '请求配置有误，请联系技术支持';
  }
}

export default api;
