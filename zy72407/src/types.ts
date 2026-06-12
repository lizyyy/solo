export enum RecordStatus {
  PENDING_IMPORT = 'pending_import',
  IMPORTED = 'imported',
  MATCHED = 'matched',
  NEEDS_REVIEW = 'needs_review',
  TEMP_SUBSTITUTE = 'temp_substitute',
  CONFIRMED = 'confirmed',
  SETTLED = 'settled',
  EXPORTED = 'exported',
  DUPLICATE = 'duplicate',
  ERROR = 'error'
}

export enum DataSource {
  TUNER_MESSAGE = 'tuner_message',
  GROUP_SIGNUP = 'group_signup'
}

export enum ReviewFlag {
  NONE = 'none',
  TEMP_SUB_ONLY_IN_GROUP = 'temp_sub_only_in_group',
  MISMATCH = 'mismatch',
  MANUAL_EDIT = 'manual_edit'
}

export interface TunerMessageRaw {
  id: string
  originalLineNumber: number
  rawContent: string
  studentName: string
  courseDate: string
  courseTime: string
  teacherName: string
  courseType: string
  durationMinutes: number
  remark?: string
  importBatchId: string
  importedAt: string
}

export interface GroupSignupRaw {
  id: string
  originalLineNumber: number
  rawContent: string
  studentName: string
  courseDate: string
  courseTime: string
  teacherName: string
  isOnSite: boolean
  remark?: string
  importBatchId: string
  importedAt: string
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  operator: string
  action: string
  fieldName?: string
  oldValue?: string
  newValue?: string
  reason?: string
}

export interface ConsumptionRecord {
  id: string
  studentName: string
  courseDate: string
  courseTime: string
  teacherName: string
  courseType: string
  durationMinutes: number
  isOnSite: boolean
  
  status: RecordStatus
  reviewFlag: ReviewFlag
  
  tunerMessageId?: string
  tunerOriginalLineNumber?: number
  tunerRawContent?: string
  
  groupSignupId?: string
  groupOriginalLineNumber?: number
  groupRawContent?: string
  groupCourseTime?: string
  
  importSource?: 'tuner_first' | 'group_only' | 'reimport_reuse'
  importBatchLabel?: string
  
  manualEdits: AuditLogEntry[]
  createdAt: string
  updatedAt: string
  settledAt?: string
  
  matchedBy?: 'auto' | 'manual'
  matchedAt?: string
  
  settlementAmount?: number
}

export interface ImportBatch {
  id: string
  source: DataSource
  fileName: string
  importedAt: string
  operator: string
  recordCount: number
  rawData: any[]
}

export interface SelfCheckIssue {
  id: string
  type: 'duplicate' | 'temp_substitute' | 'mismatch' | 'inconsistent' | 'missing_data'
  severity: 'high' | 'medium' | 'low'
  message: string
  recordIds: string[]
  details?: any
}

export interface SelfCheckResult {
  checkedAt: string
  totalRecords: number
  issues: SelfCheckIssue[]
  passed: boolean
}

export interface UnifiedResult {
  records: ConsumptionRecord[]
  summary: {
    total: number
    byStatus: Record<RecordStatus, number>
    byReviewFlag: Record<ReviewFlag, number>
    totalDurationMinutes: number
    totalSettlementAmount: number
  }
  selfCheck: SelfCheckResult
  generatedAt: string
  batchIds: string[]
}

export type StepName = 'import_tuner' | 'review_group' | 'update_settlement'

export interface WorkflowStep {
  name: StepName
  status: 'pending' | 'in_progress' | 'completed'
  completedAt?: string
  operator?: string
}

export interface WorkflowState {
  currentStep: StepName
  steps: WorkflowStep[]
  startedAt: string
  updatedAt: string
}
