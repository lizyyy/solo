import type {
  BikeRecord,
  ImportResult,
  ImportRawItem,
  UpdateRecordRequest,
  MergeRequest,
  MergeResult,
  ExportData,
  RecordStatus,
} from '@shared/types';

const API_BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorMessage = `请求失败: ${response.status}`;
    try {
      const errData = await response.json();
      if (errData.error) errorMessage = errData.error;
    } catch (e) {}
    throw new Error(errorMessage);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && (contentType.includes('text/csv') || contentType.includes('application/json') && url.includes('export'))) {
    return response.text() as unknown as T;
  }

  return response.json();
}

export const api = {
  health: () => request<{ success: boolean; message: string }>('/health'),

  records: {
    getAll: (status?: RecordStatus) =>
      request<BikeRecord[]>(status ? `/records?status=${status}` : '/records'),
    getById: (id: string) => request<BikeRecord>(`/records/${id}`),
    getStats: () =>
      request<{
        total: number;
        pending: number;
        processed: number;
        verify: number;
        onsite: number;
        withConflicts: number;
        oldCaliber: number;
      }>('/records/stats'),
    update: (id: string, data: UpdateRecordRequest) =>
      request<BikeRecord>(`/records/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateStatus: (id: string, status: RecordStatus, notes?: string) =>
      request<BikeRecord>(`/records/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, notes }),
      }),
    delete: (id: string) => request<{ success: boolean }>(`/records/${id}`, { method: 'DELETE' }),
    clearAll: () => request<{ success: boolean }>('/records/clear', { method: 'DELETE' }),
  },

  import: {
    preview: (content: string, format: 'json' | 'csv') =>
      request<ImportResult>('/records/import/preview', {
        method: 'POST',
        body: JSON.stringify({ content, format }),
      }),
    doImport: (content: string, format: 'json' | 'csv') =>
      request<ImportResult>('/records/import/import', {
        method: 'POST',
        body: JSON.stringify({ content, format }),
      }),
  },

  merge: {
    getCandidates: () =>
      request<Array<{ key: string; records: BikeRecord[] }>>('/records/merge/candidates'),
    getConflicts: () =>
      request<Array<{ record: BikeRecord; conflict: { type: string; humanMessage: string; relatedRecordIds: string[] } }>>(
        '/records/merge/conflicts'
      ),
    autoMerge: () =>
      request<{ mergedCount: number; results: MergeResult[] }>('/records/merge/auto', {
        method: 'POST',
      }),
    manualMerge: (data: MergeRequest) =>
      request<MergeResult>('/records/merge/manual', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  export: {
    preview: () => request<ExportData>('/export/preview'),
    downloadCSV: () =>
      fetch(`${API_BASE}/export/csv`).then(r => {
        const filename = r.headers.get('content-disposition')?.split('filename=')[1] || 'export.csv';
        return r.text().then(content => ({ content, filename }));
      }),
    downloadJSON: () =>
      fetch(`${API_BASE}/export/json`).then(r => {
        const filename = r.headers.get('content-disposition')?.split('filename=')[1] || 'export.json';
        return r.text().then(content => ({ content, filename }));
      }),
  },

  sample: {
    load: () =>
      request<{
        success: boolean;
        message: string;
        importResult: ImportResult;
        autoMergeResult: { mergedCount: number; results: MergeResult[] };
      }>('/sample/load', { method: 'POST' }),
    getRaw: () => request<{ records: ImportRawItem[] }>('/sample/raw'),
  },
};
