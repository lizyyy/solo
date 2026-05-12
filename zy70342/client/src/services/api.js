import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: {
    'X-Operator': 'admin',
  },
});

api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || '请求失败');
  },
  (error) => {
    const message = error.response?.data?.message || error.message || '网络错误';
    throw new Error(message);
  }
);

export const batchApi = {
  create: (data) => api.post('/batches', data),
  
  list: (params) => api.get('/batches', { params }),
  
  getDetail: (batchId) => api.get(`/batches/${batchId}`),
  
  getFields: (batchType) => api.get(`/batches/fields/${batchType}`),
  
  upload: (batchId, formData) => 
    api.post(`/batches/${batchId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  
  uploadPasted: (batchId, pastedContent) =>
    api.post(`/batches/${batchId}/upload`, { pastedContent }),
  
  configureMapping: (batchId, mappingConfig) =>
    api.post(`/batches/${batchId}/mapping`, { mappingConfig }),
  
  precheck: (batchId) => api.post(`/batches/${batchId}/precheck`),
  
  fixError: (batchId, errorId, fixedValue) =>
    api.post(`/batches/${batchId}/errors/${errorId}/fix`, { fixedValue }),
  
  trialImport: (batchId, fileHash) =>
    api.post(`/batches/${batchId}/trial`, { fileHash }),
  
  confirm: (batchId) => api.post(`/batches/${batchId}/confirm`),
  
  rollback: (batchId, reason) =>
    api.post(`/batches/${batchId}/rollback`, { reason }),
};

export default api;
