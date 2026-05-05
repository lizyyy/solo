import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
    return response;
  },
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

const apiService = {
  get: (url, config) => api.get(url, config),
  post: (url, data, config) => api.post(url, data, config),
  put: (url, data, config) => api.put(url, data, config),
  delete: (url, config) => api.delete(url, config),
  
  uploadFile: (url, formData, onUploadProgress) => {
    return api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: onUploadProgress
        ? (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onUploadProgress(percentCompleted);
          }
        : undefined,
    });
  },

  downloadFile: (url, params) => {
    return api.get(url, {
      params,
      responseType: 'blob',
    });
  },

  sensor: {
    upload: (formData, onProgress) => 
      apiService.uploadFile('/sensors/upload', formData, onProgress),
    getAll: (params) => apiService.get('/sensors', { params }),
    getCabins: () => apiService.get('/sensors/cabins'),
    getSummary: () => apiService.get('/sensors/summary'),
  },

  inspection: {
    upload: (formData, onProgress) => 
      apiService.uploadFile('/inspections/upload', formData, onProgress),
    getAll: (params) => apiService.get('/inspections', { params }),
    getSummary: () => apiService.get('/inspections/summary'),
  },

  alarm: {
    upload: (formData, onProgress) => 
      apiService.uploadFile('/alarms/upload', formData, onProgress),
    getAll: (params) => apiService.get('/alarms', { params }),
    getSummary: () => apiService.get('/alarms/summary'),
    acknowledge: (id, data) => apiService.put(`/alarms/${id}/acknowledge`, data),
  },

  complaint: {
    upload: (formData, onProgress) => 
      apiService.uploadFile('/complaints/upload', formData, onProgress),
    getAll: (params) => apiService.get('/complaints', { params }),
    getSummary: () => apiService.get('/complaints/summary'),
    update: (id, data) => apiService.put(`/complaints/${id}`, data),
  },

  analysis: {
    recalculate: () => apiService.post('/analysis/recalculate'),
    getAll: (params) => apiService.get('/analysis', { params }),
    getByCabin: (cabinNumber) => apiService.get(`/analysis/${cabinNumber}`),
    override: (cabinNumber, data) => 
      apiService.put(`/analysis/${cabinNumber}/override`, data),
    getStats: () => apiService.get('/analysis/summary/stats'),
  },

  export: {
    getMarkdown: (params) => 
      apiService.downloadFile('/export/markdown', params),
    getJson: (params) => 
      apiService.downloadFile('/export/json', params),
    getCabinJson: (cabinNumber) => 
      apiService.downloadFile(`/export/${cabinNumber}/json`),
  },

  sample: {
    import: () => apiService.post('/sample/import'),
    getStatus: () => apiService.get('/sample/status'),
    clear: () => apiService.post('/sample/clear'),
  },
};

export default apiService;
