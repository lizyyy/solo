import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    const message = error.response?.data?.error || error.message || '网络请求失败';
    return Promise.reject(new Error(message));
  }
);

export const jobsApi = {
  getAll: (params = {}) => api.get('/jobs', { params }),
  getById: (id) => api.get(`/jobs/${id}`),
  create: (data) => api.post('/jobs', data),
  update: (id, data) => api.put(`/jobs/${id}`, data),
  delete: (id) => api.delete(`/jobs/${id}`),
  batchCreate: (data) => api.post('/jobs/batch', data)
};

export const workersApi = {
  getAll: (params = {}) => api.get('/workers', { params }),
  getById: (id) => api.get(`/workers/${id}`),
  create: (data) => api.post('/workers', data),
  update: (id, data) => api.put(`/workers/${id}`, data),
  delete: (id) => api.delete(`/workers/${id}`),
  batchCreate: (data) => api.post('/workers/batch', data)
};

export const plansApi = {
  getAll: (params = {}) => api.get('/plans', { params }),
  getById: (id) => api.get(`/plans/${id}`),
  getActive: () => api.get('/plans/active'),
  create: (data) => api.post('/plans', data),
  update: (id, data) => api.put(`/plans/${id}`, data),
  delete: (id) => api.delete(`/plans/${id}`),
  activate: (id) => api.put(`/plans/${id}/activate`),
  getVersions: (id) => api.get(`/plans/${id}/versions`),
  getVersion: (id, versionNumber) => api.get(`/plans/${id}/versions/${versionNumber}`),
  compare: (planIds) => api.post('/plans/compare', { planIds })
};

export const optimizeApi = {
  optimize: (data) => api.post('/optimize', data),
  reoptimizeRoute: (data) => api.post('/optimize/reoptimize-route', data),
  recalculateEta: (data) => api.post('/optimize/recalculate-eta', data),
  moveJob: (data) => api.post('/optimize/move-job', data),
  addJob: (data) => api.post('/optimize/add-job', data)
};

export const importApi = {
  importJobs: (formData, options = {}) => {
    if (options.clearExisting) {
      formData.append('clearExisting', 'true');
    }
    return api.post('/import/jobs', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  importWorkers: (formData, options = {}) => {
    if (options.clearExisting) {
      formData.append('clearExisting', 'true');
    }
    return api.post('/import/workers', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  importTravelTimes: (formData) => 
    api.post('/import/travel-times', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  importRoadRules: (formData) => 
    api.post('/import/road-rules', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
};

export const exportApi = {
  getDispatchTable: (planId, format = 'json') => 
    api.get(`/export/plan/${planId}/dispatch-table?format=${format}`, {
      responseType: format === 'csv' ? 'blob' : 'json'
    }),
  getReport: (planId, format = 'json') => 
    api.get(`/export/plan/${planId}/report?format=${format}`, {
      responseType: ['html', 'markdown', 'csv'].includes(format) ? 'blob' : 'json'
    })
};

export const systemApi = {
  health: () => api.get('/health'),
  stats: () => api.get('/stats'),
  sampleData: () => api.get('/sample-data')
};

export default api;
