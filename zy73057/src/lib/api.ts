import type {
  ScheduleBatch,
  ScheduleItem,
  ScheduleListFilters,
  OverrideRecord,
  ReplaceAction,
  Snapshot,
  MaintenancePhoto,
  FilterSignaturePayload,
  BatchWithItems,
} from '../../shared/types';

const BASE = '/api';

async function request<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || body?.message || '请求失败');
    if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
      return body.data as T;
    }
    if (body && typeof body === 'object' && body.success === false) {
      throw new Error(body.error || body.message || '请求失败');
    }
    return body as T;
  }
  // 非 JSON（CSV 等），把 headers 挂到返回（上层需要签名）
  const text = await res.text();
  return { __text: text, __headers: Object.fromEntries(res.headers.entries()) } as any;
}

// ====== Schedules ======
export interface ListResult {
  batches: ScheduleBatch[];
  items: ScheduleItem[];
}

export function fetchList(filters: ScheduleListFilters): Promise<ListResult> {
  const q = new URLSearchParams();
  const push = (k: string, v: any) => { if (v !== undefined && v !== null && v !== '') q.append(k, String(v)); };
  push('dateFrom', filters.dateFrom);
  push('dateTo', filters.dateTo);
  push('isOverridden', filters.isOverridden);
  (filters.batchIds || []).forEach((v) => q.append('batchIds', v));
  (filters.elevatorNos || []).forEach((v) => q.append('elevatorNos', v));
  (filters.partNos || []).forEach((v) => q.append('partNos', v));
  (filters.statuses || []).forEach((v) => q.append('statuses', v));
  return request<ListResult>(`/schedules?${q.toString()}`);
}

export function fetchBatchDetail(batchId: string) {
  return request<{
    batch: ScheduleBatch;
    items: ScheduleItem[];
    photos: MaintenancePhoto[];
    overrides: OverrideRecord[];
  }>(`/schedules/${encodeURIComponent(batchId)}`);
}

export function postRerun(batchId: string, supplementaryPhotos: Array<{ note: string }>) {
  return request<{
    batch: ScheduleBatch;
    items: ScheduleItem[];
    snapshot: Snapshot;
  }>(`/schedules/${encodeURIComponent(batchId)}/rerun`, {
    method: 'POST',
    body: JSON.stringify({ supplementaryPhotos }),
  });
}

export function fetchSnapshots(batchId: string) {
  return request<Snapshot[]>(`/schedules/${encodeURIComponent(batchId)}/snapshots`);
}

// ====== Overrides ======
export interface CreateOverridePayload {
  itemId: string;
  batchId: string;
  reason: string;
  impactExplanation: string;
  before: { partNo: string; partName: string; qty: number };
  after: { partNo: string; partName: string; qty: number };
  createdBy: string;
}

export function createOverride(p: CreateOverridePayload) {
  return request<{ override: OverrideRecord; impactedItem: ScheduleItem; action?: ReplaceAction }>(
    '/overrides',
    { method: 'POST', body: JSON.stringify(p) },
  );
}

export function fetchOverrideImpact(id: string) {
  return request<{ override: OverrideRecord; summary: { affectedItems: number; delta: number } }>(
    `/overrides/${encodeURIComponent(id)}/impact`,
  );
}

// ====== Replace Actions ======
export function fetchReplaceActions(batchId?: string) {
  const q = batchId ? `?batchId=${encodeURIComponent(batchId)}` : '';
  return request<ReplaceAction[]>(`/replace-actions${q}`);
}

export function patchReplaceAction(id: string, patch: Partial<Pick<ReplaceAction, 'status' | 'assignee' | 'blockingNote'>>) {
  return request<ReplaceAction>(`/replace-actions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

// ====== Photos ======
export function uploadPhoto(p: { itemId: string; batchId: string; url: string; uploadedBy: string; supplementaryNote?: string; isSupplementary?: boolean }) {
  return request<MaintenancePhoto>('/photos', { method: 'POST', body: JSON.stringify(p) });
}

// ====== Export ======
export interface ExportResult {
  csv: string;
  signature: string;
  signatureMeta: FilterSignaturePayload;
}

export async function exportSchedules(filters: ScheduleListFilters): Promise<ExportResult> {
  const raw = await request<any>('/export/schedules', {
    method: 'POST',
    body: JSON.stringify(filters),
  });
  const headers: Record<string, string> = (raw as any).__headers || {};
  let signatureMeta: FilterSignaturePayload | null = null;
  try {
    const meta = headers['x-filter-signature-meta'] || headers['X-Filter-Signature-Meta'];
    if (meta) signatureMeta = JSON.parse(decodeURIComponent(meta));
  } catch {}
  return {
    csv: (raw as any).__text || '',
    signature: headers['x-filter-signature'] || '',
    signatureMeta: signatureMeta as FilterSignaturePayload,
  };
}

// ====== Retrieve ======
export function retrieveBySignature(signature: string) {
  return request<FilterSignaturePayload & { matchedItems?: ScheduleItem[]; matchedBatches?: ScheduleBatch[] }>(
    '/retrieve',
    { method: 'POST', body: JSON.stringify({ signature }) },
  );
}
