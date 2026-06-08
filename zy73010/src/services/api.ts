import type {
  BoardingRecord,
  ExceptionQueueItem,
  ExportHistoryItem,
  ExportDiff,
  ReviewStatus,
  ListRecordsQuery,
} from '../../shared/types.js';

const base = '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(base + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Request failed: ${path}`);
  }
  return data.data as T;
}

export interface RecordListItem {
  id: string;
  petName: string;
  petBreed: string;
  ownerName: string;
  startDate: string;
  endDate: string;
  reviewStatus: ReviewStatus;
  conclusion: string;
  hasWeightAnomaly: boolean;
  hasVaccineMissing: boolean;
  abnormalPhotosCount: number;
  latestRemark: string;
  latestOperator: string;
}

export const api = {
  listRecords: (q: ListRecordsQuery = {}) => {
    const params = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    const qs = params.toString();
    return req<RecordListItem[]>(`/records${qs ? '?' + qs : ''}`);
  },

  getRecord: (id: string) => req<BoardingRecord>(`/records/${id}`),

  updateRemark: (id: string, body: { content: string; status: ReviewStatus; operator?: string }) =>
    req<{
      synced: boolean;
      recordUpdated: boolean;
      exportUpdated: boolean;
      exceptionUpdated: boolean;
      message: string;
      record: BoardingRecord;
    }>(`/records/${id}/remarks`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  supplementRemark: (id: string, body: { content: string; operator?: string }) =>
    req<{
      exportId: string;
      diff: ExportDiff[];
      changeDescription: string;
      record: BoardingRecord;
    }>(`/records/${id}/remarks/supplement`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listExceptions: () => req<ExceptionQueueItem[]>('/exceptions'),

  updateExceptionStatus: (id: string, status: ReviewStatus, operator = '寄养店长老周') =>
    req<{
      exception: ExceptionQueueItem;
      isConsistent: boolean;
      consistencyCheck: {
        status: ReviewStatus;
        remark: string;
        fileConclusion: string;
        passed: boolean;
        message: string;
      };
    }>(`/exceptions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, operator }),
    }),

  exportReport: (includeTraces = true, operator = '寄养店长老周') =>
    req<{
      exportId: string;
      rows: Record<string, unknown>[];
      preview: Record<string, unknown>[];
      download: { fileName: string; format: string };
      message: string;
      anomalyMarksIncluded: boolean;
    }>('/export/report', {
      method: 'POST',
      body: JSON.stringify({ includeTraces, operator }),
    }),

  downloadReport: async (includeTraces = true) => {
    const res = await fetch(base + '/export/report/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ includeTraces }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const disp = res.headers.get('Content-Disposition') || '';
    const match = disp.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    const name = match ? decodeURIComponent(match[1]) : 'report.xlsx';
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  },

  exportExceptions: (operator = '寄养店长老周') =>
    req<{
      exportId: string;
      rows: Record<string, unknown>[];
      inconsistentCount: number;
      consistencyWarning: string;
      download: { fileName: string };
    }>('/export/exceptions', {
      method: 'POST',
      body: JSON.stringify({ operator }),
    }),

  downloadExceptions: async () => {
    const res = await fetch(base + '/export/exceptions/download', { method: 'POST' });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const disp = res.headers.get('Content-Disposition') || '';
    const match = disp.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    const name = match ? decodeURIComponent(match[1]) : 'exceptions.xlsx';
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  },

  getExportHistory: () => req<ExportHistoryItem[]>('/export/history'),

  getExportDiff: (id: string) =>
    req<{
      exportId: string;
      history: ExportHistoryItem;
      diff: ExportDiff[];
      hasChanges: boolean;
      summary: string;
    }>(`/export/${id}/diff`),
};
