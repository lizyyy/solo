import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
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

export const dashboardAPI = {
  getOverview: () => api.get('/dashboard/overview'),
};

export const assetAPI = {
  getAll: (params) => api.get('/assets', { params }),
  getById: (id) => api.get(`/assets/${id}`),
  create: (data) => api.post('/assets', data),
  update: (id, data) => api.put(`/assets/${id}`, data),
  delete: (id) => api.delete(`/assets/${id}`),
  getStats: () => api.get('/assets/stats'),
};

export const networkAPI = {
  getIPs: (params) => api.get('/ips', { params }),
  getIPById: (id) => api.get(`/ips/${id}`),
  createIP: (data) => api.post('/ips', data),
  updateIP: (id, data) => api.put(`/ips/${id}`, data),
  deleteIP: (id) => api.delete(`/ips/${id}`),
  
  getSegments: (params) => api.get('/segments', { params }),
  getSegmentById: (id) => api.get(`/segments/${id}`),
  createSegment: (data) => api.post('/segments', data),
  
  getVLANs: (params) => api.get('/vlans', { params }),
  getVLANById: (id) => api.get(`/vlans/${id}`),
  createVLAN: (data) => api.post('/vlans', data),
  updateVLAN: (id, data) => api.put(`/vlans/${id}`, data),
  
  getSwitchPorts: (params) => api.get('/switch-ports', { params }),
  getDHCPLeases: (params) => api.get('/dhcp-leases', { params }),
};

export const alertAPI = {
  getAll: (params) => api.get('/alerts', { params }),
  getGrouped: (params) => api.get('/alerts/grouped', { params }),
  getById: (id) => api.get(`/alerts/${id}`),
  acknowledge: (id, data) => api.post(`/alerts/${id}/acknowledge`, data),
  acknowledgeGroup: (groupKey, data) => api.post(`/alerts/group/${groupKey}/acknowledge`, data),
  getStats: () => api.get('/alerts/stats'),
};

export const firewallAPI = {
  getAll: (params) => api.get('/firewall-rules', { params }),
  getById: (id) => api.get(`/firewall-rules/${id}`),
  create: (data) => api.post('/firewall-rules', data),
  update: (id, data) => api.put(`/firewall-rules/${id}`, data),
  delete: (id) => api.delete(`/firewall-rules/${id}`),
};

export const changeAPI = {
  getAll: (params) => api.get('/changes', { params }),
  getById: (id) => api.get(`/changes/${id}`),
  create: (data) => api.post('/changes', data),
  transition: (id, data) => api.post(`/changes/${id}/transition`, data),
  analyzeImpact: (data) => api.post('/changes/analyze', data),
  getStats: () => api.get('/changes/stats'),
};

export const riskAPI = {
  getAll: (params) => api.get('/risks', { params }),
  getById: (id) => api.get(`/risks/${id}`),
  runChecks: () => api.post('/risks/run-checks'),
  resolve: (id, data) => api.post(`/risks/${id}/resolve`, data),
  getStats: () => api.get('/risks/stats'),
};

export const topologyAPI = {
  getAll: (params) => api.get('/topology', { params }),
  getFullTopology: () => api.get('/topology/full'),
  getHierarchy: (assetId) => api.get(`/topology/hierarchy/${assetId}`),
  create: (data) => api.post('/topology', data),
  delete: (id) => api.delete(`/topology/${id}`),
};

export const importAPI = {
  importAssets: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/assets', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importTopology: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/topology', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importDHCPLeases: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/dhcp-leases', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importFirewallRules: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/firewall-rules', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importAlerts: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/alerts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importSegments: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/segments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importVLANs: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/vlans', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const reportAPI = {
  generate: (format) => api.get(`/reports?format=${format}`, { responseType: 'blob' }),
  getPreview: () => api.get('/reports/preview'),
};

export default api;
