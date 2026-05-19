import axios from 'axios';
import type { AudioTask, TaskDetail, CreateTaskRequest, TaskStatus } from './types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

export const taskApi = {
  create: (data: CreateTaskRequest): Promise<{ success: boolean; data: AudioTask }> =>
    api.post('/tasks', data).then(res => res.data),

  list: (status?: TaskStatus): Promise<{ success: boolean; data: AudioTask[] }> =>
    api.get('/tasks', { params: status ? { status } : {} }).then(res => res.data),

  getFailed: (): Promise<{ success: boolean; data: any[] }> =>
    api.get('/tasks/failed').then(res => res.data),

  getDetail: (taskId: string): Promise<{ success: boolean; data: TaskDetail }> =>
    api.get(`/tasks/${taskId}`).then(res => res.data),

  updateStatus: (taskId: string, status: TaskStatus, operator?: string, remark?: string): Promise<{ success: boolean; data: TaskDetail }> =>
    api.post(`/tasks/${taskId}/status`, { status, operator, remark }).then(res => res.data),

  advance: (taskId: string): Promise<{ success: boolean; data: TaskDetail & { advance_result: any } }> =>
    api.post(`/tasks/${taskId}/advance`).then(res => res.data),

  completeStage: (taskId: string, stageName: string): Promise<{ success: boolean; data: TaskDetail }> =>
    api.post(`/tasks/${taskId}/complete-stage`, { stage_name: stageName }).then(res => res.data),

  updateProgress: (taskId: string, stageName: string, progress: number): Promise<{ success: boolean; data: TaskDetail }> =>
    api.post(`/tasks/${taskId}/update-progress`, { stage_name: stageName, progress }).then(res => res.data),

  saveFragments: (taskId: string, fragments: any[]): Promise<{ success: boolean; data: TaskDetail }> =>
    api.post(`/tasks/${taskId}/fragments`, { fragments }).then(res => res.data),

  getDemoFragments: (): Promise<{ success: boolean; data: any[] }> =>
    api.get('/tasks/demo/fragments').then(res => res.data),

  saveDemoFragments: (taskId: string): Promise<{ success: boolean; data: TaskDetail }> =>
    api.post(`/tasks/${taskId}/fragments/demo`).then(res => res.data),

  executeCallback: (taskId: string, demoMode = true): Promise<{ success: boolean; data: TaskDetail & { callback_result: any } }> =>
    api.post(`/tasks/${taskId}/callback`, { demo_mode: demoMode }).then(res => res.data),

  retry: (taskId: string, demoMode = true): Promise<{ success: boolean; data: TaskDetail & { retry_result: any } }> =>
    api.post(`/tasks/${taskId}/retry`, { demo_mode: demoMode }).then(res => res.data),

  export: (taskId: string): Promise<{ success: boolean; data: any }> =>
    api.get(`/tasks/${taskId}/export`).then(res => res.data),

  exportCsv: (taskId: string): Promise<{ success: boolean; data: any }> =>
    api.get(`/tasks/${taskId}/export/csv`).then(res => res.data),
};
