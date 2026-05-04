import axios, { AxiosInstance } from 'axios';
import {
  LightingPlan,
  PlacedLight,
  Actor,
  Camera,
  ScheduleItem,
  RiskItem,
  PlanDetail,
  ApiResponse
} from '@/types';

const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const planApi = {
  getAll: (): Promise<ApiResponse<LightingPlan[]>> => 
    api.get('/plans').then(res => res.data),
  
  getById: (id: string): Promise<ApiResponse<PlanDetail>> =>
    api.get(`/plans/${id}`).then(res => res.data),
  
  create: (data: { 
    name: string; 
    description?: string; 
    studioDimensions: { width: number; depth: number; height: number };
    maxPowerLimit?: number;
  }): Promise<ApiResponse<LightingPlan>> =>
    api.post('/plans', data).then(res => res.data),
  
  update: (id: string, data: Partial<{
    name: string;
    description: string;
    studioDimensions: { width: number; depth: number; height: number };
    maxPowerLimit: number;
  }>): Promise<ApiResponse<LightingPlan>> =>
    api.put(`/plans/${id}`, data).then(res => res.data),
  
  delete: (id: string): Promise<ApiResponse> =>
    api.delete(`/plans/${id}`).then(res => res.data),
};

export const lightApi = {
  create: (planId: string, data: Partial<PlacedLight> & { name: string }): Promise<ApiResponse<PlacedLight>> =>
    api.post(`/plans/${planId}/lights`, data).then(res => res.data),
  
  update: (planId: string, lightId: string, data: Partial<PlacedLight>): Promise<ApiResponse<PlacedLight>> =>
    api.put(`/plans/${planId}/lights/${lightId}`, data).then(res => res.data),
  
  delete: (planId: string, lightId: string): Promise<ApiResponse> =>
    api.delete(`/plans/${planId}/lights/${lightId}`).then(res => res.data),
};

export const actorApi = {
  create: (planId: string, data: Partial<Actor> & { name: string }): Promise<ApiResponse<Actor>> =>
    api.post(`/plans/${planId}/actors`, data).then(res => res.data),
  
  update: (planId: string, actorId: string, data: Partial<Actor>): Promise<ApiResponse<Actor>> =>
    api.put(`/plans/${planId}/actors/${actorId}`, data).then(res => res.data),
  
  delete: (planId: string, actorId: string): Promise<ApiResponse> =>
    api.delete(`/plans/${planId}/actors/${actorId}`).then(res => res.data),
};

export const cameraApi = {
  create: (planId: string, data: Partial<Camera> & { name: string }): Promise<ApiResponse<Camera>> =>
    api.post(`/plans/${planId}/cameras`, data).then(res => res.data),
  
  update: (planId: string, cameraId: string, data: Partial<Camera>): Promise<ApiResponse<Camera>> =>
    api.put(`/plans/${planId}/cameras/${cameraId}`, data).then(res => res.data),
  
  delete: (planId: string, cameraId: string): Promise<ApiResponse> =>
    api.delete(`/plans/${planId}/cameras/${cameraId}`).then(res => res.data),
};

export const scheduleApi = {
  create: (planId: string, data: Partial<ScheduleItem> & { sceneId: string; sceneName: string; date: string; startTime: string; endTime: string }): Promise<ApiResponse<ScheduleItem>> =>
    api.post(`/plans/${planId}/schedule`, data).then(res => res.data),
  
  update: (planId: string, scheduleId: string, data: Partial<ScheduleItem>): Promise<ApiResponse<ScheduleItem>> =>
    api.put(`/plans/${planId}/schedule/${scheduleId}`, data).then(res => res.data),
  
  delete: (planId: string, scheduleId: string): Promise<ApiResponse> =>
    api.delete(`/plans/${planId}/schedule/${scheduleId}`).then(res => res.data),
};

export const riskApi = {
  calculate: (planId: string): Promise<ApiResponse<RiskItem[]>> =>
    api.post(`/plans/${planId}/calculate-risks`).then(res => res.data),
  
  override: (planId: string, riskId: string, data: { isOverridden: boolean; overrideReason?: string; overrideBy?: string }): Promise<ApiResponse<RiskItem>> =>
    api.put(`/plans/${planId}/risks/${riskId}/override`, data).then(res => res.data),
};

export const importApi = {
  importLights: (planId: string, file: File): Promise<ApiResponse<PlacedLight[]>> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/plans/${planId}/import/lights`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data);
  },
  
  importCameraActor: (planId: string, file: File): Promise<ApiResponse<{ actors: Actor[]; cameras: Camera[] }>> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/plans/${planId}/import/camera-actor`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data);
  },
  
  importSchedule: (planId: string, file: File): Promise<ApiResponse<ScheduleItem[]>> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/plans/${planId}/import/schedule`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data);
  },
};

export const exportApi = {
  exportMarkdown: (planId: string): Promise<void> => {
    return api.get(`/plans/${planId}/export/markdown`, {
      responseType: 'blob'
    }).then(res => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `lighting-plan-${planId}.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  },
  
  exportJson: (planId: string): Promise<void> => {
    return api.get(`/plans/${planId}/export/json`, {
      responseType: 'blob'
    }).then(res => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `lighting-audit-${planId}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  },
};

export default api;
