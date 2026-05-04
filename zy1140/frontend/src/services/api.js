import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const healthApi = {
  getStatus: () => api.get('/status'),
  getHealth: () => api.get('/health'),
};

export const importApi = {
  uploadFile: (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: onProgress,
    });
  },
  uploadMultiple: (files) => {
    const formData = new FormData();
    files.forEach((file, i) => {
      formData.append('files', file);
    });
    return api.post('/import/multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getHistory: (limit = 20, offset = 0) => 
    api.get(`/import/history?limit=${limit}&offset=${offset}`),
};

export const dataApi = {
  getSummary: (startDate, endDate) => 
    api.get(`/data/summary?startDate=${startDate}&endDate=${endDate}`),
  
  getDaily: (date) => 
    api.get(`/data/daily/${date}`),
  
  getWorkouts: (startDate, endDate, type, limit = 50, offset = 0) => {
    let url = `/data/workouts?limit=${limit}&offset=${offset}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    if (type) url += `&type=${type}`;
    return api.get(url);
  },
  
  getWorkout: (id) => 
    api.get(`/data/workouts/${id}`),
  
  getCalendarHeatmap: (startDate, endDate, metric = 'stepsTotal') => 
    api.get(`/data/calendar-heatmap?startDate=${startDate}&endDate=${endDate}&metric=${metric}`),
  
  getMetrics: (type, startDate, endDate, aggregate = 'daily') => {
    let url = `/data/metrics?type=${type}&aggregate=${aggregate}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    return api.get(url);
  },
  
  getAvailableTypes: () => 
    api.get('/data/available-types'),
};

export const notesApi = {
  getAll: (startDate, endDate) => {
    let url = '/notes';
    if (startDate) url += `?startDate=${startDate}`;
    if (endDate) url += (startDate ? '&' : '?') + `endDate=${endDate}`;
    return api.get(url);
  },
  
  getByDate: (date) => 
    api.get(`/notes/${date}`),
  
  save: (date, data) => 
    api.post(`/notes/${date}`, data),
  
  updateTags: (date, tags, action = 'add') => 
    api.put(`/notes/${date}/tags`, { tags, action }),
  
  delete: (date) => 
    api.delete(`/notes/${date}`),
  
  getTagStats: () => 
    api.get('/notes/tags/stats'),
};

export const thresholdsApi = {
  getAll: (category) => {
    let url = '/thresholds';
    if (category) url += `?category=${category}`;
    return api.get(url);
  },
  
  get: (category, key) => 
    api.get(`/thresholds/${category}/${key}`),
  
  save: (category, key, data) => 
    api.post(`/thresholds/${category}/${key}`, data),
  
  saveBatch: (thresholds) => 
    api.put('/thresholds/batch', { thresholds }),
  
  delete: (category, key) => 
    api.delete(`/thresholds/${category}/${key}`),
  
  reset: (categories) => 
    api.post('/thresholds/reset', { categories }),
};

export const anomaliesApi = {
  getAll: (startDate, endDate, includeDismissed = false) => {
    let url = `/anomalies?startDate=${startDate}&endDate=${endDate}&includeDismissed=${includeDismissed}`;
    return api.get(url);
  },
  
  detect: (startDate, endDate, force = false) => 
    api.post('/anomalies/detect', { startDate, endDate, force }),
  
  dismiss: (id) => 
    api.put(`/anomalies/${id}/dismiss`),
  
  getTypes: () => 
    api.get('/anomalies/types'),
  
  getStats: (startDate, endDate) => {
    let url = '/anomalies/stats';
    if (startDate) url += `?startDate=${startDate}`;
    if (endDate) url += (startDate ? '&' : '?') + `endDate=${endDate}`;
    return api.get(url);
  },
};

export const reportApi = {
  generate: (startDate, endDate, format = 'json', include = 'all') => 
    api.get(`/report/generate?startDate=${startDate}&endDate=${endDate}&format=${format}&include=${include}`, {
      responseType: format === 'json' ? 'json' : 'blob',
    }),
  
  downloadReport: (startDate, endDate, format) => 
    api.get(`/report/generate?startDate=${startDate}&endDate=${endDate}&format=${format}`, {
      responseType: 'blob',
    }),
};

export default api;
