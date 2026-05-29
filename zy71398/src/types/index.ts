export type ConflictType =
  | 'duplicate_primary_key'
  | 'partial_success'
  | 'rollback_scope_error'
  | 'field_validation'
  | 'data_type_mismatch'

export type ConflictSeverity = 'high' | 'medium' | 'low'

export type ConflictStatus = 'open' | 'resolved' | 'ignored'

export type ImportSessionStatus = 'pending' | 'running' | 'completed' | 'failed'

export type RollbackScopeType = 'full' | 'partial' | 'selected'

export type ActionType = 'create' | 'update' | 'delete' | 'rollback'

export type ReportFormat = 'pdf' | 'excel' | 'json'

export interface FieldMapping {
  sourceField: string
  targetField: string
  isPrimaryKey: boolean
  dataType: 'string' | 'number' | 'date' | 'boolean'
}

export interface CsvRecord {
  recordId: string
  fileId: string
  originalLineNo: number
  rawData: Record<string, any>
  primaryKeyValue: string
  changeLogs: ChangeLog[]
}

export interface CsvFile {
  fileId: string
  fileName: string
  versionNo: string
  totalRows: number
  uploadedAt: Date
  uploadedBy: string
  fileHash: string
  records: CsvRecord[]
  headers: string[]
}

export interface Conflict {
  conflictId: string
  sessionId: string
  recordId: string
  conflictType: ConflictType
  conflictMessage: string
  conflictingData: Record<string, any>
  severity: ConflictSeverity
  status: ConflictStatus
  originalLineNo: number
  createdAt: Date
  resolvedAt?: Date
  resolvedBy?: string
  resolution?: string
}

export interface ImportSession {
  sessionId: string
  fileId: string
  sessionName: string
  status: ImportSessionStatus
  startedAt: Date
  finishedAt?: Date
  successCount: number
  conflictCount: number
  fieldMapping: FieldMapping[]
  primaryKeyField: string
  conflicts: Conflict[]
  processedRecords: string[]
}

export interface RollbackScope {
  scopeId: string
  rollbackId: string
  scopeType: RollbackScopeType
  affectedRecords: string[]
  affectedCount: number
  riskLevel: ConflictSeverity
  validationErrors: string[]
}

export interface RollbackPoint {
  rollbackId: string
  sessionId: string
  versionTag: string
  createdAt: Date
  createdBy: string
  snapshotData: Record<string, any>
  description: string
  scopes: RollbackScope[]
  isExecuted: boolean
  executedAt?: Date
}

export interface ChangeLog {
  logId: string
  recordId: string
  actionType: ActionType
  fieldName?: string
  oldValue?: string
  newValue?: string
  changedAt: Date
  changedBy: string
  sourceSession: string
}

export interface ReportStatistics {
  totalRecords: number
  successRate: number
  conflictBreakdown: Record<ConflictType, number>
  rollbackImpact: {
    affectedRecords: number
    dataLossRisk: number
  }
  recommendations: string[]
}

export interface DrillReport {
  reportId: string
  sessionId: string
  generatedAt: Date
  statistics: ReportStatistics
  exportFormat: ReportFormat
  filePath?: string
}

export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  content?: string
  preview?: string[]
}

export interface VersionInfo {
  versionNo: string
  timestamp: Date
  fileName: string
  uploadedBy: string
  isLatest: boolean
}

export interface ConflictFilter {
  types: ConflictType[]
  severities: ConflictSeverity[]
  statuses: ConflictStatus[]
  searchTerm: string
}

export interface ImportPreview {
  totalRows: number
  headers: string[]
  sampleData: Record<string, any>[]
  estimatedConflicts: number
}
