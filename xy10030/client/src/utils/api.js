import axios from 'axios';
import { generateRequestId, savePendingRequest, getPendingRequest, removePendingRequest } from './requestId.js';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

const RETRYABLE_ERRORS = ['NETWORK_ERROR', 'ECONNABORTED', 'ECONNREFUSED', 'TIMEOUT'];
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

function isRetryableError(error) {
  if (!error) return false;
  if (error.code && RETRYABLE_ERRORS.includes(error.code)) return true;
  if (!error.response) return true;
  if (error.response.status >= 500) return true;
  return false;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryRequest(config, retryCount = 0) {
  try {
    return await api.request(config);
  } catch (error) {
    if (retryCount < MAX_RETRIES && isRetryableError(error)) {
      const delayMs = RETRY_DELAY * Math.pow(2, retryCount);
      console.warn(`请求失败，${delayMs}ms后重试 (${retryCount + 1}/${MAX_RETRIES})`);
      await delay(delayMs);
      return retryRequest(config, retryCount + 1);
    }
    throw error;
  }
}

api.interceptors.request.use(
  (config) => {
    if (!config.headers['X-Request-Id']) {
      config.headers['X-Request-Id'] = generateRequestId();
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    const requestId = response.config.headers['X-Request-Id'];
    if (requestId) {
      removePendingRequest(requestId);
    }
    return response.data;
  },
  async (error) => {
    const requestId = error.config?.headers?.['X-Request-Id'];
    const method = error.config?.method?.toUpperCase();
    
    if (requestId && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
      if (isRetryableError(error)) {
        savePendingRequest(requestId, {
          method,
          url: error.config.url,
          data: error.config.data,
          params: error.config.params
        });
      }
    }
    
    if (error.response) {
      const data = error.response.data;
      if (data && data.error) {
        const err = new Error(data.error.message);
        err.code = data.error.code;
        err.details = data.error.details;
        throw err;
      }
    }
    
    throw error;
  }
);

export async function request(config) {
  return retryRequest(config);
}

export default api;
