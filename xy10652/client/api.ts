import {
  Supplier,
  SampleBatch,
  ReviewScore,
  RectificationOpinion,
  ReshipLogistics,
  VersionFinalization,
  ChangeLog,
  Statistics
} from './types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

export const supplierApi = {
  getAll: () => request<Supplier[]>('/suppliers'),
  create: (data: Partial<Supplier>) => request<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Supplier>) => request<Supplier>(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) })
};

export const batchApi = {
  getAll: (filters?: any) => {
    const query = new URLSearchParams(filters).toString();
    return request<SampleBatch[]>(`/batches${query ? '?' + query : ''}`);
  },
  getById: (id: string) => request<SampleBatch>(`/batches/${id}`),
  validate: (batchNo: string) => request<{ valid: boolean; message: string; batch: SampleBatch | null; latestReview: ReviewScore | null; finalization: VersionFinalization | null }>(`/batches/validate/${batchNo}`),
  create: (data: Partial<SampleBatch>) => request<SampleBatch>('/batches', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<SampleBatch>) => request<SampleBatch>(`/batches/${id}`, { method: 'PUT', body: JSON.stringify(data) })
};

export const reviewApi = {
  getByBatchId: (batchId: string) => request<ReviewScore[]>(`/batches/${batchId}/reviews`),
  create: (data: Partial<ReviewScore>) => request<ReviewScore>('/reviews', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<ReviewScore>) => request<ReviewScore>(`/reviews/${id}`, { method: 'PUT', body: JSON.stringify(data) })
};

export const rectificationApi = {
  getByBatchId: (batchId: string) => request<RectificationOpinion[]>(`/batches/${batchId}/rectifications`),
  create: (data: Partial<RectificationOpinion>) => request<RectificationOpinion>('/rectifications', { method: 'POST', body: JSON.stringify(data) }),
  advance: (id: string, status: string) => request<RectificationOpinion>(`/rectifications/${id}/advance`, { method: 'PUT', body: JSON.stringify({ status }) })
};

export const logisticsApi = {
  getByBatchId: (batchId: string) => request<ReshipLogistics[]>(`/batches/${batchId}/logistics`),
  create: (data: Partial<ReshipLogistics>) => request<ReshipLogistics>('/logistics', { method: 'POST', body: JSON.stringify(data) })
};

export const finalizationApi = {
  getByBatchId: (batchId: string) => request<VersionFinalization>(`/batches/${batchId}/finalization`),
  create: (data: Partial<VersionFinalization>) => request<VersionFinalization>('/finalizations', { method: 'POST', body: JSON.stringify(data) })
};

export const statisticsApi = {
  getOverview: () => request<Statistics>('/statistics/overview')
};

export const changeLogApi = {
  getByRecord: (tableName: string, recordId: string) => request<ChangeLog[]>(`/change-logs/${tableName}/${recordId}`)
};

export const exportApi = {
  downloadReport: (filters?: { responsible_person?: string; start_date?: string; end_date?: string }) => {
    const query = new URLSearchParams(filters as any).toString();
    window.open(`${API_BASE}/export/report${query ? '?' + query : ''}`, '_blank');
  }
};
