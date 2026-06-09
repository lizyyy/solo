export interface RecordDetail {
  id: string
  sensorId: string
  originalLineNo: number
  temperatureValue: number
  temperatureUnit: 'C' | 'K'
  correctedValue: number | null
  correctedUnit: 'C' | 'K' | null
  status: 'normal' | 'mixed_unit' | 'anomaly' | 'confirmed' | 'rolled_back'
  credibility: 'sensor_trusted' | 'photo_trusted' | 'pending_confirmation' | null
  source: 'sensor_original' | 'photo_corrected' | 'coach_confirmed' | 'rolled_back'
  note: string | null
  batchId: string
  createdAt: string
  updatedAt: string
}

export type OperatorRole = 'engineer' | 'maintenance_worker' | 'training_coach' | 'system'

export interface AuditLogEntry {
  id: string
  recordId: string
  action: 'import' | 'review' | 'confirm' | 'rollback' | 'edit'
  operatorRole: string
  oldValue: string | null
  newValue: string | null
  note: string | null
  createdAt: string
}

export interface PhotoEntry {
  id: string
  recordId: string
  filePath: string
  description: string | null
  uploadedAt: string
}

export interface BatchImport {
  id: string
  fileName: string
  totalCount: number
  mixedCount: number
  createdAt: string
}

export interface ReportSummary {
  totalRecords: number
  normalCount: number
  mixedCount: number
  pendingCount: number
  confirmedCount: number
  rolledBackCount: number
}

export interface ReportGroup {
  sensorId: string
  records: RecordDetail[]
}

export interface ReportResponse {
  summary: ReportSummary
  groups: ReportGroup[]
}

export type Credibility = 'sensor_trusted' | 'photo_trusted' | 'pending_confirmation'
export type TemperatureUnit = 'C' | 'K'
export type RecordStatus = 'normal' | 'mixed_unit' | 'anomaly' | 'confirmed' | 'rolled_back'
export type RecordSource = 'sensor_original' | 'photo_corrected' | 'coach_confirmed' | 'rolled_back'
