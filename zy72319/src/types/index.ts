export type MaterialSource = "normal" | "mismatch" | "supplementary"
export type CounterExampleStatus = "normal" | "boundary" | "conflict" | "pending_review"
export type ConflictResolution = "confirmed" | "rejected" | null
export type SelfCheckType = "duplicate_import" | "boundary_threshold" | "supplementary_recalc" | "export_consistency"
export type SelfCheckItemStatus = "pass" | "fail"

export interface CounterExample {
  id: string
  source: MaterialSource
  originalValue: number
  threshold: number
  deviation: number
  status: CounterExampleStatus
  questionnaireRowId: string | null
  conflictResolution: ConflictResolution
  createdAt: string
  updatedAt: string
}

export interface QuestionnaireRow {
  id: string
  rowIndex: number
  fields: Record<string, string | number>
  matchedCounterExampleId: string | null
}

export interface RunSummary {
  totalCounterExamples: number
  normalCount: number
  boundaryCount: number
  conflictCount: number
  pendingReviewCount: number
}

export interface RunRecord {
  id: string
  mode: MaterialSource
  timestamp: string
  counterExampleIds: string[]
  summary: RunSummary
}

export interface ConflictEvidence {
  counterExampleId: string
  counterExampleValue: number
  questionnaireValue: number
  conflictingFields: string[]
}

export interface SelfCheckDetail {
  item: string
  status: SelfCheckItemStatus
  message: string
}

export interface SelfCheckResult {
  type: SelfCheckType
  passed: boolean
  details: SelfCheckDetail[]
}

export interface GradientPoint {
  x: number
  y: number
}

export interface GradientConfig {
  learningRate: number
  startX: number
  startY: number
  maxSteps: number
  funcType: "quadratic" | "rosenbrock" | "rastrigin"
}

export type ToastType = "success" | "error" | "info" | "warning"

export interface Toast {
  id: string
  type: ToastType
  message: string
}
