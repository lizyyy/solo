import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export const sampleApi = {
  getSamples: (params) => api.get('/samples', { params }),
  getSample: (id) => api.get(`/samples/${id}`),
  createSample: (data) => api.post('/samples', data),
  uploadSamples: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/samples/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  processSample: (id, config) => api.post(`/samples/${id}/process`, config),
  retrySample: (id) => api.post(`/samples/${id}/retry`),
  deleteSample: (id) => api.delete(`/samples/${id}`),
};

export const maskingApi = {
  preview: (value, config) => api.post('/masking/preview', null, {
    params: { value },
    data: config,
  }),
  getStrategies: () => api.get('/masking/strategies'),
};

export const approvalApi = {
  getApprovals: () => api.get('/approval'),
  processApproval: (sampleId, data) => api.post(`/approval/${sampleId}`, null, { params: data }),
  getSampleApprovals: (sampleId) => api.get(`/approval/sample/${sampleId}`),
};

export const complianceApi = {
  getRecords: (params) => api.get('/compliance', { params }),
  getRecord: (id) => api.get(`/compliance/${id}`),
  getSampleRecords: (sampleId) => api.get(`/compliance/sample/${sampleId}`),
  exportExcel: () => api.get('/compliance/export/excel', { responseType: 'blob' }),
};

export default api;
