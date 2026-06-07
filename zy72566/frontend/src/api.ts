import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

export interface EvaluationSlice {
  id: number
  slice_name: string
  import_time: string
  imported_by: string
  total_count: number
  abnormal_count: number
  description?: string
}

export interface ReconciliationRecord {
  id: number
  slice_id: number
  original_row_number: number
  sample_id?: string
  sample_type?: string
  is_minority: boolean
  recall_rate?: number
  precision_rate?: number
  total_metric?: number
  feature_snapshot_id?: string
  feature_snapshot_added_by?: string
  feature_snapshot_added_time?: string
  threshold_value?: number
  threshold_replay_result?: string
  threshold_updated_by?: string
  threshold_updated_time?: string
  is_masked_by_total: boolean
  status: string
  manual_note?: string
  reviewed_by?: string
  reviewed_time?: string
  created_at: string
  updated_at?: string
}

export interface AuditLog {
  id: number
  record_id: number
  action: string
  previous_value?: string
  new_value?: string
  operator: string
  operation_time: string
  remark?: string
}

export const statusLabels: Record<string, string> = {
  step1_imported: '步骤1: 已导入',
  step2_feature_added: '步骤2: 已补特征快照',
  step3_threshold_updated: '步骤3: 已阈值回放',
  pending_review: '待算法复核',
  confirmed_normal: '已确认正常',
  confirmed_abnormal: '已确认异常',
  rollback: '已回滚',
}

export const statusColors: Record<string, string> = {
  step1_imported: 'default',
  step2_feature_added: 'processing',
  step3_threshold_updated: 'processing',
  pending_review: 'warning',
  confirmed_normal: 'success',
  confirmed_abnormal: 'error',
  rollback: 'default',
}

export const sliceApi = {
  getSlices: () => api.get<EvaluationSlice[]>('/slices'),
  getSlice: (id: number) => api.get<EvaluationSlice>(`/slices/${id}`),
  createSlice: (data: { slice_name: string; description?: string; imported_by: string; records: any[] }) =>
    api.post('/slices', data),
  getRecords: (sliceId: number, params?: any) =>
    api.get<ReconciliationRecord[]>(`/slices/${sliceId}/records`, { params }),
  exportRecords: (sliceId: number) =>
    api.get(`/slices/${sliceId}/export`, { responseType: 'blob' }),
}

export const recordApi = {
  getDetail: (id: number) => api.get<ReconciliationRecord & { audit_logs: AuditLog[] }>(`/records/${id}`),
  getAuditLogs: (id: number) => api.get<AuditLog[]>(`/records/${id}/audit-logs`),
  addFeatureSnapshot: (id: number, data: { feature_snapshot_id: string; operator: string; note?: string }) =>
    api.put<ReconciliationRecord>(`/records/${id}/feature-snapshot`, data),
  updateThreshold: (id: number, data: { threshold_value: number; threshold_replay_result: string; operator: string; note?: string }) =>
    api.put<ReconciliationRecord>(`/records/${id}/threshold-replay`, data),
  review: (id: number, data: { status: string; reviewed_by: string; manual_note?: string }) =>
    api.put<ReconciliationRecord>(`/records/${id}/review`, data),
  rollback: (id: number, params: { operator: string; target_step?: string; remark?: string }) =>
    api.put<ReconciliationRecord>(`/records/${id}/rollback`, null, { params }),
  markPending: (id: number, params: { operator: string; remark?: string }) =>
    api.put<ReconciliationRecord>(`/records/${id}/mark-pending`, null, { params }),
}

export const boundaryRulesApi = {
  getRules: () => api.get('/boundary-rules'),
}

export default api
