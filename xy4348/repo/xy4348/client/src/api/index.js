import axios from 'axios';

const API_BASE = '/api';

// 创建axios实例
const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 批量管理
export const batchApi = {
  // 获取所有批次
  getAll: async () => {
    const response = await api.get('/batches');
    return response.data;
  },
  
  // 创建新批次
  create: async (data) => {
    const response = await api.post('/batches', data);
    return response.data;
  },
  
  // 获取批次详情
  getById: async (id) => {
    const response = await api.get(`/batches/${id}`);
    return response.data;
  },
  
  // 删除批次
  delete: async (id) => {
    const response = await api.delete(`/batches/${id}`);
    return response.data;
  },
  
  // 上传文件到批次
  uploadFiles: async (batchId, formData, onProgress) => {
    const response = await api.post(`/batches/${batchId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
    return response.data;
  },
  
  // 触发风险分析
  analyze: async (batchId) => {
    const response = await api.post(`/batches/${batchId}/analyze`);
    return response.data;
  },
  
  // 获取高风险路段
  getHighRisk: async (batchId, params = {}) => {
    const response = await api.get(`/batches/${batchId}/high-risk`, { params });
    return response.data;
  },
  
  // 获取路线
  getRoutes: async (batchId) => {
    const response = await api.get(`/batches/${batchId}/routes`);
    return response.data;
  },
  
  // 获取路段详情
  getSegmentDetails: async (batchId, segmentId) => {
    const response = await api.get(`/batches/${batchId}/segments/${segmentId}`);
    return response.data;
  },
  
  // 导出Markdown
  exportMarkdown: async (batchId) => {
    const response = await api.post(`/batches/${batchId}/export/markdown`);
    return response.data;
  },
  
  // 导出JSON
  exportJson: async (batchId) => {
    const response = await api.post(`/batches/${batchId}/export/json`);
    return response.data;
  }
};

// 路况报告管理
export const conditionApi = {
  // 人工改判
  overrule: async (conditionId, data) => {
    const response = await api.put(`/conditions/${conditionId}/overrule`, data);
    return response.data;
  }
};

// 风险类型
export const riskTypeApi = {
  getAll: async () => {
    const response = await api.get('/risk-types');
    return response.data;
  }
};

// 健康检查
export const healthApi = {
  check: async () => {
    const response = await api.get('/health');
    return response.data;
  }
};

export default api;
