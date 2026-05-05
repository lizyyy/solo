import axios from 'axios';
import type { 
  BenchmarkConfig, 
  BenchmarkResult, 
  Experiment, 
  ExperimentListItem,
  Comparison,
  ComparisonAnalysis,
  TestInfo
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 300000,
});

export const healthCheck = () => api.get('/health');

export const getTests = (): Promise<TestInfo[]> => 
  api.get('/tests').then(r => r.data);

export const listExperiments = (limit = 100, offset = 0): Promise<ExperimentListItem[]> => 
  api.get('/experiments', { params: { limit, offset } }).then(r => r.data);

export const getExperiment = (id: string): Promise<Experiment> => 
  api.get(`/experiments/${id}`).then(r => r.data);

export const createExperiment = (data: {
  name: string;
  description: string;
  config: BenchmarkConfig;
  tags?: string[];
}): Promise<Experiment> => 
  api.post('/experiments', data).then(r => r.data);

export const runExperiment = (id: string): Promise<{
  status: string;
  experiment_id: string;
  result: BenchmarkResult;
}> => 
  api.post(`/experiments/${id}/run`).then(r => r.data);

export const runExperimentAsync = (id: string): Promise<{
  status: string;
  experiment_id: string;
  message: string;
}> => 
  api.post(`/experiments/${id}/run-async`).then(r => r.data);

export const getExperimentStatus = (id: string): Promise<{
  status: string;
  result?: BenchmarkResult;
}> => 
  api.get(`/experiments/${id}/status`).then(r => r.data);

export const deleteExperiment = (id: string) => 
  api.delete(`/experiments/${id}`).then(r => r.data);

export const listComparisons = (): Promise<Comparison[]> => 
  api.get('/comparisons').then(r => r.data);

export const getComparison = (id: string): Promise<Comparison> => 
  api.get(`/comparisons/${id}`).then(r => r.data);

export const createComparison = (data: {
  name: string;
  experiment_ids: string[];
  metrics?: string[];
  notes?: string;
}): Promise<Comparison> => 
  api.post('/comparisons', data).then(r => r.data);

export const analyzeComparison = (id: string): Promise<ComparisonAnalysis> => 
  api.get(`/comparisons/${id}/analyze`).then(r => r.data);

export const quickRun = (config: Partial<BenchmarkConfig> & { test_name: string }): Promise<{
  status: string;
  result: BenchmarkResult;
}> => 
  api.post('/quick-run', config).then(r => r.data);

export const exportExperimentMarkdown = (id: string) => 
  `/api/experiments/${id}/report/markdown`;

export const exportExperimentJson = (id: string) => 
  `/api/experiments/${id}/report/json`;

export const exportComparisonMarkdown = (id: string) => 
  `/api/comparisons/${id}/report/markdown`;

export const importWorkload = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/workload/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data);
};

export default api;
