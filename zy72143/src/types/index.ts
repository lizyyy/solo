export type TrackStatus = 'passed' | 'needs_review' | 'old_caliber' | 'pending'
export type AnomalyType = 'none' | 'old_master' | 'duplicate' | 'missing_auth' | 'manual_rename' | null

export interface Track {
  id: number
  name: string
  version: string
  source: 'excel' | 'contract' | 'manual'
  audio_file_path: string | null
  contract_id: string | null
  auth_start_date: string | null
  auth_end_date: string | null
  contract_note: string | null
  status: TrackStatus
  anomaly_type: AnomalyType
  anomaly_detail: string | null
  processing_suggestion: string | null
  operator_note: string | null
  processed_by: string | null
  processed_at: string | null
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: number
  track_id: number
  track_name: string
  operator: string
  action: string
  old_value: string | null
  new_value: string | null
  detail: string | null
  created_at: string
}
