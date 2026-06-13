import type {
  BatchImportInput,
  BatchOverview,
  ConflictEvidence,
  GrayBatch,
  HistoryItem,
  ResolveConflictInput,
  ReviewSampleInput,
  Sample,
  SelfCheckReport,
  SupplementInput,
} from '../../shared/types';

const baseURL = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(baseURL + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getBatches: (): Promise<GrayBatch[]> =>
    request('/batches'),
  getBatch: (id: string): Promise<{ batch: GrayBatch; overview: BatchOverview; samples: { lowConfidence: Sample[]; normal: Sample[]; all: Sample[] } }> =>
    request(`/batches/${id}`),
  importBatch: (payload: BatchImportInput): Promise<{ batch: GrayBatch; overview: BatchOverview; skipped: number; added: number }> =>
    request('/batches', { method: 'POST', body: JSON.stringify(payload) }),
  recalcBatch: (id: string): Promise<BatchOverview> =>
    request(`/batches/${id}/recalc`, { method: 'POST', body: JSON.stringify({ operator: '知识库编辑小乔' }) }),
  getSample: (id: string): Promise<Sample> =>
    request(`/samples/${id}`),
  reviewSample: (id: string, payload: ReviewSampleInput): Promise<Sample> =>
    request(`/samples/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  supplementSamples: (payload: SupplementInput): Promise<{ added: number; skipped: number; samples: Sample[] }> =>
    request('/samples/supplement', { method: 'POST', body: JSON.stringify(payload) }),
  getConflicts: (batchId: string): Promise<ConflictEvidence[]> =>
    request(`/conflicts/${batchId}`),
  resolveConflict: (id: string, payload: ResolveConflictInput): Promise<ConflictEvidence> =>
    request(`/conflicts/${id}/resolve`, { method: 'POST', body: JSON.stringify(payload) }),
  getHistory: (sampleId: string): Promise<HistoryItem[]> =>
    request(`/samples/${sampleId}/history`),
  exportBatch: (batchId: string, format: 'json' | 'csv'): Promise<Blob> =>
    fetch(baseURL + `/export/${batchId}?format=${format}`).then(r => r.blob()),
  runSelfCheck: (batchId: string): Promise<SelfCheckReport> =>
    request(`/selfcheck/${batchId}`),
};
