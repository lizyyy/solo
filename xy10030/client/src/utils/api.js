import axios from 'axios';
import { generateRequestId, savePendingRequest, getPendingRequest, removePendingRequest, getPendingRequests } from './requestId.js';

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

function parseData(data) {
  if (!data) return undefined;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data;
}

async function retryRequest(config, retryCount = 0) {
  try {
    const response = await api.request(config);
    const requestId = config.headers?.['X-Request-Id'];
    if (requestId) {
      removePendingRequest(requestId);
    }
    return response.data;
  } catch (error) {
    const requestId = error.config?.headers?.['X-Request-Id'];
    const method = error.config?.method?.toUpperCase();
    
    if (retryCount < MAX_RETRIES && isRetryableError(error)) {
      const delayMs = RETRY_DELAY * Math.pow(2, retryCount);
      console.warn(`请求失败，${delayMs}ms后重试 (${retryCount + 1}/${MAX_RETRIES})`);
      await delay(delayMs);
      return retryRequest(config, retryCount + 1);
    }
    
    if (requestId && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
      if (isRetryableError(error)) {
        savePendingRequest(requestId, {
          method,
          url: error.config.url,
          data: parseData(error.config.data),
          params: error.config.params,
          baseURL: error.config.baseURL
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

export async function request(config) {
  return retryRequest(config);
}

export function get(url, params = {}) {
  return request({ method: 'GET', url, params });
}

export function post(url, data = {}, headers = {}) {
  return request({ method: 'POST', url, data, headers });
}

export function put(url, data = {}, headers = {}) {
  return request({ method: 'PUT', url, data, headers });
}

export function del(url, data = {}, headers = {}) {
  return request({ method: 'DELETE', url, data, headers });
}

export async function recoverPendingRequests() {
  const pending = getPendingRequests();
  const results = [];
  
  for (const [requestId, info] of Object.entries(pending)) {
    try {
      const result = await request({
        method: info.method,
        url: info.url,
        data: info.data,
        params: info.params,
        headers: { 'X-Request-Id': requestId }
      });
      results.push({ requestId, success: true, data: result });
    } catch (error) {
      results.push({ requestId, success: false, error: error.message });
    }
  }
  
  return results;
}

export function getPendingRequestCount() {
  return Object.keys(getPendingRequests()).length;
}

export { getPendingRequests, removePendingRequest };
export default api;
