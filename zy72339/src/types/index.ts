export type CourseStatus = 'pending' | 'reviewing' | 'completed'
export type WeightFormat = 'decimal' | 'percentage' | 'mixed'
export type WeightSource = 'import' | 'supplement'
export type RecordType = 'smooth' | 'mixed' | 'supplement'
export type RecordStatus = 'pass' | 'pending_review' | 'corrected'
export type ActionType = 'import' | 'supplement' | 'calculate' | 'confirm' | 'correct' | 'rerun'
export type StepStatus = 'pending' | 'active' | 'completed'

export interface Course {
  id: string
  name: string
  status: CourseStatus
  recordType: RecordType
  rawScores: Record<string, number>
}

export interface WeightItem {
  id: string
  courseId: string
  dimension: string
  rawValue: string
  numericValue: number
  format: WeightFormat
  source: WeightSource
  isOldCaliber: boolean
}

export interface CalculationRecord {
  id: string
  courseId: string
  recordType: RecordType
  score: number
  detailScores: Record<string, { weight: number; raw: number; weighted: number }>
  status: RecordStatus
  lastModifiedBy: string
  lastModifiedAt: string
  previousScore?: number
}

export interface HistoryEntry {
  id: string
  courseId: string
  action: ActionType
  operator: string
  timestamp: string
  detail: string
}

export interface WorkflowStep {
  key: string
  label: string
  description: string
  status: StepStatus
  path: string
}
