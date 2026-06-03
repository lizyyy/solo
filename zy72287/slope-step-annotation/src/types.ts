export type CoordSystem = 'wgs84' | 'gcj02' | 'local_metric'

export interface CoordValue {
  system: CoordSystem
  lng?: number
  lat?: number
  x?: number
  y?: number
  raw: string
  isMixed: boolean
  mixedDetail?: string
}

export interface RangefinderRecord {
  id: string
  importBatchId: string
  importTime: string
  pointId: string
  coord: CoordValue
  elevation: number | null
  slopeAngle: number | null
  slopeDirection: string | null
  distance: number | null
  rawLine: string
}

export interface ObstacleRemark {
  id: string
  recordId: string
  content: string
  originalLines: string[]
  addedAt: string
  addedBy: string
  source: 'field_note' | 'photo_desc' | 'supplementary'
}

export type WorkflowStep = 'rangefinder_imported' | 'remark_reviewed' | 'field_instruction_updated'

export type ConflictResolution = 'pending' | 'confirmed' | 'rejected'

export interface ConflictEvidence {
  id: string
  recordId: string
  rangefinderField: string
  rangefinderValue: string
  remarkField: string
  remarkValue: string
  remarkId: string
  resolution: ConflictResolution
  resolvedBy?: string
  resolvedAt?: string
  resolutionReason?: string
}

export type SelfCheckType = 'duplicate_import' | 'mixed_coord' | 'recalc_after_supplement' | 'export_consistency'

export interface SelfCheckIssue {
  id: string
  type: SelfCheckType
  severity: 'error' | 'warning' | 'info'
  recordIds: string[]
  message: string
  detail: string
  detectedAt: string
  resolved: boolean
  resolvedAt?: string
}

export interface ParamVersion {
  model: string
  version: string
  parameters: Record<string, string | number>
  tradeOffReason: string
  appliedAt: string
}

export interface FieldInstruction {
  id: string
  recordId: string
  content: string
  coordDisplay: string
  coordMixedFlag: boolean
  coordMixedSource?: string
  coordMixedNextAction?: string
  updatedAt: string
  updatedBy: string
  version: number
  paramVersions: ParamVersion[]
}

export interface SlopeStepAnnotation {
  id: string
  createdAt: string
  updatedAt: string
  currentStep: WorkflowStep
  rangefinderRecords: RangefinderRecord[]
  obstacleRemarks: ObstacleRemark[]
  conflicts: ConflictEvidence[]
  selfCheckIssues: SelfCheckIssue[]
  fieldInstructions: FieldInstruction[]
  paramVersions: ParamVersion[]
}
