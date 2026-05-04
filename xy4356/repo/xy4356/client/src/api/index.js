import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const missionApi = {
  getAll: async () => {
    const response = await api.get('/missions');
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/missions/${id}`);
    return response.data;
  },
  
  create: async (data) => {
    const response = await api.post('/missions', data);
    return response.data;
  },
  
  update: async (id, data) => {
    const response = await api.put(`/missions/${id}`, data);
    return response.data;
  },
  
  delete: async (id) => {
    const response = await api.delete(`/missions/${id}`);
    return response.data;
  },
  
  analyze: async (id, config = null) => {
    const response = await api.post(`/missions/${id}/analyze`, { config });
    return response.data;
  },
  
  overrideRisk: async (missionId, riskId, reason) => {
    const response = await api.post(`/missions/${missionId}/risk/${riskId}/override`, { reason });
    return response.data;
  },
  
  revertRisk: async (missionId, riskId) => {
    const response = await api.post(`/missions/${missionId}/risk/${riskId}/revert`);
    return response.data;
  },
  
  duplicate: async (id) => {
    const response = await api.post(`/missions/${id}/duplicate`);
    return response.data;
  },
  
  getStats: async () => {
    const response = await api.get('/missions/stats');
    return response.data;
  },
  
  search: async (query) => {
    const response = await api.get(`/missions/search?q=${encodeURIComponent(query)}`);
    return response.data;
  }
};

export const uploadApi = {
  uploadKML: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/upload/kml', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  
  uploadGeoJSON: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/upload/geojson', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  
  uploadCSV: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/upload/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }
};

export const exportApi = {
  getChecklist: async (id, format = 'json') => {
    const response = await api.get(`/export/checklist/${id}?format=${format}`);
    return response.data;
  },
  
  downloadChecklist: async (id) => {
    window.open(`${API_BASE}/export/checklist/${id}?format=download`, '_blank');
  },
  
  getAuditPackage: async (id) => {
    const response = await api.get(`/export/audit/${id}`);
    return response.data;
  },
  
  downloadAuditPackage: async (id) => {
    window.open(`${API_BASE}/export/audit/${id}?download=true`, '_blank');
  }
};

export default api;
