import axios from 'axios'
import { Task, Lock, ExecutionLog, AbnormalQueue, TaskDetail, Stats, ApiResponse } from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export const taskApi = {
  getAll: () => api.get<Task[]>('/tasks'),
  getById: (id: number) => api.get<TaskDetail>(`/tasks/${id}`),
  create: (data: { name: string; description?: string; max_execution_time?: number; heartbeat_interval?: number }) =>
    api.post<Task>('/tasks', data),
  update: (id: number, data: Partial<Task>) => api.put<Task>(`/tasks/${id}`, data),
}

export const lockApi = {
  acquire: (data: { task_name: string; instance_id: string }) =>
    api.post<ApiResponse & { lock_id?: number; task_id?: number }>('/locks/acquire', data),
  heartbeat: (data: { task_name: string; instance_id: string }) =>
    api.post<ApiResponse>('/locks/heartbeat', data),
  release: (data: { task_name: string; instance_id: string; success?: boolean; result?: string }) =>
    api.post<ApiResponse>('/locks/release', data),
  forceRelease: (lockId: number, reason?: string) =>
    api.post<ApiResponse>(`/locks/${lockId}/force-release`, null, { params: { reason } }),
  getAll: (params?: { task_id?: number; status?: string }) =>
    api.get<Lock[]>('/locks', { params }),
}

export const executionLogApi = {
  getAll: (params?: { task_id?: number; status?: string; limit?: number }) =>
    api.get<ExecutionLog[]>('/execution-logs', { params }),
  export: (params?: { task_id?: number; start_date?: string; end_date?: string }) =>
    api.get('/export/execution-logs', { params, responseType: 'blob' }),
}

export const abnormalApi = {
  getAll: (params?: { is_resolved?: boolean; severity?: string }) =>
    api.get<AbnormalQueue[]>('/abnormal-queue', { params }),
  resolve: (id: number, resolution_note?: string) =>
    api.post<ApiResponse>(`/abnormal-queue/${id}/resolve`, { resolution_note }),
  export: (params?: { is_resolved?: boolean }) =>
    api.get('/export/abnormal-queue', { params, responseType: 'blob' }),
}

export const statsApi = {
  get: () => api.get<Stats>('/stats'),
}

export default api
