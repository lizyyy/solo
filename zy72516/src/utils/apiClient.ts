import { AnnotationRecord } from '../types';

const API_BASE = '/api';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  total?: number;
  timestamp: string;
}

export async function fetchRecords(): Promise<ApiResponse<AnnotationRecord[]>> {
  const res = await fetch(`${API_BASE}/records`);
  return res.json();
}

export async function fetchRecordById(id: string): Promise<ApiResponse<AnnotationRecord>> {
  const res = await fetch(`${API_BASE}/records/${id}`);
  return res.json();
}

export interface RecordSnapshotResponse {
  current: {
    annotatorMessage: string;
    referenceUrl: string;
    urlStatus: boolean;
    robotJudgment: string;
    modelOutputSnippet: string | null;
    modelOutputName: string | null;
    modelOutputConfidence: number | null;
    currentStatus: string;
    abnormalType: string;
    modelOutputMissing: boolean;
    lastOperator: string | null;
    updatedAt: string;
  };
  original: {
    annotatorMessage: string;
    referenceUrl: string;
    urlStatus: boolean;
    robotJudgment: string;
    modelOutputSnippet?: string;
    modelOutputName?: string;
    modelOutputConfidence?: number;
    status: string;
    abnormalType: string;
  };
  history: Array<{
    action: string;
    operator: string;
    operatedAt: string;
    remark: string;
    fromStatus: string;
    toStatus: string;
    diffSummary: string[];
    fromSnapshot: any;
    toSnapshot: any;
  }>;
}

export async function fetchRecordSnapshot(id: string): Promise<ApiResponse<RecordSnapshotResponse>> {
  const res = await fetch(`${API_BASE}/records/${id}/snapshot`);
  return res.json();
}

export async function syncToServer(records: AnnotationRecord[], currentOperator: string, initialized: boolean): Promise<ApiResponse<{ synced: number }>> {
  const res = await fetch(`${API_BASE}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records, currentOperator, initialized })
  });
  return res.json();
}

export async function fetchReport(): Promise<ApiResponse<any>> {
  const res = await fetch(`${API_BASE}/report`);
  return res.json();
}
