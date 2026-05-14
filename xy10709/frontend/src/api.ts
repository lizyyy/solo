import axios from 'axios';
import { UploadTask, SecurityLog, Organization, Stats, ScanRule } from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const uploadFile = async (file: File, organizationId?: number, uploadedBy?: string): Promise<UploadTask> => {
  const formData = new FormData();
  formData.append('file', file);
  if (organizationId) formData.append('organization_id', organizationId.toString());
  if (uploadedBy) formData.append('uploaded_by', uploadedBy);
  
  const response = await api.post<UploadTask>('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const scanTask = async (taskId: number): Promise<UploadTask> => {
  const response = await api.post<UploadTask>(`/upload/${taskId}/scan`);
  return response.data;
};

export const releaseTask = async (taskId: number, releasedBy: string, reason: string): Promise<UploadTask> => {
  const formData = new FormData();
  formData.append('released_by', releasedBy);
  formData.append('reason', reason);
  const response = await api.post<UploadTask>(`/upload/${taskId}/release`, formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return response.data;
};

export const rollbackTask = async (taskId: number, rolledBackBy: string, reason: string): Promise<UploadTask> => {
  const formData = new FormData();
  formData.append('rolled_back_by', rolledBackBy);
  formData.append('reason', reason);
  const response = await api.post<UploadTask>(`/upload/${taskId}/rollback`, formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return response.data;
};

export const getUploadTasks = async (status?: string, organizationId?: number): Promise<UploadTask[]> => {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  if (organizationId) params.organization_id = organizationId.toString();
  
  const response = await api.get<UploadTask[]>('/upload', { params });
  return response.data;
};

export const getUploadTask = async (taskId: number): Promise<UploadTask> => {
  const response = await api.get<UploadTask>(`/upload/${taskId}`);
  return response.data;
};

export const getSecurityLogs = async (severity?: string, uploadTaskId?: number): Promise<SecurityLog[]> => {
  const params: Record<string, string> = {};
  if (severity) params.severity = severity;
  if (uploadTaskId) params.upload_task_id = uploadTaskId.toString();
  
  const response = await api.get<SecurityLog[]>('/security-logs', { params });
  return response.data;
};

export const resolveSecurityLog = async (logId: number, resolvedBy: string): Promise<SecurityLog> => {
  const response = await api.post<SecurityLog>(`/security-logs/${logId}/resolve`, { resolved_by: resolvedBy });
  return response.data;
};

export const getOrganizations = async (): Promise<Organization[]> => {
  const response = await api.get<Organization[]>('/organizations');
  return response.data;
};

export const createOrganization = async (org: Partial<Organization>): Promise<Organization> => {
  const response = await api.post<Organization>('/organizations', org);
  return response.data;
};

export const batchImportOrganizations = async (orgs: Partial<Organization>[]): Promise<{ results: any[] }> => {
  const response = await api.post('/organizations/batch-import', { organizations: orgs });
  return response.data;
};

export const getScanRules = async (): Promise<ScanRule[]> => {
  const response = await api.get<ScanRule[]>('/scan-rules');
  return response.data;
};

export const getStats = async (): Promise<Stats> => {
  const response = await api.get<Stats>('/stats');
  return response.data;
};
