import axios from 'axios';
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});
api.interceptors.request.use(
  (config) => {
    if (!config.headers['X-Request-ID']) {
      config.headers['X-Request-ID'] = 'req-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
export default api;
