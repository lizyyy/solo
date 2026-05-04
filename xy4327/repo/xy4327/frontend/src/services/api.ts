import axios from 'axios';
import {
  Project,
  ProjectDetail,
  Subtitle,
  DetectionResult,
  ProofreadRecord,
  SimilaritySuggestion,
  SimilarPair,
  ImportResult
} from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const projectApi = {
  getAll: async (): Promise<Project[]> => {
    const response = await api.get('/projects');
    return response.data;
  },
  
  getById: async (id: number): Promise<ProjectDetail> => {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },
  
  create: async (name: string, description: string = ''): Promise<Project> => {
    const response = await api.post('/projects', { name, description });
    return response.data;
  },
  
  update: async (id: number, name: string, description: string): Promise<void> => {
    await api.put(`/projects/${id}`, { name, description });
  },
  
  delete: async (id: number): Promise<void> => {
    await api.delete(`/projects/${id}`);
  },
};

export const importApi = {
  importSRT: async (projectId: number, file: File): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('srt', file);
    const response = await api.post(`/projects/${projectId}/import/srt`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  
  importTerms: async (projectId: number, file: File): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('terms', file);
    const response = await api.post(`/projects/${projectId}/import/terms`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  
  importSpeakers: async (projectId: number, file: File): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('speakers', file);
    const response = await api.post(`/projects/${projectId}/import/speakers`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export const subtitleApi = {
  update: async (id: number, data: {
    current_text?: string;
    speaker?: string;
    is_reviewed?: boolean;
  }): Promise<void> => {
    await api.put(`/subtitles/${id}`, data);
  },
  
  batchUpdate: async (ids: number[], data: Partial<Subtitle>): Promise<void> => {
    // 逐个更新（后端暂不支持批量）
    for (const id of ids) {
      await subtitleApi.update(id, data);
    }
  },
};

export const detectionApi = {
  detect: async (projectId: number): Promise<{ results: DetectionResult[]; count: number }> => {
    const response = await api.post(`/projects/${projectId}/detect`);
    return response.data;
  },
  
  getResults: async (projectId: number): Promise<DetectionResult[]> => {
    const response = await api.get(`/projects/${projectId}/detection-results`);
    return response.data;
  },
  
  resolve: async (resultId: number): Promise<void> => {
    await api.put(`/detection-results/${resultId}/resolve`);
  },
};

export const similarityApi = {
  suggest: async (text: string, candidates: string[], topN: number = 3): Promise<SimilaritySuggestion[]> => {
    const response = await api.post('/similarity/suggest', { text, candidates, topN });
    return response.data.suggestions;
  },
  
  checkSimilarPairs: async (projectId: number, threshold: number = 0.8): Promise<{ similarPairs: SimilarPair[]; count: number }> => {
    const response = await api.post(`/projects/${projectId}/similarity/check`, { threshold });
    return response.data;
  },
};

export const exportApi = {
  exportSRT: (projectId: number): string => {
    return `${API_BASE_URL}/projects/${projectId}/export/srt`;
  },
  
  exportMarkdown: (projectId: number): string => {
    return `${API_BASE_URL}/projects/${projectId}/export/markdown`;
  },
  
  exportJSON: (projectId: number): string => {
    return `${API_BASE_URL}/projects/${projectId}/export/json`;
  },
};

export const recordApi = {
  getByProject: async (projectId: number): Promise<ProofreadRecord[]> => {
    const response = await api.get(`/projects/${projectId}/records`);
    return response.data;
  },
};

export const healthCheck = async (): Promise<{ status: string; timestamp: string }> => {
  const response = await api.get('/health');
  return response.data;
};

export default api;