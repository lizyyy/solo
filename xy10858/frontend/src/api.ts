import type { ApiResponse, SynonymGroup, PublishBatch, BatchItem, SynonymVersion, TestQuery, HitChange, RollbackAudit, StatusHistory } from './types';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }
  return data.data;
}

export const synonymGroupsApi = {
  list: () => request<SynonymGroup[]>('/synonym-groups'),
  get: (id: string) => request<SynonymGroup>(`/synonym-groups/${id}`),
  create: (data: any) => request<SynonymGroup>('/synonym-groups', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<SynonymGroup>(`/synonym-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string, reason?: string) =>
    request<SynonymGroup>(`/synonym-groups/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, reason }) }),
  versions: (id: string) => request<SynonymVersion[]>(`/synonym-groups/${id}/versions`),
  testQueries: (id: string) => request<TestQuery[]>(`/synonym-groups/${id}/test-queries`),
  addTestQuery: (id: string, query: string, expected_hits?: number) =>
    request<TestQuery>(`/synonym-groups/${id}/test-queries`, { method: 'POST', body: JSON.stringify({ query, expected_hits }) }),
};

export const publishBatchesApi = {
  list: () => request<PublishBatch[]>('/publish-batches'),
  get: (id: string) => request<PublishBatch>(`/publish-batches/${id}`),
  create: (data: any) => request<PublishBatch>('/publish-batches', { method: 'POST', body: JSON.stringify(data) }),
  items: (id: string) => request<BatchItem[]>(`/publish-batches/${id}/items`),
  updateStatus: (id: string, status: string, reason?: string) =>
    request<PublishBatch>(`/publish-batches/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, reason }) }),
  simulate: (id: string) => request<any>(`/publish-batches/${id}/simulate`, { method: 'POST' }),
  publish: (id: string) => request<PublishBatch>(`/publish-batches/${id}/publish`, { method: 'POST' }),
  rollback: (id: string, reason: string) =>
    request<PublishBatch>(`/publish-batches/${id}/rollback`, { method: 'POST', body: JSON.stringify({ reason }) }),
  hitChanges: (id: string) => request<HitChange[]>(`/publish-batches/${id}/hit-changes`),
  rollbackAudits: (id: string) => request<RollbackAudit[]>(`/publish-batches/${id}/rollback-audits`),
  export: (id: string) => request<any[]>(`/publish-batches/${id}/export`),
};

export const statusHistoryApi = {
  get: (entityType: 'synonym_group' | 'publish_batch', entityId: string) =>
    request<StatusHistory[]>(`/status-history/${entityType}/${entityId}`),
};

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}
