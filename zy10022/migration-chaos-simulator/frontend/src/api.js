import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080/api/v1';

const api = axios.create({ baseURL: API_BASE });

export const health = () => api.get('/health');
export const getStats = () => api.get('/stats');

export const getChaosTypes = () => api.get('/chaos/types');
export const listExperiments = () => api.get('/chaos/experiments');
export const getExperiment = (id) => api.get(`/chaos/experiments/${id}`);
export const startExperiment = (data) => api.post('/chaos/experiments', data);
export const stopExperiment = (id) => api.post(`/chaos/experiments/${id}/stop`);
export const getChaosReport = (id) => api.get(`/chaos/experiments/${id}/report`);

export const getMigrationTemplates = () => api.get('/migrations/templates');
export const planMigration = (data) => api.post('/migrations/plan', data);
export const executeMigration = (data) => api.post('/migrations/execute', data);
export const dryRunMigration = (data) => api.post('/migrations/dry-run', data);
export const getMigration = (id) => api.get(`/migrations/${id}`);
export const getMigrationReport = (id) => api.get(`/migrations/${id}/report`);

export const exportReport = (params) => 
  api.get('/reports/export', { params, responseType: 'blob' });

export const connectWebSocket = (onMessage) => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.hostname}:8080/api/v1/ws/events`;
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error('WebSocket parse error:', e);
    }
  };

  ws.onerror = (error) => console.error('WebSocket error:', error);

  return ws;
};

export default api;
