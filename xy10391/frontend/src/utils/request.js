import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from '@/router';

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
});

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

request.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
        ElMessage.error('登录已过期，请重新登录');
      } else if (status === 403) {
        ElMessage.error('权限不足');
      } else if (status === 400) {
        ElMessage.error(data.error || '请求参数错误');
      } else if (status === 500) {
        ElMessage.error(data.error || '服务器内部错误');
      } else {
        ElMessage.error(data.error || '请求失败');
      }
    } else {
      ElMessage.error('网络错误，请检查网络连接');
    }
    
    return Promise.reject(error);
  }
);

export default request;
