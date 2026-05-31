export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type RecordType = 'normal' | 'late_arrival' | 'duplicate' | 'correction'
export type EntityType = 'conclusion' | 'evaluation' | 'feedback'
export type BundleStatus = 'parsing' | 'parsed' | 'confirmed' | 'error'

export interface Model {
  id: string
  name: string
  description: string
}

export interface Bundle {
  id: string
  filename: string
  uploaded_at: string
  status: BundleStatus
}

export interface MaterialRecord {
  id: string
  bundle_id: string
  type: RecordType
  raw_data: string
  linked_sample_id: string | null
  linked_evaluation_id: string | null
  confidence: number
}

export interface Report {
  id: string
  date: string
  model_id: string
  severity: Severity
  bundle_id: string | null
  created_at: string
  updated_at: string
  model_name?: string
}

export interface Conclusion {
  id: string
  report_id: string
  title: string
  description: string
  severity: Severity
  sources?: ConclusionSource[]
}

export interface ConclusionSource {
  id: string
  conclusion_id: string
  record_id: string | null
  sample_id: string | null
  evaluation_id: string | null
}

export interface AnnotationSample {
  id: string
  model_id: string
  label: string
  content: string
  file_path: string | null
  created_at: string
  model_name?: string
}

export interface Evaluation {
  id: string
  model_id: string
  report_id: string | null
  metric: string
  value: number
  baseline: number
  drift: number
  created_at: string
  model_name?: string
}

export interface ChangeRecord {
  id: string
  entity_type: EntityType
  entity_id: string
  report_id: string | null
  field_name: string
  old_value: string
  new_value: string
  operator: string
  operated_at: string
}

export interface ConsistencyResult {
  reportId: string
  consistent: boolean
  inconsistencies: Inconsistency[]
  conclusionCount: number
  evaluationCount: number
}

export interface Inconsistency {
  conclusion: any
  evaluation: any
  reason: string
}

export interface GuideSection {
  id: string
  title: string
  steps: GuideStep[]
}

export interface GuideStep {
  step: number
  title: string
  description: string
}
