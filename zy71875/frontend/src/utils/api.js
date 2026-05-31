import axios from 'axios';
import { message } from 'antd';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const FRIENDLY_ERRORS = {
  'NETWORK_ERROR': '网络连接失败，请检查网络是否正常，或确认后端服务是否已启动',
  'TIMEOUT': '请求超时了，请稍后再试，如果问题持续请联系管理员',
  'SERVER_ERROR': '服务器出了点小问题，请稍后再试',
  'NOT_FOUND': '找不到请求的数据，可能已被删除，请刷新页面后重试',
  'VALIDATION_ERROR': '填写的信息有问题，请检查后重试',
  'AUTH_REQUIRED': '请先登录后再操作',
  'PERMISSION_DENIED': '没有权限进行此操作，请联系管理员',
};

function getFriendlyMessage(error) {
  if (!error) return '操作失败了，请稍后再试';

  if (error.response) {
    const data = error.response.data;

    if (data && data.user_friendly_message) {
      return data.user_friendly_message;
    }

    const status = error.response.status;
    if (status === 404) return FRIENDLY_ERRORS['NOT_FOUND'];
    if (status === 401) return FRIENDLY_ERRORS['AUTH_REQUIRED'];
    if (status === 403) return FRIENDLY_ERRORS['PERMISSION_DENIED'];
    if (status >= 500) return FRIENDLY_ERRORS['SERVER_ERROR'];
    if (status === 400) {
      if (data && data.error_code === 'VALIDATION_ERROR') {
        return FRIENDLY_ERRORS['VALIDATION_ERROR'];
      }
      if (data && data.user_friendly_message) {
        return data.user_friendly_message;
      }
      return '填写的信息有问题，请检查后重试';
    }
  }

  if (error.code === 'ECONNABORTED') {
    return FRIENDLY_ERRORS['TIMEOUT'];
  }

  if (!error.response) {
    return FRIENDLY_ERRORS['NETWORK_ERROR'];
  }

  return error.message || '操作失败了，请稍后再试';
}

api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const friendlyMessage = getFriendlyMessage(error);
    error.friendlyMessage = friendlyMessage;

    if (error.config && error.config.showError !== false) {
      setTimeout(() => {
        message.error(friendlyMessage);
      }, 0);
    }

    return Promise.reject(error);
  }
);

export function showSuccess(msg) {
  message.success(msg);
}

export function showError(msg) {
  message.error(msg);
}

export function showWarning(msg) {
  message.warning(msg);
}

export function showInfo(msg) {
  message.info(msg);
}

export default api;
