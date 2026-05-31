export interface RehearsalRecord {
  id: string
  studentName: string
  measureRange: [number, number]
  keySignature: string
  partName: string
  version: number
  isLateAttachment: boolean
  isManualCorrection: boolean
  timestamp: string
  note?: string
  previousVersionId?: string
  sectionLeader?: string
}

export type AnomalyType =
  | 'measure_misalignment'
  | 'transposition_desync'
  | 'duplicate_student'

export interface AnomalyDetail {
  type: AnomalyType
  description: string
  affectedRecordIds: string[]
  reasoning: string
  suggestion: string
}

export type CheckStatus = 'normal' | 'pending_confirmation' | 'anomaly'

export interface VersionDiff {
  previousVersionId: string
  previousVersion: number
  currentVersion: number
  changedFields: string[]
  summary: string
  noteAboutOldVersion: boolean
}

export interface CheckResult {
  recordId: string
  status: CheckStatus
  reasons: string[]
  nextSteps: string[]
  anomalies: AnomalyDetail[]
  versionDiff?: VersionDiff
}

export interface CheckReport {
  summary: {
    total: number
    normal: number
    pendingConfirmation: number
    anomaly: number
  }
  results: CheckResult[]
  overallNextSteps: string[]
}
