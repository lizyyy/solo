import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// 文件上传相关
export const fileApi = {
  upload: (file, incidentId) => {
    const formData = new FormData();
    formData.append('file', file);
    if (incidentId) {
      formData.append('incidentId', incidentId);
    }
    return api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  uploadMultiple: (files, incidentId) => {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append(`files`, file);
    });
    if (incidentId) {
      formData.append('incidentId', incidentId);
    }
    return api.post('/files/upload/batch', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getByIncidentId: (incidentId) => {
    return api.get(`/files/incident/${incidentId}`);
  },
  getSupportedTypes: () => {
    return api.get('/files/supported-types');
  },
};

// 事故相关
export const incidentApi = {
  getAll: (params = {}) => {
    return api.get('/incidents', { params });
  },
  getById: (id) => {
    return api.get(`/incidents/${id}`);
  },
  create: (data) => {
    return api.post('/incidents', data);
  },
  update: (id, data) => {
    return api.put(`/incidents/${id}`, data);
  },
  delete: (id) => {
    return api.delete(`/incidents/${id}`);
  },
  updateSuggestion: (id, suggestion) => {
    return api.put(`/incidents/${id}/suggestion`, { suggestion });
  },
  analyze: (id) => {
    return api.get(`/incidents/${id}/analyze`);
  },
  exportMarkdown: (id) => {
    return api.get(`/incidents/${id}/export/markdown`, {
      responseType: 'blob',
    });
  },
  exportJson: (id) => {
    return api.get(`/incidents/${id}/export/json`, {
      responseType: 'blob',
    });
  },
};

// 性能指标相关
export const metricApi = {
  getCpuHotSpots: (incidentId, severity) => {
    const params = severity ? { severity } : {};
    return api.get(`/incidents/${incidentId}/cpu-hotspots`, { params });
  },
  getHeapGrowths: (incidentId) => {
    return api.get(`/incidents/${incidentId}/heap-growths`);
  },
  getGcPauses: (incidentId) => {
    return api.get(`/incidents/${incidentId}/gc-pauses`);
  },
  getLockWaits: (incidentId) => {
    return api.get(`/incidents/${incidentId}/lock-waits`);
  },
  getIoBlocks: (incidentId) => {
    return api.get(`/incidents/${incidentId}/io-blocks`);
  },
  getNetworkRtts: (incidentId) => {
    return api.get(`/incidents/${incidentId}/network-rtts`);
  },
  getSlowRequests: (incidentId) => {
    return api.get(`/incidents/${incidentId}/slow-requests`);
  },
  getEvidenceFragments: (incidentId, keyOnly) => {
    const params = keyOnly ? { keyOnly } : {};
    return api.get(`/incidents/${incidentId}/evidence-fragments`, { params });
  },
};

// 工具函数
export const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export default api;
