import apiClient from './client';
import type { ParameterVersion, CreateVersionRequest } from '../../shared/types';

export const versionApi = {
  getVersions: () => {
    return apiClient.get<ParameterVersion[]>('/versions');
  },

  getVersionById: (id: string) => {
    return apiClient.get<ParameterVersion>(`/versions/${id}`);
  },

  getLatestVersion: () => {
    return apiClient.get<ParameterVersion | null>('/versions/latest');
  },

  canPublish: () => {
    return apiClient.get<{ canPublish: boolean; reason?: string }>('/versions/can-publish');
  },

  createVersion: (data: CreateVersionRequest) => {
    return apiClient.post<ParameterVersion>('/versions', data);
  },

  publishVersion: (id: string) => {
    return apiClient.post<ParameterVersion>(`/versions/${id}/publish`);
  },
};
