import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 门店回收API
export const storeCollectionAPI = {
  list: (params) => api.get('/store-collections', { params }),
  detail: (id) => api.get(`/store-collections/${id}`),
  create: (data) => api.post('/store-collections', data),
  update: (id, data) => api.put(`/store-collections/${id}`, data),
  review: (id, data) => api.post(`/store-collections/${id}/review`, data)
};

// 导出API
export const exportAPI = {
  exportDepositReport: (data) =>
    api.post('/export/deposit-report', data, {
      responseType: 'blob'
    }),
  exportSupplierHandoverReport: (data) =>
    api.post('/export/supplier-handover-report', data, {
      responseType: 'blob'
    }),
  exportDepositFlowReport: (data) =>
    api.post('/export/deposit-flow-report', data, {
      responseType: 'blob'
    })
};

// 日志API
export const logAPI = {
  getOperationLogs: (params) => api.get('/logs/operations', { params }),
  getModificationHistory: (params) => api.get('/logs/modifications', { params })
};

export const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(new Blob([blob]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export default api;
