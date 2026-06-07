import type {
  AcceptanceRecord,
  SelfCheckResult,
  ApiResponse,
} from '@shared/types';

const baseUrl = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  const data = (await res.json()) as ApiResponse<T>;
  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }
  return data.data as T;
}

export const api = {
  records: {
    getAll: () => request<AcceptanceRecord[]>('/records'),
    getById: (id: string) => request<AcceptanceRecord>(`/records/${id}`),
    import: (data: {
      redLineNo: string;
      communityName: string;
      communityNameOld?: string;
      redLineRemark: string;
      operator?: string;
    }) =>
      request<AcceptanceRecord>('/records/import', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    submitReview: (id: string, gridInspection: string, operator?: string) =>
      request<AcceptanceRecord>(`/records/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ gridInspection, operator }),
      }),
    confirmConflict: (id: string, resolution: string, operator?: string) =>
      request<AcceptanceRecord>(`/records/${id}/conflict/confirm`, {
        method: 'POST',
        body: JSON.stringify({ resolution, operator }),
      }),
    rejectConflict: (id: string, resolution: string, operator?: string) =>
      request<AcceptanceRecord>(`/records/${id}/conflict/reject`, {
        method: 'POST',
        body: JSON.stringify({ resolution, operator }),
      }),
    confirmName: (id: string, confirmedName: string, operator?: string) =>
      request<AcceptanceRecord>(`/records/${id}/name-review`, {
        method: 'POST',
        body: JSON.stringify({ confirmedName, operator }),
      }),
    updateSummary: (id: string, summary: string, operator?: string) =>
      request<AcceptanceRecord>(`/records/${id}/summary`, {
        method: 'POST',
        body: JSON.stringify({ summary, operator }),
      }),
    recalc: (id: string) =>
      request<AcceptanceRecord>(`/records/${id}/recalc`, {
        method: 'POST',
      }),
  },
  selfCheck: {
    runAll: () => request<SelfCheckResult>('/self-check'),
    checkDuplicate: () => request<SelfCheckResult['duplicateImport']>('/self-check/duplicate'),
    checkNameIssue: () => request<SelfCheckResult['communityNameIssue']>('/self-check/name-issue'),
    checkRecalc: () => request<SelfCheckResult['recalcConsistency']>('/self-check/recalc'),
    checkExportConsistency: () =>
      request<SelfCheckResult['exportConsistency']>('/self-check/export-consistency'),
  },
  export: {
    downloadDetail: () => {
      window.open('/api/export/detail', '_blank');
    },
    downloadSummary: () => {
      window.open('/api/export/summary', '_blank');
    },
    getDetailPreview: () => request<AcceptanceRecord[]>('/export/detail/preview'),
    getSummaryPreview: () => request<Array<Record<string, string>>>('/export/summary/preview'),
  },
};
