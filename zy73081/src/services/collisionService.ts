import type {
  CollisionRecord,
  ListFilterParams,
  RejudgePayload,
  SummaryData,
  HistoryRecord,
} from '@/types';

const API_BASE = '/api/collisions';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '请求失败');
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function buildQuery(params?: ListFilterParams): string {
  if (!params) return '';
  const usp = new URLSearchParams();
  if (params.status && params.status !== 'ALL') usp.set('status', params.status);
  if (params.coordinateOffsetOnly) usp.set('coordinateOffsetOnly', 'true');
  if (params.keyword) usp.set('keyword', params.keyword);
  if (params.project && params.project !== 'ALL') usp.set('project', params.project);
  if (params.floor && params.floor !== 'ALL') usp.set('floor', params.floor);
  const q = usp.toString();
  return q ? `?${q}` : '';
}

export const CollisionService = {
  async list(params?: ListFilterParams): Promise<{ data: CollisionRecord[]; summary: SummaryData }> {
    const [data, summary] = await Promise.all([
      request<CollisionRecord[]>(`${API_BASE}${buildQuery(params)}`),
      request<SummaryData>(`${API_BASE}/summary`),
    ]);
    return { data, summary };
  },

  async get(id: string): Promise<CollisionRecord> {
    return request<CollisionRecord>(`${API_BASE}/${id}`);
  },

  async rejudge(id: string, payload: RejudgePayload): Promise<CollisionRecord> {
    return request<CollisionRecord>(`${API_BASE}/${id}/rejudge`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async toggleSample(id: string, isSample: boolean): Promise<CollisionRecord> {
    return request<CollisionRecord>(`${API_BASE}/${id}/sample`, {
      method: 'PATCH',
      body: JSON.stringify({ isSample }),
    });
  },

  async getHistory(id: string): Promise<HistoryRecord[]> {
    return request<HistoryRecord[]>(`${API_BASE}/${id}/history`);
  },

  async projects(): Promise<string[]> {
    return request<string[]>(`${API_BASE}/projects`);
  },

  async floors(): Promise<string[]> {
    return request<string[]>(`${API_BASE}/floors`);
  },

  getExportUrl(params?: ListFilterParams): string {
    return `${API_BASE}/export/csv${buildQuery(params)}`;
  },
};
