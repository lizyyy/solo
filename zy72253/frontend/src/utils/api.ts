const API_BASE = '/api';

export interface ImportResult {
  imported: number;
  skipped_duplicates: number;
  mixed_coord_count: number;
}

export interface RecordListItem {
  id: string;
  batch_id: string;
  coord_type: string;
  needs_review: boolean;
  distance: number | null;
  recorded_at: string | null;
  imported_at: string;
}

export interface TracebackResult {
  record: {
    id: string;
    batch_id: string;
    raw_data: string;
    coord_type: string;
    needs_review: boolean;
    recorded_at: string | null;
    imported_at: string;
  };
  remarks: {
    id: string;
    author: string;
    content: string;
    created_at: string;
    updated_at: string;
  }[];
  snapshots: {
    id: string;
    stage: string;
    snapshot_data: Record<string, unknown>;
    created_at: string;
  }[];
  reports: {
    id: string;
    why_kept: string;
    missing_materials: string;
    next_step_owner: string;
    next_step_description: string;
    param_version: string | null;
    param_tradeoff_reason: string | null;
  }[];
}

export interface SnapshotItem {
  id: string;
  stage: string;
  snapshot_data: Record<string, unknown>;
  model_params_version: string | null;
  model_params_reason: string | null;
  created_at: string;
}

export interface RemarkHistoryItem {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_at: string;
  reason: string | null;
}

export async function importRecords(batchId: string, records: Record<string, unknown>[]): Promise<ImportResult> {
  const res = await fetch(`${API_BASE}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batch_id: batchId, records }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listRecords(filters?: { batch_id?: string; coord_type?: string; needs_review?: boolean }): Promise<RecordListItem[]> {
  const params = new URLSearchParams();
  if (filters?.batch_id) params.set('batch_id', filters.batch_id);
  if (filters?.coord_type) params.set('coord_type', filters.coord_type);
  if (filters?.needs_review !== undefined) params.set('needs_review', String(filters.needs_review));
  const res = await fetch(`${API_BASE}/records?${params}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addRemark(recordId: string, author: string, content: string) {
  const res = await fetch(`${API_BASE}/remark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ record_id: recordId, author, content }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateRemark(remarkId: string, newContent: string, changedBy: string, reason?: string) {
  const res = await fetch(`${API_BASE}/remark/${remarkId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_content: newContent, changed_by: changedBy, reason }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getRemarkHistory(remarkId: string): Promise<RemarkHistoryItem[]> {
  const res = await fetch(`${API_BASE}/remark/${remarkId}/history`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function submitCrewBriefing(data: {
  record_id: string;
  why_kept: string;
  missing_materials: string;
  next_step_owner: string;
  next_step_description: string;
  param_version?: string;
  param_tradeoff_reason?: string;
}) {
  const res = await fetch(`${API_BASE}/crew-briefing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getTraceback(recordId: string): Promise<TracebackResult> {
  const res = await fetch(`${API_BASE}/traceback/${recordId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSnapshotHistory(recordId: string): Promise<SnapshotItem[]> {
  const res = await fetch(`${API_BASE}/snapshot-history/${recordId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getReport(reportId: string): Promise<{ report_text: string }> {
  const res = await fetch(`${API_BASE}/report/${reportId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
