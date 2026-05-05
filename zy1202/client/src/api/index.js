import axios from 'axios';

const API_BASE_URL = '/api';

const api = {
  experiments: {
    getAll: async () => {
      const response = await axios.get(`${API_BASE_URL}/experiments`);
      return response.data;
    },
    
    create: async (config) => {
      const response = await axios.post(`${API_BASE_URL}/experiments`, config);
      return response.data;
    },
    
    getById: async (id) => {
      const response = await axios.get(`${API_BASE_URL}/experiments/${id}`);
      return response.data;
    },
    
    update: async (id, updates) => {
      const response = await axios.put(`${API_BASE_URL}/experiments/${id}`, updates);
      return response.data;
    },
    
    delete: async (id) => {
      const response = await axios.delete(`${API_BASE_URL}/experiments/${id}`);
      return response.data;
    },
    
    reset: async (id) => {
      const response = await axios.post(`${API_BASE_URL}/experiments/${id}/reset`);
      return response.data;
    }
  },
  
  simulations: {
    run: async (id) => {
      const response = await axios.post(`${API_BASE_URL}/simulations/${id}/run`);
      return response.data;
    },
    
    getResults: async (id) => {
      const response = await axios.get(`${API_BASE_URL}/simulations/${id}/results`);
      return response.data;
    },
    
    getStats: async (id) => {
      const response = await axios.get(`${API_BASE_URL}/simulations/${id}/stats`);
      return response.data;
    },
    
    getRisks: async (id) => {
      const response = await axios.get(`${API_BASE_URL}/simulations/${id}/risks`);
      return response.data;
    },
    
    getEvents: async (id, params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      const url = `${API_BASE_URL}/simulations/${id}/events${queryString ? `?${queryString}` : ''}`;
      const response = await axios.get(url);
      return response.data;
    },
    
    setTrafficPlan: async (id, trafficPlan) => {
      const response = await axios.post(`${API_BASE_URL}/simulations/${id}/traffic`, { trafficPlan });
      return response.data;
    }
  },
  
  reports: {
    getJSON: async (id) => {
      const response = await axios.get(`${API_BASE_URL}/reports/${id}/json`);
      return response.data;
    },
    
    getMarkdown: async (id) => {
      const response = await axios.get(`${API_BASE_URL}/reports/${id}/markdown`);
      return response.data;
    },
    
    getPreview: async (id) => {
      const response = await axios.get(`${API_BASE_URL}/reports/${id}/preview`);
      return response.data;
    },
    
    downloadJSON: async (id) => {
      const response = await axios.post(`${API_BASE_URL}/reports/${id}/download/json`, {}, {
        responseType: 'blob'
      });
      return response.data;
    },
    
    downloadMarkdown: async (id) => {
      const response = await axios.post(`${API_BASE_URL}/reports/${id}/download/markdown`, {}, {
        responseType: 'blob'
      });
      return response.data;
    }
  }
};

export default api;
