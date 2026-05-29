export type IndexStatus = 'covered' | 'partial' | 'missing'
export type IndexHitStatus = 'hit' | 'partial' | 'missing' | 'redundant'
export type WarningType = 'merge_conflict' | 'missing_index' | 'missing_interface' | 'time_window_mismatch' | 'missing_scan_rows'
export type Severity = 'critical' | 'warning' | 'info'
export type MappingSource = 'log_annotation' | 'trace_mapping' | 'manual' | 'none'
export type RecordStatus = 'processed' | 'pending' | 'returned'
export type ReportStatus = 'draft' | 'submitted' | 'archived'

export interface SlowQueryLog {
  id: string
  sql_text: string
  sql_fingerprint: string | null
  exec_time_ms: number
  scan_rows: number | null
  return_rows: number | null
  lock_time_ms: number | null
  timestamp: string
  interface_name: string | null
  table_name: string | null
  database: string | null
}

export interface Cluster {
  id: string
  fingerprint: string
  sql_summary: string
  count: number
  avg_scan_rows: number | null
  avg_exec_time_ms: number
  max_exec_time_ms: number
  index_status: IndexStatus
  confidence_score: number
}

export interface ClusterMember {
  id: string
  cluster_id: string
  log_id: string
  similarity_score: number
}

export interface IndexAnalysis {
  id: string
  cluster_id: string
  table_name: string
  current_indexes: string[]
  suggested_indexes: string[]
  index_status: IndexHitStatus
  explanation: string
}

export interface InterfaceMapping {
  id: string
  cluster_id: string
  interface_name: string
  mapping_source: MappingSource
  is_inferred: boolean
}

export interface QualityWarning {
  id: string
  cluster_id: string
  warning_type: WarningType
  severity: Severity
  message: string
  detail: string
}

export interface Report {
  id: string
  title: string
  time_range_start: string
  time_range_end: string
  created_at: string
  status: ReportStatus
}

export interface ReportRecord {
  id: string
  report_id: string
  cluster_id: string
  record_status: RecordStatus
  supplementary_data: Record<string, string>
  reviewed_by: string | null
  reviewed_at: string | null
}

export interface TimeWindow {
  start: string
  end: string
}

export interface TrendPoint {
  timestamp: string
  avg_exec_time_ms: number
  avg_scan_rows: number
  count: number
}
