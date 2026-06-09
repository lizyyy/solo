export type DirectionStatus = 'normal' | 'abnormal' | 'pending_review'

export type RecordStatus = 'imported' | 'reviewed' | 'confirmed' | 'rolled_back'

export interface CalibrationRecord {
  id: number
  originalLineNumber: number
  sensorId: string
  temperature: number
  direction: string
  directionNormalized: string | null
  directionStatus: DirectionStatus
  status: RecordStatus
  createdAt: string
  updatedAt: string
  auditCount: number
}

export interface AuditLog {
  id: number
  recordId: number
  fieldName: string
  oldValue: string
  newValue: string
  changedBy: string
  role: string
  reason: string
  createdAt: string
}

export interface ImportResult {
  success: boolean
  imported: number
  abnormal: number
  pendingReview: number
  error?: string
}

export interface AnomalySummary {
  pending: number
  confirmed: number
  rolledBack: number
  invalid: number
}

export interface ApiError {
  success: boolean
  error: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
}

export interface AuditLogListResponse {
  data: AuditLog[]
}

export interface AnomalyRecord {
  id: number
  originalLineNumber: number
  sensorId: string
  temperature: number
  direction: string
  directionNormalized: string | null
  directionStatus: DirectionStatus
  status: RecordStatus
  createdAt: string
  updatedAt: string
  triggerReason: string
  anomalyReason: string
  auditCount: number
}

export interface AnomalyRecordsResponse {
  data: AnomalyRecord[]
}

export interface ConfirmRollbackPayload {
  reason: string
  changedBy: string
  role: string
}
