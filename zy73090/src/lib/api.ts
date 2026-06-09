import type {
  ReviewTask,
  CadLayer,
  LayerHistory,
  Screenshot,
  TaskStatus,
  LayerStatus,
} from '@shared/types';

const API_BASE = '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface VersionDiff {
  added: Record<string, unknown>;
  removed: Record<string, unknown>;
  modified: Record<string, { from: unknown; to: unknown }>;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    let msg = `请求失败: ${res.status} ${res.statusText}`;
    try {
      const err = await res.json();
      if (err?.error) msg = err.error;
    } catch {}
    throw new Error(msg);
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const json = (await res.json()) as ApiResponse<T>;
    if (!json.success) {
      throw new Error(json.error || '请求失败');
    }
    return json.data as T;
  }

  return undefined as unknown as T;
}

export async function fetchTasks(
  status?: TaskStatus,
  search?: string,
): Promise<ReviewTask[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  const qs = params.toString();
  return request<ReviewTask[]>(`/tasks${qs ? `?${qs}` : ''}`);
}

export interface CreateTaskInput {
  projectName: string;
  drawingVersion: string;
  cadSource: string;
  description?: string;
  [key: string]: unknown;
}

export async function createTask(
  payload: CreateTaskInput,
): Promise<ReviewTask> {
  return request<ReviewTask>('/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchTask(id: string): Promise<ReviewTask> {
  return request<ReviewTask>(`/tasks/${id}`);
}

export async function updateTask(
  id: string,
  patch: Partial<ReviewTask>,
): Promise<ReviewTask> {
  return request<ReviewTask>(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export async function fetchTaskLayers(taskId: string): Promise<CadLayer[]> {
  return request<CadLayer[]>(`/tasks/${taskId}/layers`);
}

export interface TaskHistoryItem extends LayerHistory {
  layerName?: string;
}

export async function fetchTaskHistory(taskId: string): Promise<TaskHistoryItem[]> {
  return request<TaskHistoryItem[]>(`/tasks/${taskId}/history`);
}

export async function compareHistory(
  taskId: string,
  layerId: string,
  v1: number,
  v2: number,
): Promise<{
  v1?: LayerHistory;
  v2?: LayerHistory;
  diff: VersionDiff;
}> {
  const params = new URLSearchParams({ layerId, v1: String(v1), v2: String(v2) });
  return request(`/tasks/${taskId}/history/compare?${params.toString()}`);
}

export function exportTask(taskId: string): void {
  window.open(`${API_BASE}/tasks/${taskId}/export`, '_blank');
}

export async function fetchLayer(id: string): Promise<CadLayer> {
  return request<CadLayer>(`/layers/${id}`);
}

export interface ReviewPayload {
  status: LayerStatus;
  opinion: string;
  note?: string;
  reviewer?: string;
  standardTags?: string[];
  screenshotIds?: string[];
}

export async function submitLayerReview(
  layerId: string,
  payload: ReviewPayload,
): Promise<CadLayer> {
  return request<CadLayer>(`/layers/${layerId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface NotePayload {
  note: string;
}

export async function appendLayerNote(
  layerId: string,
  payload: NotePayload,
): Promise<CadLayer> {
  return request<CadLayer>(`/layers/${layerId}/notes`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function uploadScreenshot(
  taskId: string,
  formData: FormData,
): Promise<Screenshot> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/screenshots`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    let msg = `上传失败: ${res.status} ${res.statusText}`;
    try {
      const err = await res.json();
      if (err?.error) msg = err.error;
    } catch {}
    throw new Error(msg);
  }

  const json = (await res.json()) as ApiResponse<Screenshot>;
  if (!json.success) {
    throw new Error(json.error || '上传失败');
  }
  return json.data as Screenshot;
}

export async function fetchTaskScreenshots(taskId: string): Promise<Screenshot[]> {
  return request<Screenshot[]>(`/tasks/${taskId}/screenshots`);
}

export function downloadScreenshot(id: string): void {
  window.open(`${API_BASE}/screenshots/${id}/download`, '_blank');
}

export async function deleteScreenshot(id: string): Promise<void> {
  return request<void>(`/screenshots/${id}`, {
    method: 'DELETE',
  });
}

export interface GuideData {
  启动命令: string[];
  重跑方式: string[];
  截图规范: string[];
  接口速览: string[];
}

export async function fetchGuide(): Promise<GuideData> {
  return request<GuideData>('/guide');
}

export { fetchTaskLayers as fetchLayers };
export { fetchTaskScreenshots as fetchScreenshots };
export { submitLayerReview as submitReview };
export { compareHistory as compareVersions };
