import axios from 'axios';
import type { Slope, Vehicle, Task, Report } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export const slopeApi = {
  getAll: () => api.get<{ success: boolean; data: Slope[] }>('/slopes'),
  getById: (id: string) => api.get<{ success: boolean; data: Slope }>(`/slopes/${id}`),
  getNeedingGrooming: () => api.get<{ success: boolean; data: Slope[] }>('/slopes/needing-grooming'),
  create: (data: Partial<Slope>) => api.post<{ success: boolean; data: Slope }>('/slopes', data),
  update: (id: string, data: Partial<Slope>) => api.put<{ success: boolean; data: Slope }>(`/slopes/${id}`, data),
  delete: (id: string) => api.delete<{ success: boolean }>(`/slopes/${id}`)
};

export const vehicleApi = {
  getAll: () => api.get<{ success: boolean; data: Vehicle[] }>('/vehicles'),
  getById: (id: string) => api.get<{ success: boolean; data: Vehicle }>(`/vehicles/${id}`),
  getAvailable: () => api.get<{ success: boolean; data: Vehicle[] }>('/vehicles/available'),
  create: (data: Partial<Vehicle>) => api.post<{ success: boolean; data: Vehicle }>('/vehicles', data),
  update: (id: string, data: Partial<Vehicle>) => api.put<{ success: boolean; data: Vehicle }>(`/vehicles/${id}`, data),
  delete: (id: string) => api.delete<{ success: boolean }>(`/vehicles/${id}`),
  reportBreakdown: (id: string) => api.post<{ success: boolean; data: any }>(`/vehicles/${id}/breakdown`)
};

export const taskApi = {
  getAll: () => api.get<{ success: boolean; data: Task[] }>('/tasks'),
  getById: (id: string) => api.get<{ success: boolean; data: Task }>(`/tasks/${id}`),
  create: (data: any) => api.post<{ success: boolean; data: Task }>('/tasks', data),
  assign: (taskId: string, vehicleId: string) => 
    api.post<{ success: boolean; data: Task }>('/tasks/assign', { taskId, vehicleId }),
  autoSchedule: () => api.post<{ success: boolean; data: any[] }>('/tasks/auto-schedule'),
  confirm: (id: string) => api.post<{ success: boolean; data: Task }>(`/tasks/${id}/confirm`),
  reject: (id: string, reason: string) => 
    api.post<{ success: boolean; data: Task }>(`/tasks/${id}/reject`, { reason }),
  complete: (id: string, snowThicknessAfter: number, qualityScore: number) =>
    api.post<{ success: boolean; data: Task }>(`/tasks/${id}/complete`, { snowThicknessAfter, qualityScore }),
  cancel: (id: string, reason: string) =>
    api.post<{ success: boolean; data: Task }>(`/tasks/${id}/cancel`, { reason }),
  export: (format: 'json' | 'excel', startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    params.append('format', format);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return api.get(`/tasks/export?${params.toString()}`, {
      responseType: format === 'excel' ? 'blob' : 'json'
    });
  }
};

export const reportApi = {
  getAll: () => api.get<{ success: boolean; data: Report[] }>('/reports'),
  getById: (id: string) => api.get<{ success: boolean; data: Report }>(`/reports/${id}`),
  create: (data: Partial<Report>) => api.post<{ success: boolean; data: Report }>('/reports', data),
  approve: (id: string, approver: string) =>
    api.post<{ success: boolean; data: Report }>(`/reports/${id}/approve`, { approver }),
  export: (format: 'json' | 'excel', startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    params.append('format', format);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return api.get(`/reports/export?${params.toString()}`, {
      responseType: format === 'excel' ? 'blob' : 'json'
    });
  }
};
