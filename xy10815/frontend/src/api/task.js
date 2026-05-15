import axios from 'axios';

const api = axios.create({
  baseURL: '/api/tasks',
  timeout: 10000
});

export const taskApi = {
  list: (params) => api.get('/', { params }),
  get: (id) => api.get(`/${id}`),
  create: (data) => api.post('/', data),
  updateStatus: (id, data) => api.put(`/${id}/status`, data),
  updateProgress: (id, data) => api.post(`/${id}/progress`, data),
  recordFailure: (id, data) => api.post(`/${id}/failure`, data),
  retry: (id) => api.post(`/${id}/retry`),
  export: (params) => api.get('/export/csv', { params, responseType: 'blob' }),
  import: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/bulk/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};
