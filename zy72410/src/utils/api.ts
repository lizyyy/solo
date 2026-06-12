import axios from 'axios';
import type {
  Material, Track, Conflict, TunerMessage, RehearsalChange, HistoryRecord,
  ImportPreviewResult, ImportConfirmRequest, SelfCheckResult,
  ReportSummary, ChangeTraceNode
} from '../types';

type MaterialWithTracks = Material & { tracks: Track[] };
type MaterialDetail = {
  material: Material;
  tracks: Track[];
  changes: RehearsalChange[];
  history: HistoryRecord[];
};
type MessageWithConflicts = {
  message: TunerMessage;
  conflicts: Conflict[];
};

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => {
    const result = response.data;
    if (result && result.success && result.data !== undefined) {
      return result.data;
    }
    return result;
  },
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error.response?.data?.error || error.message);
  }
);

export const importApi = {
  preview: (data: any[], file_name: string, imported_by: string = '版权运营') =>
    api.post<any, ImportPreviewResult>('/import/preview', { data, file_name, imported_by }),

  confirm: (request: ImportConfirmRequest, operator: string = '版权运营') =>
    api.post<any, any>('/import/confirm', { ...request, operator }),

  parseFile: (file_name: string, fileContent: string) =>
    api.post<any, any[]>('/import/parse-file', { file_name, fileContent }),
};

export const materialApi = {
  getAll: (status?: string) =>
    api.get<any, MaterialWithTracks[]>('/materials', { params: { status } }),

  getById: (id: string) =>
    api.get<any, MaterialDetail>(`/materials/${id}`),

  getTracks: (materialId: string) =>
    api.get<any, Track[]>(`/materials/${materialId}/tracks`),

  updateTrackRemarks: (trackId: string, remarks: string, operator: string = '版权运营', changeReason: string = '更新轨道备注') =>
    api.put<any, Track>(`/materials/tracks/${trackId}/remarks`, { remarks, operator, changeReason }),

  confirmRework: (trackId: string, operator: string = '版权运营') =>
    api.post<any, null>(`/materials/tracks/${trackId}/recheck`, { operator }),

  recalculate: (materialId: string, operator: string = '版权运营') =>
    api.post<any, null>(`/materials/${materialId}/recalculate`, { operator }),
};

export const messageApi = {
  getMessages: (materialId: string) =>
    api.get<any, TunerMessage[]>(`/${materialId}/messages`),

  addMessage: (materialId: string, content: string, messageDate: string, recordedBy: string = '许老师') =>
    api.post<any, MessageWithConflicts>(`/${materialId}/messages`, { content, messageDate, recordedBy }),

  getConflicts: (materialId?: string, status?: string) =>
    api.get<any, Conflict[]>('/conflicts', { params: { materialId, status } }),

  resolveConflict: (conflictId: string, resolution: 'confirmed' | 'rejected', resolvedBy: string = '许老师') =>
    api.post<any, Conflict>(`/conflicts/${conflictId}/resolve`, { resolution, resolvedBy }),

  getPendingCount: () =>
    api.get<any, { count: number }>('/conflicts/pending/count'),
};

export const changeApi = {
  getAll: (materialId?: string) =>
    api.get<any, RehearsalChange[]>('/changes', { params: { materialId } }),

  getHistory: (materialId: string, trackId?: string) =>
    api.get<any, HistoryRecord[]>(`/changes/history/${materialId}`, { params: { trackId } }),

  getTrace: (materialId: string) =>
    api.get<any, ChangeTraceNode[]>(`/changes/trace/${materialId}`),

  getCount: () =>
    api.get<any, { count: number }>('/changes/count'),
};

export const selfCheckApi = {
  runAll: () =>
    api.get<any, SelfCheckResult[]>('/selfcheck/run-all'),

  check: (type: 'duplicate' | 'rework' | 'recalculate' | 'export') =>
    api.get<any, SelfCheckResult>(`/selfcheck/${type}`),
};

export const reportApi = {
  getSummary: () =>
    api.get<any, ReportSummary>('/report/summary'),

  getTrace: (materialId: string) =>
    api.get<any, ChangeTraceNode[]>(`/report/trace/${materialId}`),

  exportExcel: () => {
    window.open(`${API_BASE}/export/excel`, '_blank');
  },

  exportPDF: () => {
    window.open(`${API_BASE}/export/pdf`, '_blank');
  },
};

export default api;
