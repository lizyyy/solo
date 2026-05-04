import axios from 'axios';
import { ExperimentConfig, ExperimentResult, BPlusTreeVisualization, HashVisualization } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const indexApi = {
  healthCheck: async (): Promise<{ status: string; timestamp: number }> => {
    const response = await apiClient.get('/health');
    return response.data;
  },

  getDefaultTemplate: async (): Promise<ExperimentConfig> => {
    const response = await apiClient.get('/templates/default');
    return response.data.config;
  },

  createExperiment: async (config: ExperimentConfig): Promise<{
    success: boolean;
    experimentId: string;
    message: string;
    stats: {
      tableRows: number;
      bplusTree: any;
      hashIndex: any;
    };
  }> => {
    const response = await apiClient.post('/experiment/create', config);
    return response.data;
  },

  runExperiment: async (experimentId: string): Promise<ExperimentResult> => {
    const response = await apiClient.post(`/experiment/${experimentId}/run`);
    return response.data.result;
  },

  runSingleQuery: async (experimentId: string, queryId: string): Promise<any> => {
    const response = await apiClient.post(`/experiment/${experimentId}/run-query`, { queryId });
    return response.data.result;
  },

  getBPlusVisualization: async (experimentId: string): Promise<BPlusTreeVisualization> => {
    const response = await apiClient.get(`/experiment/${experimentId}/visualization/bplus`);
    return response.data.visualization;
  },

  getHashVisualization: async (experimentId: string): Promise<HashVisualization> => {
    const response = await apiClient.get(`/experiment/${experimentId}/visualization/hash`);
    return response.data.visualization;
  },

  getStats: async (experimentId: string): Promise<any> => {
    const response = await apiClient.get(`/experiment/${experimentId}/stats`);
    return response.data.stats;
  },

  deleteExperiment: async (experimentId: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete(`/experiment/${experimentId}`);
    return response.data;
  },
};

export default indexApi;
