export interface Attachment {
  id: string;
  record_id: string;
  file_name: string;
  upload_time: string;
  is_late: boolean;
}

export interface InspectionNote {
  id: string;
  record_id: string;
  content: string;
  created_at: string;
  is_backfilled: boolean;
}

export type WarningLevel = 'green' | 'yellow' | 'red';
export type RecordStatus = 'normal' | 'pending' | 'confirmed';

export interface InspectionRecord {
  id: string;
  equipment_no: string;
  pipeline_name: string;
  area: string;
  measured_value: number;
  measure_unit: string;
  inspector: string;
  inspect_time: string;
  status: RecordStatus;
  is_duplicate: boolean;
  attachments: Attachment[];
  notes: InspectionNote[];
  metric_type: string;
}

export interface ThresholdRule {
  id: string;
  formula_version: string;
  metric: string;
  formula: string;
  unit: string;
  lower_bound: number;
  upper_bound: number;
  warning_low: number;
  warning_high: number;
  variables: {
    name: string;
    description: string;
    unit: string;
  }[];
}

export interface WarningAlert {
  id: string;
  record_id: string;
  rule_id: string;
  level: WarningLevel;
  calculated_value: number;
  formula_version: string;
  created_at: string;
  change_reason?: string;
}

export interface FormulaVersion {
  version: string;
  name: string;
  is_current: boolean;
  description: string;
  effective_date: string;
}

export interface CalculationStep {
  step: number;
  title: string;
  expression: string;
  result: number;
  unit: string;
}

export interface DuplicateGroup {
  equipment_no: string;
  record_ids: string[];
  count: number;
  conflict_points: string[];
  affected_warnings: string[];
}

export interface TimelineItem {
  id: string;
  record_id: string;
  date: string;
  equipment_no: string;
  pipeline_name: string;
  value: number;
  unit: string;
  level: WarningLevel;
  formula_version: string;
  is_current_version: boolean;
  diff_note?: string;
  change_reason?: string;
}
