import axios from 'axios';
import { ApiResponse, Plugin, PluginVersion, AuditStatistics, ReviewResult, PermissionDeclaration, CorrectionPath } from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const pluginApi = {
  getAll: async (): Promise<ApiResponse<Plugin[]>> => {
    const response = await api.get('/plugins');
    return response.data;
  },
  
  create: async (data: { name: string; description: string; author: string; ownerId: string }): Promise<ApiResponse<Plugin>> => {
    const response = await api.post('/plugins', data);
    return response.data;
  },
};

export const versionApi = {
  getAll: async (): Promise<ApiResponse<PluginVersion[]>> => {
    const response = await api.get('/versions');
    return response.data;
  },
  
  getById: async (versionId: string): Promise<ApiResponse<any>> => {
    const response = await api.get(`/versions/${versionId}`);
    return response.data;
  },
  
  create: async (data: any): Promise<ApiResponse<PluginVersion>> => {
    const response = await api.post('/versions', data);
    return response.data;
  },
  
  submit: async (versionId: string, actor: string): Promise<ApiResponse> => {
    const response = await api.post(`/versions/${versionId}/submit`, { actor });
    return response.data;
  },
  
  retryScan: async (versionId: string, actor: string): Promise<ApiResponse> => {
    const response = await api.post(`/versions/${versionId}/retry-scan`, { actor });
    return response.data;
  },
  
  review: async (versionId: string, data: { reviewerId: string; reviewerName: string; result: ReviewResult; comment: string; actor: string }): Promise<ApiResponse> => {
    const response = await api.post(`/versions/${versionId}/review`, data);
    return response.data;
  },
  
  recheck: async (versionId: string, actor: string): Promise<ApiResponse> => {
    const response = await api.post(`/versions/${versionId}/recheck`, { actor });
    return response.data;
  },
  
  publish: async (versionId: string, actor: string): Promise<ApiResponse> => {
    const response = await api.post(`/versions/${versionId}/publish`, { actor });
    return response.data;
  },
  
  unpublish: async (versionId: string, actor: string, reason: string): Promise<ApiResponse> => {
    const response = await api.post(`/versions/${versionId}/unpublish`, { actor, reason });
    return response.data;
  },
  
  updatePermissions: async (versionId: string, permissions: PermissionDeclaration[], actor: string): Promise<ApiResponse<PermissionDeclaration[]>> => {
    const response = await api.put(`/versions/${versionId}/permissions`, { permissions, actor });
    return response.data;
  },
};

export const reviewOpinionApi = {
  correct: async (opinionId: string, data: { revisedComment: string; revisedBy: string; justification: string; versionId: string }): Promise<ApiResponse<CorrectionPath>> => {
    const response = await api.post(`/review-opinions/${opinionId}/correct`, data);
    return response.data;
  },
};

export const statisticsApi = {
  get: async (): Promise<ApiResponse<AuditStatistics>> => {
    const response = await api.get('/statistics');
    return response.data;
  },
};

export const exportApi = {
  downloadUnpublishRecords: async (): Promise<void> => {
    const response = await api.get('/export/unpublish-records', {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `unpublish-records-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};
