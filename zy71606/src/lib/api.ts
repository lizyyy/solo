export type RiskLevel = 'safe' | 'warning' | 'margin_call' | 'force_liquidation'
export type NotificationType = 'margin_call' | 'warning' | 'force_liquidation'
export type NotificationStatus = 'draft' | 'sent' | 'confirmed' | 'withdrawn' | 'partially_deducted' | 'settled'
export type MatchStatus = 'unmatched' | 'partially_matched' | 'matched'
export type ImportBatchStatus = 'pending' | 'validating' | 'confirmed' | 'cancelled'
export type ImportRecordStatus = 'pending' | 'success' | 'error' | 'skipped'
export type FileType = 'position' | 'market' | 'deposit' | 'notification'
export type MatchType = 'auto' | 'manual'

export interface Client {
  id: string
  name: string
  account: string
  equity: number
  margin_used: number
  risk_rate: number
  risk_level: RiskLevel
  updated_at: string
}

export interface Position {
  id: string
  client_id: string
  contract_id: string
  direction: 'long' | 'short'
  volume: number
  open_price: number
  margin: number
}

export interface Contract {
  id: string
  code: string
  name: string
  exchange: string
}

export interface MarketSnapshot {
  id: string
  contract_id: string
  last_price: number
  change_pct: number
  snapshot_time: string
  source: string
  contract?: Contract
}

export interface Notification {
  id: string
  client_id: string
  type: NotificationType
  status: NotificationStatus
  margin_shortfall: number
  content: string
  idempotency_key: string
  created_at: string
  sent_at: string | null
  withdrawn_at: string | null
  client?: Client
}

export interface NotificationStatusLog {
  id: string
  notification_id: string
  from_status: NotificationStatus
  to_status: NotificationStatus
  reason: string | null
  created_at: string
}

export interface Deposit {
  id: string
  client_id: string
  amount: number
  deposit_time: string
  match_status: MatchStatus
  source_file: string | null
  source_line: number | null
  client?: Client
  hint?: string
}

export interface DepositMatch {
  id: string
  deposit_id: string
  notification_id: string
  matched_amount: number
  matched_at: string
  match_type: MatchType
  notification?: Notification
}

export interface ImportBatch {
  id: string
  file_name: string
  file_type: FileType
  status: ImportBatchStatus
  total_rows: number
  success_rows: number
  error_rows: number
  created_at: string
}

export interface ImportRecord {
  id: string
  batch_id: string
  row_number: number
  data_type: FileType
  raw_content: string
  status: ImportRecordStatus
  error_message: string | null
}

export interface Report {
  id: string
  title: string
  filter_params: string
  generated_at: string
  generated_by: string
}

export interface ReportSnapshot {
  id: string
  report_id: string
  content_json: string
  snapshot_at: string
}

export interface BusinessError {
  sourceFile: string
  sourceLine: number
  objectKey: string
  message: string
  severity: 'warning' | 'error' | 'fatal'
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ClientFilters {
  search?: string
  risk_level?: RiskLevel
  page?: number
  pageSize?: number
}

export interface NotificationFilters {
  client_id?: string
  type?: NotificationType
  status?: NotificationStatus
  start_date?: string
  end_date?: string
  page?: number
  pageSize?: number
}

export interface DepositFilters {
  client_id?: string
  match_status?: MatchStatus
  start_date?: string
  end_date?: string
  page?: number
  pageSize?: number
}

export interface ReportFilters {
  start_date?: string
  end_date?: string
  risk_level?: RiskLevel
  page?: number
  pageSize?: number
}

const BASE_URL = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (!res.ok) {
    throw json.error || json
  }
  return json.data as T
}

export const clientsApi = {
  getClients: (filters?: ClientFilters) => {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)) })
    }
    return request<PaginatedResponse<Client>>(`/clients?${params}`)
  },
  getClient: (id: string) => request<Client>(`/clients/${id}`),
  getClientRisk: (id: string) => request<{ risk_rate: number; risk_level: RiskLevel }>(`/clients/${id}/risk`),
}

export const marketApi = {
  getMarketSnapshot: () => request<MarketSnapshot[]>('/market/snapshot'),
}

export const notificationsApi = {
  getNotifications: (filters?: NotificationFilters) => {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)) })
    }
    return request<PaginatedResponse<Notification>>(`/notifications?${params}`)
  },
  createNotification: (data: {
    client_id: string
    type: NotificationType
    margin_shortfall: number
    content: string
  }) => request<Notification>('/notifications', { method: 'POST', body: JSON.stringify(data) }),
  updateNotification: (id: string, data: Partial<Notification>) =>
    request<Notification>(`/notifications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  sendNotification: (id: string) =>
    request<Notification>(`/notifications/${id}/send`, { method: 'POST' }),
  withdrawNotification: (id: string, reason: string) =>
    request<Notification>(`/notifications/${id}/withdraw`, { method: 'POST', body: JSON.stringify({ reason }) }),
  checkDuplicate: (clientId: string, type: NotificationType, date: string) =>
    request<{ isDuplicate: boolean; existing?: Notification }>(
      `/notifications/check-dup?client_id=${clientId}&type=${type}&date=${date}`
    ),
}

export const importApi = {
  uploadFiles: (formData: FormData) =>
    request<ImportBatch[]>('/import/upload', {
      method: 'POST',
      headers: {},
      body: formData,
    }),
  getImportStatus: (batchId: string) =>
    request<{ batch: ImportBatch; records: ImportRecord[] }>(`/import/${batchId}/status`),
  confirmImport: (batchId: string) =>
    request<{ merged: number; preserved: number; risk_updated: number }>(`/import/${batchId}/confirm`, { method: 'POST' }),
  cancelImport: (batchId: string) =>
    request<void>(`/import/${batchId}/cancel`, { method: 'DELETE' }),
}

export const depositsApi = {
  getDeposits: (filters?: DepositFilters) => {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)) })
    }
    return request<PaginatedResponse<Deposit>>(`/deposits?${params}`)
  },
  createDeposit: (data: { client_id: string; amount: number; deposit_time: string }) =>
    request<Deposit>('/deposits', { method: 'POST', body: JSON.stringify(data) }),
  triggerAutoMatch: () =>
    request<{ matched: number }>('/deposits/match', { method: 'POST' }),
  manualMatch: (depositId: string, notificationId: string, amount: number) =>
    request<DepositMatch>(`/deposits/${depositId}/manual-match`, {
      method: 'POST',
      body: JSON.stringify({ notification_id: notificationId, matched_amount: amount }),
    }),
  getUnmatched: () => request<Deposit[]>('/deposits/unmatched'),
}

export const reportsApi = {
  generateReport: (filters: ReportFilters) =>
    request<Report>('/reports/generate', { method: 'POST', body: JSON.stringify(filters) }),
  getReports: (filters?: ReportFilters) => {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)) })
    }
    return request<PaginatedResponse<Report>>(`/reports?${params}`)
  },
  getReport: (id: string) => request<Report & { content: ReportSnapshot }>(`/reports/${id}`),
  exportReport: (id: string, format: 'csv' | 'xlsx') =>
    `${BASE_URL}/reports/${id}/export?format=${format}`,
  getReportHistory: () => request<ReportSnapshot[]>('/reports/histories'),
}
