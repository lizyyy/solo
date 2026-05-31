export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
  request_id: string
  timestamp: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface SoundMaterial {
  id: number
  material_no: string
  name: string
  type: string
  duration: number
  file_path?: string
  file_hash: string
  tags: string[]
  description?: string
  status: 'pending' | 'matched' | 'confirmed' | 'rejected'
  confidence?: number
  trace_id: string
  created_at: string
  updated_at: string
}

export interface AudioTrack {
  id: number
  track_no: string
  title: string
  duration: number
  file_path?: string
  file_hash: string
  recorded_at?: string
  trace_id: string
  created_at: string
  updated_at: string
}

export interface AdScript {
  id: number
  script_no: string
  track_id: number
  track_no: string
  content: string
  start_time: number
  end_time: number
  batch_no: string
  version: number
  trace_id: string
  created_at: string
  updated_at: string
}

export interface MatchRelation {
  id: number
  material_id: number
  ad_script_id: number
  audio_track_id: number
  match_type: 'auto' | 'manual'
  confidence?: number
  status: 'pending' | 'confirmed' | 'rejected'
  remark?: string
  created_by: string
  trace_id: string
  created_at: string
  updated_at: string
}

export interface TraceLink {
  level: number
  type: 'material' | 'match' | 'ad_script' | 'audio_track' | 'export'
  id: number
  no: string
  name: string
  timestamp: string
  operator: string
}

export interface TraceChain {
  material_id: number
  links: TraceLink[]
  export_records: any[]
}

export interface OperationHistory {
  id: number
  operation_type: string
  target_type: string
  target_id: number
  before_data?: string
  after_data?: string
  operator: string
  remark?: string
  trace_id?: string
  created_at: string
}

export interface ExportRecord {
  id: number
  export_no: string
  filename: string
  file_path: string
  total_count: number
  filter_params?: string
  filter_hash: string
  exported_by: string
  trace_id: string
  created_at: string
}

export interface MaterialFilterParams {
  status?: string
  type?: string
  search_keyword?: string
  min_confidence?: number
  max_confidence?: number
}

export interface ConsistencyCheckResult {
  passed: boolean
  screen_count: number
  export_count: number
  filter_hash: string
  mismatch_details: string[]
}
