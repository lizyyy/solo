export type ChannelType = 'sms' | 'email' | 'in_app'

export type SourceType = 'user_profile' | 'admin_panel' | 'batch_import' | 'api' | 'marketing_campaign'

export type PreferenceStatus = 'active' | 'pending' | 'conflict' | 'error' | 'merged'

export type BusinessScene = 'transactional' | 'marketing' | 'security' | 'system'

export type InterceptionStatus = 'pending' | 'allowed' | 'blocked' | 'reviewed'

export interface Preference {
  id: number
  user_id: string
  channel: ChannelType
  business_scene: BusinessScene
  enabled: boolean
  source: SourceType
  source_priority: number
  status: PreferenceStatus
  created_at: string
  updated_at?: string
  expires_at?: string
  metadata?: Record<string, any>
}

export interface ChangeHistory {
  id: number
  preference_id?: number
  user_id: string
  channel?: ChannelType
  business_scene?: BusinessScene
  old_value?: Record<string, any>
  new_value?: Record<string, any>
  source?: SourceType
  operator?: string
  change_type?: string
  snapshot?: Record<string, any>
  created_at: string
}

export interface SendInterception {
  id: number
  user_id: string
  channel: ChannelType
  business_scene: BusinessScene
  status: InterceptionStatus
  reason?: string
  interception_rule?: string
  message_id?: string
  checked_at?: string
  created_at: string
}

export interface AnomalyQueue {
  id: number
  user_id: string
  channel: ChannelType
  business_scene: BusinessScene
  anomaly_type: string
  description?: string
  source: SourceType
  status: string
  retry_count: number
  max_retries: number
  last_retry_at?: string
  resolved_at?: string
  resolver?: string
  resolution_note?: string
  created_at: string
  metadata?: Record<string, any>
}

export interface StatsSummary {
  preferences: {
    total: number
    active: number
  }
  anomalies: {
    total: number
    pending: number
  }
  interceptions: {
    total: number
    blocked: number
    block_rate: number
  }
}

export interface ValidationResult {
  allowed: boolean
  reason?: string
  rule?: string
}

export interface PreferenceCreate {
  user_id: string
  channel: ChannelType
  business_scene: BusinessScene
  enabled: boolean
  source: SourceType
  expires_at?: string
  metadata?: Record<string, any>
}

export interface ExportRequest {
  user_id?: string
  channel?: ChannelType
  business_scene?: BusinessScene
  start_date?: string
  end_date?: string
  export_format: 'json' | 'csv' | 'excel'
}
