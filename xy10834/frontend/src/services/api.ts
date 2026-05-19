import axios from 'axios';
import {
  ConfigItem,
  ServiceInstance,
  DistributionVersion,
  PullRecord,
  DiffReport,
  Statistics,
  ApiResponse,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const overviewApi = {
  getStatistics: () =>
    api.get<ApiResponse<Statistics>>('/overview/statistics'),
  getRecentActivity: (limit?: number) =>
    api.get<ApiResponse<any[]>>('/overview/activity', { params: { limit } }),
  getFailedDetails: () =>
    api.get<ApiResponse<any>>('/overview/failed'),
};

export const configApi = {
  getList: (params?: { page?: number; pageSize?: number; status?: string; key?: string }) =>
    api.get<ApiResponse<{ items: ConfigItem[]; pagination: any }>>('/configs', { params }),
  getById: (id: string) =>
    api.get<ApiResponse<ConfigItem & { versions: DistributionVersion[]; pullRecords: PullRecord[] }>>(`/configs/${id}`),
  create: (data: Partial<ConfigItem>) =>
    api.post<ApiResponse<ConfigItem>>('/configs', data),
  update: (id: string, data: Partial<ConfigItem>) =>
    api.put<ApiResponse<ConfigItem>>(`/configs/${id}`, data),
  delete: (id: string) =>
    api.delete<ApiResponse<ConfigItem>>(`/configs/${id}`),
};

export const distributionApi = {
  publish: (data: { configId: string; releasedBy?: string; releaseNote?: string; isForce?: boolean }) =>
    api.post<ApiResponse<DistributionVersion>>('/distributions/publish', data),
  getList: (params?: { page?: number; pageSize?: number; configId?: string }) =>
    api.get<ApiResponse<{ items: (DistributionVersion & { configItem: any })[]; pagination: any }>>('/distributions', { params }),
  getByConfigId: (configId: string) =>
    api.get<ApiResponse<DistributionVersion[]>>(`/distributions/config/${configId}`),
  getById: (id: string) =>
    api.get<ApiResponse<DistributionVersion & { stats: any }>>(`/distributions/${id}`),
  forceRefresh: (configId: string) =>
    api.post<ApiResponse<any>>(`/distributions/refresh/${configId}`),
};

export const pullApi = {
  getList: (params?: { page?: number; pageSize?: number; configId?: string; instanceId?: string; pullStatus?: string }) =>
    api.get<ApiResponse<{ records: PullRecord[]; pagination: any }>>('/pulls', { params }),
  getFailed: (configId?: string) =>
    api.get<ApiResponse<PullRecord[]>>('/pulls/failed', { params: { configId } }),
  retry: (id: string) =>
    api.post<ApiResponse<PullRecord>>(`/pulls/${id}/retry`),
  detectOldValues: (configId: string) =>
    api.get<ApiResponse<any>>(`/pulls/old-values/${configId}`),
};

export const instanceApi = {
  getList: (params?: { page?: number; pageSize?: number; serviceName?: string; env?: string; status?: string }) =>
    api.get<ApiResponse<{ instances: ServiceInstance[]; pagination: any }>>('/instances', { params }),
  getById: (id: string) =>
    api.get<ApiResponse<ServiceInstance & { pullRecords: PullRecord[] }>>(`/instances/${id}`),
  create: (data: Partial<ServiceInstance>) =>
    api.post<ApiResponse<ServiceInstance>>('/instances', data),
  updateStatus: (id: string, status: string) =>
    api.put<ApiResponse<ServiceInstance>>(`/instances/${id}/status`, { status }),
  delete: (id: string) =>
    api.delete<ApiResponse<ServiceInstance>>(`/instances/${id}`),
};

export const diffApi = {
  generate: (data: { configKey: string; baseVersion: number; targetVersion: number; generatedBy?: string }) =>
    api.post<ApiResponse<DiffReport>>('/diff-reports', data),
  getList: (params?: { page?: number; pageSize?: number; configId?: string }) =>
    api.get<ApiResponse<{ reports: DiffReport[]; pagination: any }>>('/diff-reports', { params }),
  getConfigVersions: (configKey: string) =>
    api.get<ApiResponse<number[]>>(`/diff-reports/config-versions/${configKey}`),
  getById: (id: string) =>
    api.get<ApiResponse<DiffReport>>(`/diff-reports/${id}`),
  exportReport: (id: string) =>
    window.open(`/api/diff-reports/${id}/export`, '_blank'),
  exportEffectiveStates: (configId: string) =>
    window.open(`/api/effective-states/${configId}/export`, '_blank'),
};
