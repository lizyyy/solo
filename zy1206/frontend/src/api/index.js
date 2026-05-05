import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success) {
      return response.data;
    }
    return Promise.reject(new Error(response.data?.error || '请求失败'));
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const experimentApi = {
  getAll: () => api.get('/experiments'),
  getById: (id) => api.get(`/experiments/${id}`),
  create: (data) => api.post('/experiments', data),
  getNodes: (experimentId) => api.get(`/experiments/${experimentId}/nodes`),
  createNode: (experimentId, data) => api.post(`/experiments/${experimentId}/nodes`, data),
  updateNodeStatus: (experimentId, nodeId, status) => 
    api.put(`/experiments/${experimentId}/nodes/${nodeId}/status`, { status }),
  createPartition: (experimentId, data) => 
    api.post(`/experiments/${experimentId}/partitions`, data),
  isolatePartition: (experimentId, partitionId) => 
    api.post(`/experiments/${experimentId}/partitions/${partitionId}/isolate`),
  restorePartition: (experimentId, partitionId) => 
    api.post(`/experiments/${experimentId}/partitions/${partitionId}/restore`),
  simulateWrite: (experimentId, data) => 
    api.post(`/experiments/${experimentId}/write`, data),
  simulateLeaderFailure: (experimentId) => 
    api.post(`/experiments/${experimentId}/leader-failure`),
  acquireLock: (experimentId, data) => 
    api.post(`/experiments/${experimentId}/lock/acquire`, data),
  releaseLock: (experimentId, data) => 
    api.post(`/experiments/${experimentId}/lock/release`, data),
  simulateStaleRead: (experimentId, data) => 
    api.post(`/experiments/${experimentId}/stale-read`, data),
  getTimeline: (experimentId) => 
    api.get(`/experiments/${experimentId}/timeline`),
  getLogs: (experimentId, nodeId) => 
    api.get(`/experiments/${experimentId}/logs${nodeId ? `?nodeId=${nodeId}` : ''}`),
  getReport: (experimentId, format = 'json') => 
    api.get(`/experiments/${experimentId}/report?format=${format}`),
};

export default api;
