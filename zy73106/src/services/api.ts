import type {
  Drawing, DrawingVersion, NoteBlock, MaterialBatch,
  ValueChangeLog, DrawingStatus, DrawingMetrics,
  NoteTag, ExportLog, User,
} from '@/types';

export type ApiResult<T> = Promise<{ ok: boolean; data?: T; error?: string }>;

async function request<T>(
  path: string,
  options: RequestInit = {},
): ApiResult<T> {
  try {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}${text ? ': ' + text : ''}` };
    }
    const data = await res.json();
    if (data && typeof data === 'object' && 'ok' in data) {
      return data as any;
    }
    return { ok: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

export interface SummaryData {
  total: number;
  abnormal: number;
  closed: number;
  reviewing: number;
  missingMaterials: number;
}

export interface DrawingWithSummary extends Drawing {
  summary?: SummaryData;
}

export interface DrawingDetail {
  drawing: Drawing;
  versions: DrawingVersion[];
  notes: NoteBlock[];
  materials: MaterialBatch[];
  changeLogs: ValueChangeLog[];
}

export const getSummary = (): ApiResult<SummaryData> =>
  request<SummaryData>('/api/summary');

export const getDrawings = (): ApiResult<DrawingWithSummary[]> =>
  request<DrawingWithSummary[]>('/api/drawings');

export const getDrawingDetail = (id: string): ApiResult<DrawingDetail> =>
  request<DrawingDetail>(`/api/drawings/${id}`);

export const getUsers = (): ApiResult<User[]> =>
  request<User[]>('/api/users');

export const getExportData = (scope: 'all' | string): ApiResult<unknown> =>
  request<unknown>(`/api/export/data?scope=${encodeURIComponent(scope)}`);

export const addNote = (
  drawingId: string,
  payload: {
    content: string;
    tag: NoteTag;
    isRawBimClue?: boolean;
    authorId: string;
    authorName: string;
  },
): ApiResult<NoteBlock> =>
  request<NoteBlock>(`/api/drawings/${drawingId}/notes`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const deleteNote = (
  drawingId: string,
  noteId: string,
): ApiResult<boolean> =>
  request<boolean>(`/api/drawings/${drawingId}/notes/${noteId}`, {
    method: 'DELETE',
  });

export const updateMetric = (
  drawingId: string,
  payload: {
    field: keyof DrawingMetrics;
    newValue: number;
    reason: string;
    operatorId: string;
    operatorName: string;
  },
): ApiResult<ValueChangeLog | null> =>
  request<ValueChangeLog | null>(`/api/drawings/${drawingId}/metrics`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const updateDrawingStatus = (
  drawingId: string,
  status: DrawingStatus,
  operatorId: string,
  operatorName: string,
): ApiResult<boolean> =>
  request<boolean>(`/api/drawings/${drawingId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, operatorId, operatorName }),
  });

export const markMaterialSupplied = (
  materialId: string,
  operatorName: string,
): ApiResult<boolean> =>
  request<boolean>(`/api/materials/${materialId}/supply`, {
    method: 'PATCH',
    body: JSON.stringify({ operatorName }),
  });

export const markMaterialMissing = (
  materialId: string,
  reviewHint: string,
  operatorName: string,
  operatorId: string,
): ApiResult<boolean> =>
  request<boolean>(`/api/materials/${materialId}/missing`, {
    method: 'PATCH',
    body: JSON.stringify({ reviewHint, operatorName, operatorId }),
  });

export const addExportLog = (
  payload: {
    type: 'pdf' | 'csv' | 'json';
    drawingId?: string;
    operatorName: string;
    fileName: string;
  },
): ApiResult<ExportLog> =>
  request<ExportLog>('/api/export-logs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
