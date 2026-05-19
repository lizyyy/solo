import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export const templateApi = {
  getTemplates: (params) => api.get('/templates', { params }),
  getTemplateDetail: (templateId) => api.get(`/templates/${templateId}`),
  createTemplate: (data) => api.post('/templates', data),
  createVersion: (templateId, data) => api.post(`/templates/${templateId}/versions`, data),
  submitForApproval: (templateId, data) => api.post(`/templates/${templateId}/submit`, data),
  approve: (templateId, data) => api.post(`/templates/${templateId}/approve`, data),
  reject: (templateId, data) => api.post(`/templates/${templateId}/reject`, data),
  startGray: (templateId, data) => api.post(`/templates/${templateId}/gray`, data),
  rollback: (templateId, data) => api.post(`/templates/${templateId}/rollback`, data),
  publish: (templateId) => api.post(`/templates/${templateId}/publish`),
  addEffectRecord: (templateId, data) => api.post(`/templates/${templateId}/effect`, data),
  validateVariables: (data) => api.post('/validate-variables', data),
  exportTemplates: () => {
    window.open('/api/templates/export', '_blank');
  },
  exportSingleTemplate: (templateId) => {
    window.open(`/api/templates/${templateId}/export`, '_blank');
  },
  importTemplates: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/templates/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const commonApi = {
  getScenarios: () => api.get('/scenarios'),
  getStats: () => api.get('/stats'),
};

export default api;
