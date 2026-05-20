import axios from 'axios';
import { ResetRequest, ResetStatus, RecoveryLog, RetainedFile, LabSpace, ExportReport } from '../types';

export type UserRole = 'student' | 'assistant' | 'teacher' | 'admin';

let currentUserRole: UserRole = 'assistant';

export const setUserRole = (role: UserRole) => {
  currentUserRole = role;
};

export const getUserRole = (): UserRole => currentUserRole;

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  config.headers['X-User-Role'] = currentUserRole;
  return config;
});

export const resetRequestsApi = {
  getAll: (status?: ResetStatus): Promise<ResetRequest[]> => {
    const params = status ? { status } : {};
    return api.get('/reset-requests/', { params }).then(res => res.data);
  },
  
  getById: (id: number): Promise<ResetRequest> => 
    api.get(`/reset-requests/${id}/`).then(res => res.data),

  getAvailableTransitions: (id: number): Promise<{
    current_status: string;
    available_transitions: string[];
  }> =>
    api.get(`/reset-requests/${id}/available-transitions/`).then(res => res.data),
  
  create: (data: {
    lab_space_id: number;
    snapshot_id: number;
    requested_by: string;
    requested_by_name: string;
    reason?: string;
  }): Promise<ResetRequest> => 
    api.post('/reset-requests/', data).then(res => res.data),
  
  updateStatus: (id: number, data: {
    status: ResetStatus;
    status_reason?: string;
    approved_by?: string;
  }): Promise<ResetRequest> => 
    api.patch(`/reset-requests/${id}/status/`, data).then(res => res.data),
  
  getLogs: (id: number): Promise<RecoveryLog[]> =>
    api.get(`/reset-requests/${id}/logs/`).then(res => res.data),
  
  getRetainedFiles: (id: number): Promise<RetainedFile[]> =>
    api.get(`/reset-requests/${id}/retained-files/`).then(res => res.data),
  
  exportReport: (id: number): Promise<ExportReport> =>
    api.get(`/reset-requests/${id}/export/`).then(res => res.data),
  
  initSampleData: (): Promise<{ message: string }> =>
    api.post('/reset-requests/init-sample-data/').then(res => res.data),

  getPermissionInfo: (): Promise<{
    roles: string[];
    actions: Record<string, string[]>;
    valid_transitions: Record<string, string[]>;
  }> =>
    api.get('/reset-requests/permissions/info/').then(res => res.data),
};

export const labSpacesApi = {
  getAll: (): Promise<LabSpace[]> =>
    api.get('/lab-spaces/').then(res => res.data),
};

export default api;