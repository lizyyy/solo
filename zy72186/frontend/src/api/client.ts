import axios from 'axios';
import type { Sample, ReviewReport, ReviewRecord, ReviewDecision, DuplicateGroup, ApiResponse } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const sampleApi = {
  async getSamples(status?: string, includeDuplicates = true): Promise<Sample[]> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    params.includeDuplicates = String(includeDuplicates);
    
    const response = await api.get<ApiResponse<Sample[]>>('/samples', { params });
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data || [];
  },

  async getSampleById(id: string): Promise<Sample> {
    const response = await api.get<ApiResponse<Sample>>(`/samples/${id}`);
    if (!response.data.success) throw new Error(response.data.error);
    if (!response.data.data) throw new Error('Sample not found');
    return response.data.data;
  },

  async getDuplicateGroups(): Promise<DuplicateGroup[]> {
    const response = await api.get<ApiResponse<DuplicateGroup[]>>('/samples/duplicates');
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data || [];
  },

  async reviewSample(
    id: string,
    data: {
      decision: ReviewDecision;
      evidence: string;
      comments?: string;
      reviewer: string;
    }
  ): Promise<{ reviewRecord: ReviewRecord; updatedSample: Sample }> {
    const response = await api.post<ApiResponse<{ reviewRecord: ReviewRecord; updatedSample: Sample }>>(
      `/samples/${id}/review`,
      data
    );
    if (!response.data.success) throw new Error(response.data.error);
    if (!response.data.data) throw new Error('Failed to submit review');
    return response.data.data;
  },

  async resolveDuplicate(id: string, keepOriginal = true): Promise<void> {
    const response = await api.post<ApiResponse<void>>(`/samples/${id}/resolve-duplicate`, {
      keepOriginal,
    });
    if (!response.data.success) throw new Error(response.data.error);
  },

  async getSampleHistory(id: string): Promise<ReviewRecord[]> {
    const response = await api.get<ApiResponse<ReviewRecord[]>>(`/samples/${id}/history`);
    if (!response.data.success) throw new Error(response.data.error);
    return response.data.data || [];
  },
};

export const reportApi = {
  async getReport(): Promise<ReviewReport> {
    const response = await api.get<ApiResponse<ReviewReport>>('/report');
    if (!response.data.success) throw new Error(response.data.error);
    if (!response.data.data) throw new Error('Failed to get report');
    return response.data.data;
  },

  async exportReport(): Promise<void> {
    const response = await api.get('/report/export', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `review-report-${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};

export const adminApi = {
  async resetDatabase(): Promise<void> {
    const response = await api.post<ApiResponse<void>>('/admin/reset');
    if (!response.data.success) throw new Error(response.data.error);
  },

  async healthCheck(): Promise<{ status: string; sampleCount: number; reviewCount: number }> {
    const response = await api.get<ApiResponse<{ status: string; sampleCount: number; reviewCount: number }>>('/admin/health');
    if (!response.data.success) throw new Error(response.data.error);
    if (!response.data.data) throw new Error('Health check failed');
    return response.data.data;
  },
};
