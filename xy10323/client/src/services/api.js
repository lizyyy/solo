import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
});

export const applicationApi = {
  getAll: (params = {}) => api.get('/applications', { params }),
  getById: (id) => api.get(`/applications/${id}`),
  create: (data) => api.post('/applications', data),
  update: (id, data) => api.put(`/applications/${id}`, data),
  
  addInspection: (id, data) => api.post(`/applications/${id}/inspections`, data),
  addInspectionProblem: (inspectionId, data) => api.post(`/applications/inspections/${inspectionId}/problems`, data),
  rectifyProblem: (problemId, data) => api.post(`/applications/problems/${problemId}/rectify`, data),
  
  addFee: (id, data) => api.post(`/applications/${id}/fees`, data),
  payFee: (feeId, data) => api.post(`/applications/fees/${feeId}/pay`, data),
  
  checkRefund: (id) => api.get(`/applications/${id}/refund-check`),
  calculateRefund: (id, data) => api.post(`/applications/${id}/calculate-refund`, data),
  createRefund: (id, data) => api.post(`/applications/${id}/refunds`, data),
  getRefund: (id) => api.get(`/applications/refunds/${id}`),
  
  exportExcel: (params = {}) => api.get('/applications/export/excel', {
    params,
    responseType: 'blob'
  }),
  getExportData: (params = {}) => api.get('/applications/export/data', { params })
};

export default api;
