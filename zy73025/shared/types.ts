export type RecordStatus = 'pending' | 'confirmed' | 'exception'

export type Conclusion = 'normal' | 'observe' | 'abnormal'

export type ExceptionType =
  | 'vaccine_missing'
  | 'boundary_sample'
  | 'legacy_curve'
  | 'pending_reason'

export type HistoryAction =
  | 'create'
  | 'review'
  | 'rejudge'
  | 'supplement'
  | 'ack_exception'

export interface TempPoint {
  t: number
  value: number
}

export interface WeightPoint {
  t: number
  value: number
  version: 'new' | 'legacy'
}

export interface VaccineRecord {
  date: string | null
  name: string
}

export interface Note {
  id: string
  content: string
  source: 'verbal' | 'written'
  operator: string
  time: string
}

export type InfluenceFactorType =
  | 'legacy_curve'
  | 'boundary_sample'
  | 'verbal_note'
  | 'vaccine_missing'

export interface InfluenceFactor {
  id: string
  type: InfluenceFactorType
  label: string
  impact: 'positive' | 'negative' | 'neutral'
  description: string
  affectedRecords: string[]
}

export interface TempThreshold {
  min: number
  max: number
}

export interface TempRecord {
  id: string
  code: string
  petName: string
  ownerName: string
  petType: string
  visitDate: string
  reviewer: string
  status: RecordStatus
  conclusion: Conclusion
  tempCurve: TempPoint[]
  tempThreshold: TempThreshold
  weightCurve: WeightPoint[]
  vaccines: VaccineRecord[]
  notes: Note[]
  factors: InfluenceFactor[]
  pendingReason?: string
  hasLegacyCurve: boolean
  isBoundarySample: boolean
  updatedAt: string
  createdAt: string
}

export interface HistoryEntry {
  id: string
  recordId: string
  action: HistoryAction
  isManual: boolean
  operator: string
  time: string
  summary: string
  reason?: string
  oldSnapshot: Partial<TempRecord>
  newSnapshot: Partial<TempRecord>
}

export interface ExceptionItem {
  id: string
  recordId: string
  type: ExceptionType
  title: string
  reason: string
  affectedRecords: string[]
  status: 'open' | 'acknowledged' | 'resolved'
  createdAt: string
  acknowledgedBy?: string
  acknowledgedAt?: string
  suggestion: string
}

export interface RejudgeRequest {
  conclusion: Conclusion
  reason: string
  supplementIds: string[]
  operator: string
}

export type SupplementType = 'vaccine' | 'weight' | 'note'

export interface SupplementRequest {
  type: SupplementType
  content: unknown
  operator: string
}

export interface VaccineSupplementContent {
  date: string | null
  name: string
}

export interface WeightSupplementContent {
  t: number
  value: number
  version: 'new' | 'legacy'
}

export interface NoteSupplementContent {
  content: string
  source: 'verbal' | 'written'
}

export interface DatabaseSchema {
  records: TempRecord[]
  history: HistoryEntry[]
  queue: ExceptionItem[]
}
