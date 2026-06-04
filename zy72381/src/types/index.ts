export type RecordStatus =
  | 'pending_import'
  | 'imported'
  | 'calibrating'
  | 'success'
  | 'pending_review'
  | 'supplemented'
  | 'reviewed_negative'
  | 'reviewed_normal'
  | 'manual_corrected'
  | 'rerun'

export type ExceptionStatus =
  | 'pending'
  | 'pending_review'
  | 'supplemented'
  | 'resolved'

export type ExceptionType =
  | 'direction_mismatch'
  | 'missing_sensor'
  | 'supplemented'

export type OperationType =
  | 'import'
  | 'calibrate'
  | 'supplement'
  | 'correct'
  | 'rerun'
  | 'review'

export type RecordType =
  | 'normal'
  | 'left'
  | 'supplement'

export interface TemperatureRecord {
  id: string
  recordNo: string
  type: RecordType
  startTime: string
  endTime: string
  startTemp: number
  endTemp: number
  tempDiff: number
  directionMark: string
  sensorId?: string
  status: RecordStatus
  estimatedValue?: number
  normalizedDirection?: 'positive' | 'negative'
  operationHistory: OperationLog[]
  oldCalibrationData?: OldCalibration[]
  createdAt: string
  updatedAt: string
}

export interface Sensor {
  id: string
  sensorNo: string
  location: string
  installDate: string
  calibrationHistory: CalibrationLog[]
  oldCalibrationData?: OldCalibration[]
}

export interface CalibrationLog {
  id: string
  date: string
  value: number
  standard: string
}

export interface OldCalibration {
  id: string
  date: string
  oldStandard: string
  value: number
  remark: string
}

export interface ExceptionRecord {
  id: string
  recordId: string
  recordNo: string
  exceptionType: ExceptionType
  status: ExceptionStatus
  sensorId?: string
  description: string
  operator: string
  createdAt: string
  updatedAt: string
}

export interface OperationLog {
  id: string
  type: OperationType
  operator: string
  description: string
  timestamp: string
  oldValue?: unknown
  newValue?: unknown
}

export interface EstimationResult {
  recordId: string
  expansionValue: number
  direction: 'positive' | 'negative'
  confidence: number
  calculationFormula: string
  timestamp: string
}

export interface DirectionValidationResult {
  isValid: boolean
  needsReview: boolean
  normalizedDirection?: 'positive' | 'negative'
  warning?: string
}

export interface StepProgress {
  step: number
  name: string
  status: 'pending' | 'active' | 'completed'
  completedAt?: string
}

export interface AppState {
  records: TemperatureRecord[]
  sensors: Sensor[]
  exceptions: ExceptionRecord[]
  currentStep: number
  selectedRecordId?: string
  toasts: Toast[]
}

export interface Toast {
  id: string
  type: 'success' | 'warning' | 'error' | 'info'
  message: string
  timestamp: string
}
