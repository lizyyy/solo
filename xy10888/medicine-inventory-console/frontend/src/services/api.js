import axios from 'axios';

const api = axios.create({
  baseURL: '/api/inventory',
  timeout: 10000,
});

export const inventoryApi = {
  getStatistics: () => api.get('/statistics'),
  getMedicines: (params) => api.get('/medicines', { params }),
  getMedicine: (id) => api.get(`/medicines/${id}`),
  createMedicine: (data) => api.post('/medicines', data),
  getSources: () => api.get('/sources'),
  createSource: (data) => api.post('/sources', data),
  getBatches: (params) => api.get('/batches', { params }),
  getBatch: (id) => api.get(`/batches/${id}`),
  createBatch: (data) => api.post('/batches', data),
  occupyBatch: (data) => api.post('/batches/occupy', data),
  getOccupancies: (params) => api.get('/occupancies', { params }),
  getOccupancy: (id) => api.get(`/occupancies/${id}`),
  releaseOccupancy: (id, data) => api.post(`/occupancies/${id}/release`, data),
  getDeliveries: (params) => api.get('/deliveries', { params }),
  getDelivery: (id) => api.get(`/deliveries/${id}`),
  createDelivery: (data) => api.post('/deliveries', data),
  confirmDelivery: (id, data) => api.post(`/deliveries/${id}/confirm`, data),
  getDiscrepancies: (params) => api.get('/discrepancies', { params }),
  getDiscrepancy: (id) => api.get(`/discrepancies/${id}`),
  resolveDiscrepancy: (id, data) => api.post(`/discrepancies/${id}/resolve`, data),
  getExpiryRules: () => api.get('/expiry-rules'),
  createExpiryRule: (data) => api.post('/expiry-rules', data),
  exportBatches: () => api.get('/export/batches', { responseType: 'blob' }),
  executeSync: (data) => api.post('/sync/execute', data),
  getSyncLogs: (params) => api.get('/sync/logs', { params }),
  getSyncLog: (id) => api.get(`/sync/logs/${id}`),
};

export default api;
