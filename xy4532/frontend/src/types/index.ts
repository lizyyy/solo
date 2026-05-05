export interface WindTurbine {
  id: number
  turbine_id: string
  name?: string
  location?: string
  latitude?: number
  longitude?: number
  capacity?: number
  installation_date?: string
  status: string
  created_at: string
  updated_at: string
}

export interface Blade {
  id: number
  turbine_id: number
  blade_number: number
  length?: number
  manufacturer?: string
  installation_date?: string
  created_at: string
  updated_at: string
}

export interface InspectionRecord {
  id: number
  turbine_id: number
  inspection_date: string
  inspector?: string
  weather_conditions?: string
  drone_track_file?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface BladePhoto {
  id: number
  blade_id: number
  inspection_id: number
  file_path: string
  file_name: string
  segment?: string
  distance_from_root?: number
  image_features?: string
  created_at: string
  updated_at: string
}

export interface SCADAAllarm {
  id: number
  turbine_id: number
  alarm_code: string
  alarm_name?: string
  alarm_type?: string
  severity: string
  start_time: string
  end_time?: string
  is_active: boolean
  description?: string
  created_at: string
  updated_at: string
}

export interface WorkOrder {
  id: number
  turbine_id: number
  blade_number?: number
  work_order_id: string
  issue_type?: string
  description?: string
  priority: string
  status: string
  created_time: string
  scheduled_time?: string
  completed_time?: string
  assigned_to?: string
  resolution?: string
  created_at: string
  updated_at: string
}

export interface RiskAssessment {
  id: number
  photo_id: number
  inspection_id: number
  
  ai_risk_level?: string
  ai_risk_score: number
  ai_detection_type?: string
  ai_confidence?: number
  ai_description?: string
  
  manual_risk_level?: string
  manual_override: boolean
  manual_reason?: string
  manual_judge?: string
  manual_time?: string
  
  final_risk_level?: string
  final_risk_score?: number
  
  related_alarm_id?: number
  related_work_order_id?: number
  
  created_at: string
  updated_at: string
}

export interface DashboardStatistics {
  total_turbines: number
  total_blades: number
  total_inspections: number
  total_photos: number
  
  critical_risks: number
  high_risks: number
  medium_risks: number
  low_risks: number
  
  active_alarms: number
  pending_work_orders: number
  
  recent_inspections: Array<{
    id: number
    inspection_date?: string
    inspector?: string
    turbine_id?: string
    turbine_name?: string
  }>
  
  high_risk_items: Array<{
    id: number
    risk_level: string
    risk_score: number
    detection_type?: string
    turbine_id?: string
    blade_number?: number
    segment?: string
    manual_override: boolean
  }>
}

export interface APIResponse<T = any> {
  success: boolean
  message: string
  data?: T
  errors?: string[]
}

export type RiskLevel = '严重' | '高' | '中' | '低'

export interface RiskLevelOption {
  value: RiskLevel
  label: RiskLevel
  color: string
  type: 'danger' | 'warning' | 'primary' | 'success'
}

export const RISK_LEVEL_OPTIONS: RiskLevelOption[] = [
  { value: '严重', label: '严重', color: '#ff4d4f', type: 'danger' },
  { value: '高', label: '高', color: '#fa8c16', type: 'warning' },
  { value: '中', label: '中', color: '#1890ff', type: 'primary' },
  { value: '低', label: '低', color: '#52c41a', type: 'success' },
]

export function getRiskLevelColor(level: string): string {
  const option = RISK_LEVEL_OPTIONS.find(o => o.value === level)
  return option?.color || '#999'
}

export function getRiskLevelType(level: string): string {
  const option = RISK_LEVEL_OPTIONS.find(o => o.value === level)
  return option?.type || 'info'
}
