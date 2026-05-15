export interface ModelVersion {
  id: number
  version_name: string
  model_name: string
  description: string | null
  created_at: string
  updated_at: string | null
}

export interface Evaluation {
  id: number
  model_version_id: number
  dataset_name: string
  dataset_version: string
  status: string
  started_at: string
  completed_at: string | null
  total_samples: number | null
  passed_samples: number | null
  failed_samples: number | null
  error_message: string | null
}

export interface Metric {
  id: number
  evaluation_id: number
  metric_name: string
  metric_value: number
  metric_unit: string | null
  threshold: number | null
  is_alert: boolean
  created_at: string
}

export interface FailureSample {
  id: number
  evaluation_id: number
  sample_id: string
  input_data: string
  expected_output: string
  actual_output: string
  error_type: string
  is_resolved: boolean
  resolution_note: string | null
  resolved_at: string | null
  created_at: string
}

export interface Note {
  id: number
  evaluation_id: number
  author: string
  content: string
  created_at: string
}

export interface ReleaseSuggestion {
  id: number
  model_version_id: number
  suggestion_type: string
  content: string
  author: string
  is_approved: boolean
  approved_by: string | null
  approved_at: string | null
  created_at: string
}
