export type SourceType = '居民投诉' | '网格巡查' | '12345工单' | '现场走访'
export type SchemeStatus = '草稿' | '已发布' | '被覆盖'
export type TargetType = 'location' | 'feedback' | 'scheme' | 'report'

export interface Location {
  id: string
  canonical_name: string
  aliases: string[]
  lat: number
  lng: number
  has_coordinate_drift: boolean
  drift_note: string | null
  created_at: string
  updated_at: string
}

export interface Feedback {
  id: string
  location_id: string
  raw_location_text: string
  content: string | null
  source: string
  source_type: SourceType
  is_duplicate: boolean
  duplicate_of: string | null
  is_boundary: boolean
  boundary_note: string | null
  reported_at: string
  created_at: string
}

export interface Scheme {
  id: string
  location_id: string
  version: number
  title: string
  content: string
  status: SchemeStatus
  superseded_by: string | null
  historical_opinion: string | null
  manual_note: string | null
  source_refs: string[]
  created_at: string
  created_by: string
}

export interface Report {
  id: string
  location_id: string
  scheme_id: string
  title: string
  content: string
  cross_period_stats: Record<string, number>
  source_trace: Array<{ ref: string; type: string; time: string }>
  generated_at: string
  generated_by: string
}

export interface ManualNote {
  id: string
  target_type: TargetType
  target_id: string
  content: string
  created_at: string
  created_by: string
}

export interface Stats {
  locations: number
  feedback: number
  active_locations: number
  pending_schemes: number
  reports: number
  duplicates: number
  boundary: number
  coordinate_drift: number
  recent: {
    feedback: (Feedback & { location_name?: string })[]
    schemes: (Scheme & { location_name?: string })[]
    reports: (Report & { location_name?: string })[]
  }
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
}
