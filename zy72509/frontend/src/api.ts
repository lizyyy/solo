import axios from 'axios';
import { AnnotationRecord, ReviewStatus, ImportResult, SelfCheckResult } from './types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export async function getRecords(params: {
  page?: number;
  pageSize?: number;
  status?: ReviewStatus;
  keyword?: string;
}): Promise<{ records: AnnotationRecord[]; total: number }> {
  const res = await api.get('/records', { params });
  return res.data;
}

export async function getRecord(id: string): Promise<AnnotationRecord> {
  const res = await api.get(`/records/${id}`);
  return res.data;
}

export async function createRecord(data: Partial<AnnotationRecord>): Promise<AnnotationRecord> {
  const res = await api.post('/records', data);
  return res.data;
}

export async function updateRecord(id: string, data: Partial<AnnotationRecord>): Promise<AnnotationRecord> {
  const res = await api.put(`/records/${id}`, data);
  return res.data;
}

export async function confirmRecord(id: string): Promise<AnnotationRecord> {
  const res = await api.post(`/records/${id}/confirm`);
  return res.data;
}

export async function rejectRecord(id: string): Promise<AnnotationRecord> {
  const res = await api.post(`/records/${id}/reject`);
  return res.data;
}

export async function sendToAlgorithmReview(id: string): Promise<AnnotationRecord> {
  const res = await api.post(`/records/${id}/algorithm-review`);
  return res.data;
}

export async function importExcel(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function exportExcel(ids?: string[]): Promise<void> {
  const params = ids ? { ids: ids.join(',') } : {};
  const res = await api.get('/export', { params, responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `越权拦截记录_${Date.now()}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function runSelfCheck(): Promise<{ results: SelfCheckResult[]; count: number }> {
  const res = await api.post('/self-check/run');
  return res.data;
}

export async function getSelfCheckResults(all?: boolean): Promise<SelfCheckResult[]> {
  const res = await api.get('/self-check', { params: all ? { all: 1 } : {} });
  return res.data;
}

export async function resolveSelfCheck(id: string): Promise<void> {
  await api.post(`/self-check/${id}/resolve`);
}

export async function getConflicts(): Promise<{ record: AnnotationRecord; evidence: string[] }[]> {
  const res = await api.get('/conflicts');
  return res.data;
}
