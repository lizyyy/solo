import { Dayjs } from "dayjs";

export interface Buoy {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  type: string;
  battery_capacity: number;
  lamp_type: string;
  install_date: string;
}

export interface BatteryLog {
  buoy_id: string;
  timestamp: string;
  voltage: number;
  current: number;
  temperature: number;
  state_of_charge: number;
}

export interface Repair {
  id: string;
  buoy_id: string;
  repair_date: string;
  technician: string;
  issue_type: string;
  description: string;
  resolved: boolean;
  resolution_date: string | null;
}

export interface WeatherRecord {
  date: string;
  time: string;
  wind_speed: number;
  wind_direction: string;
  visibility: number;
  wave_height: number;
  weather_condition: string;
  is_severe: boolean;
}

export interface LampRule {
  lamp_type: string;
  daily_consumption: number;
  min_voltage: number;
  max_voltage: number;
  critical_soc: number;
  inspection_interval_days: number;
}

export interface LampRulesConfig {
  rules: LampRule[];
  default_rule: LampRule;
}

export interface ValidationError {
  file: string;
  row: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface DailyBatteryStatus {
  buoy_id: string;
  date: string;
  state_of_charge: number;
  voltage: number;
  is_low: boolean;
  is_critical: boolean;
}

export interface DailyLampStatus {
  buoy_id: string;
  date: string;
  operational: boolean;
  fault_code: string | null;
  last_inspection: string | null;
  inspection_due: boolean;
}

export interface Alert {
  buoy_id: string;
  date: string;
  alert_type: string;
  description: string;
  resolved: boolean;
  resolved_date: string | null;
  resolved_by: string | null;
}

export interface ReinspectionWindow {
  buoy_id: string;
  window_start: string;
  window_end: string;
  reason: string;
  status: "pending" | "completed" | "missed";
  completed_date: string | null;
}

export interface DailyBuoyStatus {
  buoy_id: string;
  date: string;
  battery: DailyBatteryStatus;
  lamp: DailyLampStatus;
  active_alerts: Alert[];
  weather_window: ReinspectionWindow | null;
  requires_attention: boolean;
}

export interface Issue {
  id: string;
  buoy_id: string;
  buoy_name: string;
  date: string;
  issue_type: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved";
  assigned_to: string | null;
}

export interface BeaconReport {
  generated_at: string;
  period_start: string;
  period_end: string;
  total_buoys: number;
  buoys_with_issues: number;
  critical_issues: number;
  battery_summary: {
    critical: number;
    low: number;
    normal: number;
  };
  lamp_summary: {
    operational: number;
    faulty: number;
    inspection_due: number;
  };
  weather_impact: {
    severe_days: number;
    reinspections_needed: number;
    reinspections_completed: number;
  };
  issues: Issue[];
  daily_statuses: DailyBuoyStatus[];
}

export interface InputFiles {
  buoys: Buoy[];
  batteryLogs: BatteryLog[];
  repairs: Repair[];
  weatherRecords: WeatherRecord[];
  lampRules: LampRulesConfig;
}
