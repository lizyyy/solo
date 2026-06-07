export interface CommunityName {
  id: string
  name: string
  isOldName: boolean
  verified: boolean
  verifiedBy?: 'inspector' | 'manager'
  verifiedAt?: string
}

export interface Community {
  id: string
  names: CommunityName[]
  address: string
  area: number
  householdCount: number
}

export interface RedLineNote {
  id: string
  importBatchId: string
  communityId: string
  communityName: string
  schoolName: string
  distanceToSchool: number
  noteContent: string
  congestionLevel: 'low' | 'medium' | 'high' | 'severe'
  importTime: string
  importedBy: string
  isDuplicate: boolean
  duplicateOfId?: string
}

export interface GridInspectorRecord {
  id: string
  redLineNoteId: string
  inspectorName: string
  inspectionTime: string
  photos: string[]
  description: string
  peakTime: string
  vehicleCount: number
  pedestrianCount: number
  issues: string[]
  suggestions: string
  reviewedByManager: boolean
  reviewTime?: string
  managerNotes?: string
}

export interface ModelParams {
  version: string
  name: string
  description: string
  parameters: Record<string, number | string>
  tradeOffs: string
  createdAt: string
}

export interface CongestionCalculation {
  id: string
  redLineNoteId: string
  modelVersion: string
  score: number
  level: 'low' | 'medium' | 'high' | 'severe'
  factors: Record<string, number>
  paramsSnapshot: ModelParams
  calculatedAt: string
}

export interface HistoryVersion {
  id: string
  recordId: string
  recordType: 'redLineNote' | 'gridInspector' | 'summary'
  fieldName: string
  oldValue: string
  newValue: string
  changedBy: string
  changedAt: string
  changeReason: string
}

export interface StreetSummary {
  id: string
  redLineNoteId: string
  title: string
  reasonKept: string
  missingMaterials: string[]
  nextStep: 'inspector' | 'manager' | 'street'
  nextStepPerson: string
  status: 'pending' | 'in_progress' | 'resolved'
  updatedAt: string
  updatedBy: string
  reviewHistory: string[]
}

export type FlowStep = 'import' | 'inspector_review' | 'summary_update'

export interface CongestionRecord {
  id: string
  redLineNote: RedLineNote
  gridInspector?: GridInspectorRecord
  calculation?: CongestionCalculation
  summary?: StreetSummary
  flowStep: FlowStep
  needsReview: boolean
  reviewReason?: string
  reviewedByInspector: boolean
  createdAt: string
  updatedAt: string
  historyVersions: HistoryVersion[]
}

export interface ImportBatch {
  id: string
  fileName: string
  importTime: string
  importedBy: string
  totalRecords: number
  newRecords: number
  duplicateRecords: number
  records: CongestionRecord[]
}
