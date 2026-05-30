export interface Project {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
}

export interface LightRecord {
  id: string
  project_id: string
  time_slot: string
  intensity_wm2: number
  source: string
  created_at: string
  updated_at: string
}

export interface TrackParams {
  id: string
  project_id: string
  slope_percent: number
  slope_direction: 'uphill' | 'downhill' | 'flat'
  gear_ratio: number
  track_length_m: number
  surface_type: string
  created_at: string
  updated_at: string
}

export interface CarParams {
  id: string
  project_id: string
  car_name: string
  mass_kg: number
  motor_voltage_v: number
  motor_rpm: number
  motor_power_w: number
  motor_efficiency_percent: number
  panel_area_m2: number
  panel_efficiency_percent: number
  wheel_diameter_m: number
  created_at: string
  updated_at: string
}

export type EstimationWarningType = 'light_gap' | 'slope_direction_reversed' | 'gear_ratio_out_of_range' | 'power_insufficient'

export interface EstimationWarning {
  type: EstimationWarningType
  message: string
  business_impact: string
  source_ids: string[]
}

export interface EstimationReport {
  id: string
  project_id: string
  car_params_id: string
  track_params_id: string
  light_record_ids: string[]
  available_power_w: number
  slope_resistance_n: number
  rolling_resistance_n: number
  aero_resistance_n: number
  total_resistance_n: number
  net_force_n: number
  estimated_time_s: number
  warnings: EstimationWarning[]
  status: 'confirmed' | 'pending'
  created_at: string
}

export interface TraceLink {
  field: string
  value: number
  source_type: string
  source_id: string
  source_label: string
  source_detail: string
}
