import type {
  Material,
  MaterialStatus,
  HistoryRecord,
  RejudgeRequest,
  CadNoteRequest,
  ChangeOrderRequest,
  CsvImportResult,
} from '../../shared/types';

const API_BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export const api = {
  health: () => request<{ success: boolean; message: string }>('/health'),

  getStats: () => request<Record<string, number>>('/materials/stats'),

  getMaterials: (params: {
    keyword?: string;
    status?: MaterialStatus;
    project?: string;
    layer?: string;
    page?: number;
    pageSize?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    (Object.keys(params) as (keyof typeof params)[]).forEach(k => {
      const v = params[k];
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    const query = qs.toString();
    return request<{ total: number; page: number; pageSize: number; data: Material[] }>(
      `/materials${query ? `?${query}` : ''}`,
    );
  },

  getMaterial: (id: string) =>
    request<{ material: Material; history: HistoryRecord[] }>(`/materials/${id}`),

  createMaterial: (body: Partial<Material> & { materialCode: string; materialName: string }) =>
    request<Material>('/materials', { method: 'POST', body: JSON.stringify(body) }),

  updateMaterial: (id: string, body: Partial<Material>) =>
    request<Material>(`/materials/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  rejudge: (id: string, body: RejudgeRequest) =>
    request<Material>(`/materials/${id}/rejudge`, { method: 'PUT', body: JSON.stringify(body) }),

  updateCadNote: (id: string, body: CadNoteRequest) =>
    request<Material>(`/materials/${id}/cad-note`, { method: 'PUT', body: JSON.stringify(body) }),

  updateChangeOrder: (id: string, body: ChangeOrderRequest) =>
    request<Material>(`/materials/${id}/change-order`, { method: 'PUT', body: JSON.stringify(body) }),

  getHistoryAll: (params: { action?: string; keyword?: string; page?: number; pageSize?: number } = {}) => {
    const qs = new URLSearchParams();
    (Object.keys(params) as (keyof typeof params)[]).forEach(k => {
      const v = params[k];
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    const query = qs.toString();
    return request<{ total: number; page: number; pageSize: number; data: HistoryRecord[] }>(
      `/history${query ? `?${query}` : ''}`,
    );
  },

  csvImportContent: (content: string, operator = '阿宁') =>
    request<CsvImportResult>('/csv/import-content', {
      method: 'POST',
      body: JSON.stringify({ content, operator }),
    }),

  csvImportFile: (file: File, operator = '阿宁') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('operator', operator);
    return fetch(`${API_BASE}/csv/import`, { method: 'POST', body: fd }).then(async r => {
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { error: text }; }
      if (!r.ok) throw new Error(data?.error || '导入失败');
      return data as CsvImportResult;
    });
  },

  csvExport: () =>
    fetch(`${API_BASE}/csv/export`).then(r => {
      if (!r.ok) throw new Error('导出失败');
      return r.blob();
    }),

  csvSample: () =>
    fetch(`${API_BASE}/csv/sample`).then(r => {
      if (!r.ok) throw new Error('下载失败');
      return r.blob();
    }),

  csvParsePreview: (content: string) =>
    request<{ rows: Array<Record<string, string>>; total: number }>('/csv/parse-preview', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};
