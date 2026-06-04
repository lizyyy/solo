import type {
  ImportHistoryItem,
  ReviewRecord,
  BatchData,
  SelfcheckResult,
  AuditEntry,
  ExportVerifyResult,
  SensorChange,
} from '@/types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Request failed');
  return json.data as T;
}

type CurrentImport = {
  totalRows: number;
  duplicateRows: number;
  anomalies: number;
  id: string;
};

type UpdateRecordBody = { status?: string; current_step?: number };
type EditRecordBody = { field: string; new_value: string; edited_by: string };
type ConfirmSensorChangeBody = { action: string; reviewed_by: string; note?: string };

export const api = {
  import: {
    upload: (formData: FormData) => request<CurrentImport>('/import/upload', { method: 'POST', body: formData }),
    history: () => request<ImportHistoryItem[]>('/import/history'),
  },
  review: {
    batch: (importId: string) => request<BatchData>(`/review/batch/${importId}`),
    updateRecord: (recordId: string, body: UpdateRecordBody) => request<ReviewRecord>(`/review/record/${recordId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    editRecord: (recordId: string, body: EditRecordBody) => request<ReviewRecord>(`/review/record/${recordId}/edit`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    confirmSensorChange: (changeId: string, body: ConfirmSensorChangeBody) => request<SensorChange>(`/review/sensor-change/${changeId}/confirm`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  },
  selfcheck: {
    run: (importId: string) => request<SelfcheckResult[]>(`/selfcheck/run/${importId}`),
    results: (importId: string) => request<SelfcheckResult[]>(`/selfcheck/results/${importId}`),
  },
  audit: {
    record: (recordId: string) => request<AuditEntry[]>(`/audit/record/${recordId}`),
    batch: (importId: string) => request<AuditEntry[]>(`/audit/batch/${importId}`),
  },
  export: {
    download: (importId: string, scope: string) => `${BASE}/export/${importId}?scope=${scope}`,
    verify: (importId: string) => request<ExportVerifyResult>(`/export/verify/${importId}`),
  },
};
