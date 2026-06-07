import {
  Breakpoint,
  BreakpointWithDetails,
  BreakpointStatus,
  HistoryRecord,
  ImportBatch,
  ImportPreviewResult,
  BoundaryRule,
  FriendlyError,
} from '../../shared/types';

const API_BASE = '/api';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    const err = data.error as FriendlyError | undefined;
    throw err || {
      code: 'UNKNOWN',
      message: '请求失败',
      suggestion: '请稍后重试',
    };
  }

  return data.data as T;
}

export const api = {
  breakpoints: {
    list: (filters?: {
      status?: BreakpointStatus;
      hasConstructionDetour?: boolean;
      search?: string;
    }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.hasConstructionDetour !== undefined)
        params.set('hasConstructionDetour', String(filters.hasConstructionDetour));
      if (filters?.search) params.set('search', filters.search);
      const qs = params.toString();
      return request<Breakpoint[]>(`/breakpoints${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) => request<BreakpointWithDetails>(`/breakpoints/${id}`),
    update: (
      id: string,
      updates: {
        redlineNote?: string;
        status?: BreakpointStatus;
        hasConstructionDetour?: boolean;
        updatedBy?: string;
      }
    ) =>
      request<Breakpoint>(`/breakpoints/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    markDetour: (id: string, markedBy?: string) =>
      request<Breakpoint>(`/breakpoints/${id}/mark-detour`, {
        method: 'POST',
        body: JSON.stringify({ markedBy }),
      }),
    confirm: (id: string, confirmedBy?: string) =>
      request<Breakpoint>(`/breakpoints/${id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ confirmedBy }),
      }),
    history: (id: string) =>
      request<HistoryRecord[]>(`/breakpoints/${id}/history`),
  },

  import: {
    preview: (content: string, format: 'csv' | 'json' = 'csv') =>
      request<ImportPreviewResult>('/import/preview', {
        method: 'POST',
        body: JSON.stringify({ content, format }),
      }),
    execute: (
      content: string,
      format: 'csv' | 'json' = 'csv',
      fileName?: string,
      importedBy?: string
    ) =>
      request<ImportBatch>('/import/execute', {
        method: 'POST',
        body: JSON.stringify({ content, format, fileName, importedBy }),
      }),
    batches: () => request<ImportBatch[]>('/import/batches'),
    sampleCsv: () => `${API_BASE}/import/sample-csv`,
  },

  history: {
    list: () => request<HistoryRecord[]>('/history'),
    rollback: (id: string, rollbackBy?: string) =>
      request<{ success: boolean; message: string }>(`/history/rollback/${id}`, {
        method: 'POST',
        body: JSON.stringify({ rollbackBy }),
      }),
  },

  rules: {
    list: () => request<BoundaryRule[]>('/rules'),
    get: (id: string) => request<BoundaryRule>(`/rules/${id}`),
    toggle: (id: string, isActive: boolean) =>
      request<{ success: boolean }>(`/rules/${id}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ isActive }),
      }),
  },
};

export default api;
