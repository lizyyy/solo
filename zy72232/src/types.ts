export type RecordStatus = 'normal' | 'inconsistent' | 'supplemented' | 'confirmed'

export interface LedgerRecord {
  id: string
  trade_no: string
  institution_name_source1: string
  institution_name_source2: string
  institution_name_consistent: number
  ex_rights_date: string
  extension_date: string
  tax_rate: number | null
  tax_rate_remark: string
  tax_rate_source: 'original' | 'supplemented'
  status: RecordStatus
  screenshot_id: string | null
  created_at: string
  updated_at: string
}

export interface OperationLog {
  id: string
  record_id: string | null
  action: 'import' | 'detect' | 'supplement' | 'correct' | 'rerun' | 'confirm' | 'reject'
  detail: string
  cli_command: string
  operator: string
  timestamp: string
}

export interface Screenshot {
  id: string
  record_id: string
  filename: string
  data_url: string
  captured_at: string
}

export interface Stats {
  normal: number
  inconsistent: number
  supplemented: number
  confirmed: number
  total: number
}
