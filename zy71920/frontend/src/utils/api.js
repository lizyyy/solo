import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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

export const artworkAPI = {
  getAll: (params = {}) => api.get('/artworks/', { params }),
  get: (id) => api.get(`/artworks/${id}`),
  create: (data) => api.post('/artworks/', data),
  update: (id, data) => api.put(`/artworks/${id}`, data),
  delete: (id) => api.delete(`/artworks/${id}`),
  getHistory: (id) => api.get(`/artworks/${id}/history`),
  confirm: (data) => api.post('/artworks/confirm', data),
  import: (formData, onProgress) => 
    api.post('/artworks/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    }),
  export: (params) => 
    api.post('/artworks/export', null, { 
      params,
      responseType: 'blob' 
    }),
  getImportSessions: () => api.get('/artworks/import/sessions'),
};

export const lightingAPI = {
  get: (artworkId) => api.get(`/artworks/${artworkId}/lighting`),
  create: (artworkId, data) => api.post(`/artworks/${artworkId}/lighting`, data),
  update: (id, data) => api.put(`/artworks/lighting/${id}`, data),
  lock: (id) => api.post(`/artworks/lighting/${id}/lock`),
  unlock: (id) => api.post(`/artworks/lighting/${id}/unlock`),
};

export default api;
