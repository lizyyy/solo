import axios from 'axios';

const API_BASE = '/api';

const api = {
  getExperiments: () => {
    return axios.get(`${API_BASE}/experiments`);
  },

  getExperiment: (id) => {
    return axios.get(`${API_BASE}/experiments/${id}`);
  },

  createExperiment: (data) => {
    return axios.post(`${API_BASE}/experiments`, data);
  },

  startExperiment: (id) => {
    return axios.post(`${API_BASE}/experiments/${id}/start`);
  },

  getEvents: (id) => {
    return axios.get(`${API_BASE}/experiments/${id}/events`);
  },

  getPackets: (id) => {
    return axios.get(`${API_BASE}/experiments/${id}/packets`);
  },

  getReport: (id, format = 'json') => {
    return axios.get(`${API_BASE}/experiments/${id}/report?format=${format}`);
  },

  downloadReport: (id, format = 'markdown') => {
    const url = `${API_BASE}/experiments/${id}/report/download?format=${format}`;
    window.open(url, '_blank');
  },

  deleteExperiment: (id) => {
    return axios.delete(`${API_BASE}/experiments/${id}`);
  },

  healthCheck: () => {
    return axios.get(`${API_BASE}/health`);
  }
};

export default api;
