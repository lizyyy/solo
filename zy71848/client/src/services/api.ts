import type {
  InspectionRecord,
  BatchTask,
  ExportRecord,
  AppSettings,
  ApiResponse,
  BatchProcessRequest,
  ExportRequest,
  ConsistencyCheckResult,
  ChangeRecord,
} from '../../../shared/types';

const API_BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }
  return data.data as T;
}

export const api = {
  inspections: {
    getAll: () => request<InspectionRecord[]>('/inspections'),
    getById: (id: string) => request<InspectionRecord>(`/inspections/${id}`),
    updateStatus: (id: string, status: InspectionRecord['status']) =>
      request<InspectionRecord>(`/inspections/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    flip: (id: string, flipType: 'x' | 'y' | 'origin') =>
      request<{ flipped: InspectionRecord; deviation: number }>(`/inspections/${id}/flip`, {
        method: 'POST',
        body: JSON.stringify({ flipType }),
      }),
    addChange: (id: string, change: Omit<ChangeRecord, 'id' | 'inspectionId'>) =>
      request<null>(`/inspections/${id}/change`, {
        method: 'POST',
        body: JSON.stringify(change),
      }),
  },

  batch: {
    getAll: () => request<BatchTask[]>('/batch'),
    getById: (id: string) => request<BatchTask>(`/batch/${id}`),
    create: (data: BatchProcessRequest) =>
      request<BatchTask>('/batch', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    run: (id: string) =>
      request<BatchTask>(`/batch/${id}/run`, {
        method: 'POST',
      }),
  },

  export: {
    getAll: () => request<ExportRecord[]>('/export'),
    check: (inspectionIds: string[]) =>
      request<ConsistencyCheckResult>('/export/check', {
        method: 'POST',
        body: JSON.stringify({ inspectionIds }),
      }),
    create: (data: ExportRequest) =>
      request<ExportRecord>('/export', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    download: (id: string) => {
      window.open(`${API_BASE}/export/${id}/download`, '_blank');
    },
  },

  settings: {
    get: () => request<AppSettings>('/settings'),
    update: (settings: Partial<AppSettings>) =>
      request<AppSettings>('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),
  },
};
