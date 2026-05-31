export type RecordStatus = 'pending' | 'confirmed' | 'duplicate' | 'rejected'

export type SourceType = 'selection_list' | 'section_leader_note' | 'accompaniment_teacher' | 'manual'

export interface ScoreRecord {
  id: string
  studentName: string
  instrument: string
  part: string
  songTitle: string
  measures: string
  status: RecordStatus
  source: SourceType
  sourceName: string
  createdAt: string
  updatedAt: string
  pendingReason: string
  duplicateIds: string[]
  history: HistoryEntry[]
}

export interface HistoryEntry {
  id: string
  timestamp: string
  action: string
  operator: string
  detail: string
  oldStatus?: RecordStatus
  newStatus?: RecordStatus
}

export interface ImportResult {
  total: number
  newRecords: number
  duplicates: number
  errors: number
}

export interface FilterOptions {
  status: RecordStatus | ''
  source: SourceType | ''
  studentName: string
  songTitle: string
  instrument: string
}
