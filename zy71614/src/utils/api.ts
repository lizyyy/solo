import type { SettlementTask, BoxOfficeRecord, ShowSession, FilmContract, SettlementResult, VersionHistory } from '@/types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: '请求失败' }));
    throw new Error(err.message || err.error || '请求失败');
  }
  return res.json();
}

export async function fetchTasks(): Promise<SettlementTask[]> {
  const data = await request<{ data: SettlementTask[] }>('/tasks');
  return data.data;
}

export async function createTask(payload: { name: string; periodStart: string; periodEnd: string }): Promise<SettlementTask> {
  const data = await request<{ data: SettlementTask }>('/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.data;
}

export async function fetchTaskDetail(id: string): Promise<SettlementTask> {
  const data = await request<{ data: SettlementTask }>(`/tasks/${id}`);
  return data.data;
}

export async function saveTask(id: string): Promise<SettlementTask> {
  const data = await request<{ data: SettlementTask }>(`/tasks/${id}`, {
    method: 'PUT',
  });
  return data.data;
}

export async function withdrawTask(id: string, versionId?: string): Promise<SettlementTask> {
  const body = versionId ? JSON.stringify({ versionId }) : undefined;
  const data = await request<{ data: SettlementTask }>(`/tasks/${id}/withdraw`, {
    method: 'POST',
    body,
  });
  return data.data;
}

export async function fetchHistory(taskId: string): Promise<VersionHistory[]> {
  const data = await request<{ data: VersionHistory[] }>(`/tasks/${taskId}/history`);
  return data.data;
}

export async function importData(taskId: string, type: 'tickets' | 'refunds' | 'coupons' | 'shows' | 'contracts', data: any[]): Promise<void> {
  await request(`/tasks/${taskId}/import/${type}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchBoxOfficeRecords(taskId: string): Promise<BoxOfficeRecord[]> {
  const data = await request<{ data: BoxOfficeRecord[] }>(`/tasks/${taskId}/boxoffice`);
  return data.data;
}

export async function fetchShowSessions(taskId: string): Promise<ShowSession[]> {
  const data = await request<{ data: ShowSession[] }>(`/tasks/${taskId}/sessions`);
  return data.data;
}

export async function fetchFilmContracts(taskId: string): Promise<FilmContract[]> {
  const data = await request<{ data: FilmContract[] }>(`/tasks/${taskId}/contracts`);
  return data.data;
}

export async function fetchSettlementResults(taskId: string): Promise<SettlementResult[]> {
  const data = await request<{ data: SettlementResult[] }>(`/tasks/${taskId}/settlements`);
  return data.data;
}

export async function mapSessions(taskId: string): Promise<void> {
  await request(`/tasks/${taskId}/map-sessions`, { method: 'POST' });
}

export async function calculate(taskId: string): Promise<void> {
  await request(`/tasks/${taskId}/calculate`, { method: 'POST' });
}

export async function updateNote(recordId: string, diffNote: string): Promise<void> {
  await request(`/boxoffice/${recordId}/note`, {
    method: 'PUT',
    body: JSON.stringify({ diffNote }),
  });
}

export async function exportReport(taskId: string): Promise<Blob> {
  const res = await fetch(`${BASE}/tasks/${taskId}/export`, { method: 'POST' });
  if (!res.ok) throw new Error('导出失败');
  return res.blob();
}

export async function resumeTask(taskId: string): Promise<SettlementTask> {
  const data = await request<{ data: SettlementTask }>(`/tasks/${taskId}/resume`, {
    method: 'POST',
  });
  return data.data;
}
