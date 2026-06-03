const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || '请求失败')
  return json.data as T
}

export interface Batch {
  id: string
  name: string
  created_at: string
  status: 'importing' | 'comparing' | 'reviewing' | 'completed'
  total_records: number
  discrepancy_count: number
  conflict_count: number
  pending_review_count: number
}

export interface ConfirmationRecord {
  id: string
  batch_id: string
  business_no: string
  type: string
  ex_dividend_date: string | null
  amount: number
  fee_amount: number | null
  principal_amount: number | null
  tax_rate: number | null
  tax_rate_remark: string | null
  caliber_type: string | null
  source: string
  status: string
  split_detail: string | null
  created_at: string
}

export interface Discrepancy {
  id: string
  batch_id: string
  business_no: string
  record_id: string | null
  type: string
  severity: string
  description: string
  evidence: {
    confirmationData?: Record<string, unknown>
    taxRemarkData?: Record<string, unknown>
  } | null
  status: string
  resolution: {
    decidedBy: string
    decision: 'confirm_screenshot' | 'confirm_remark' | 'reject_both'
    reason: string
    decidedAt: string
  } | null
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  batch_id: string
  action: string
  actor: string
  role: string
  detail: Record<string, unknown> | null
  timestamp: string
}

export interface ReplayData {
  batchId: string
  batchName: string
  commands: {
    import: string
    compare: string
    resolve: string | null
  }
  fullCommand: string
  generatedAt: string
}

export const api = {
  getBatches: () => request<Batch[]>('/batches'),

  createBatch: (name: string) =>
    request<Batch>('/batches', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  getBatchDetail: (id: string) =>
    request<Batch & { records: ConfirmationRecord[]; discrepancies: Discrepancy[] }>(`/batches/${id}`),

  getRecords: (filters?: Record<string, string>) => {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : ''
    return request<ConfirmationRecord[]>(`/records${params}`)
  },

  getRecordDetail: (id: string) =>
    request<ConfirmationRecord & { discrepancy: Discrepancy | null }>(`/records/${id}`),

  importRecords: (batchId: string, records: Record<string, unknown>[]) =>
    request<{ importedCount: number; records: unknown[]; discrepancies: unknown[] }>('/records/import', {
      method: 'POST',
      body: JSON.stringify({ batchId, records }),
    }),

  taxRemarkReview: (batchId: string, records: Record<string, unknown>[]) =>
    request<{ reviewedCount: number; newDiscrepancies: unknown[] }>('/records/tax-remark-review', {
      method: 'POST',
      body: JSON.stringify({ batchId, records }),
    }),

  getDiscrepancies: (filters?: Record<string, string>) => {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : ''
    return request<Discrepancy[]>(`/discrepancies${params}`)
  },

  getDiscrepancyDetail: (id: string) =>
    request<Discrepancy & { record: ConfirmationRecord | null }>(`/discrepancies/${id}`),

  resolveConflict: (id: string, resolution: { decidedBy: string; decision: string; reason: string }) =>
    request<Discrepancy>(`/discrepancies/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(resolution),
    }),

  compareBatch: (batchId: string) =>
    request<{ batchId: string; newDiscrepanciesCount: number }>('/discrepancies/compare', {
      method: 'POST',
      body: JSON.stringify({ batchId }),
    }),

  getAuditLogs: (filters?: Record<string, string>) => {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : ''
    return request<AuditLog[]>(`/audit-logs${params}`)
  },

  getReplayCommand: (batchId: string) =>
    request<ReplayData>(`/replay-command/${batchId}`),

  executeReplay: (batchId: string) =>
    request<{ message: string; batchId: string; recordCount: number }>('/replay-command/execute', {
      method: 'POST',
      body: JSON.stringify({ batchId }),
    }),
}
