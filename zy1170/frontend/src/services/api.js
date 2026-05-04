import axios from 'axios';

const API_BASE_URL = '/api';

const api = {
  async healthCheck() {
    const response = await axios.get(`${API_BASE_URL}/health`);
    return response.data;
  },

  async getDatasets() {
    const response = await axios.get(`${API_BASE_URL}/datasets`);
    return response.data;
  },

  async getDataset(datasetId) {
    const response = await axios.get(`${API_BASE_URL}/datasets/${datasetId}`);
    return response.data;
  },

  async getBadSamples() {
    const response = await axios.get(`${API_BASE_URL}/bad-samples`);
    return response.data;
  },

  async getBadSample(sampleId) {
    const response = await axios.get(`${API_BASE_URL}/bad-samples/${sampleId}`);
    return response.data;
  },

  async validateParameters(config) {
    const response = await axios.post(`${API_BASE_URL}/validate`, config);
    return response.data;
  },

  async listExperiments(limit = 100) {
    const response = await axios.get(`${API_BASE_URL}/experiments`, {
      params: { limit }
    });
    return response.data;
  },

  async createExperiment(config) {
    const response = await axios.post(`${API_BASE_URL}/experiments`, config);
    return response.data;
  },

  async getExperiment(experimentId) {
    const response = await axios.get(`${API_BASE_URL}/experiments/${experimentId}`);
    return response.data;
  },

  async deleteExperiment(experimentId) {
    const response = await axios.delete(`${API_BASE_URL}/experiments/${experimentId}`);
    return response.data;
  },

  async trainStepByStep(config) {
    const response = await axios.post(`${API_BASE_URL}/train/step-by-step`, config);
    return response.data;
  },

  async trainSingleStep(config) {
    const response = await axios.post(`${API_BASE_URL}/train/single-step`, config);
    return response.data;
  },

  async forwardPass(config) {
    const response = await axios.post(`${API_BASE_URL}/forward`, config);
    return response.data;
  },

  async getMarkdownReport(experimentId) {
    const response = await axios.get(`${API_BASE_URL}/reports/${experimentId}/markdown`);
    return response.data;
  },

  async getJsonReport(experimentId) {
    const response = await axios.get(`${API_BASE_URL}/reports/${experimentId}/json`);
    return response.data;
  },

  async compareExperiments(experimentIds) {
    const response = await axios.post(`${API_BASE_URL}/compare`, {
      experiment_ids: experimentIds
    });
    return response.data;
  }
};

export default api;
