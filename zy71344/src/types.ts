export type ConfirmStatus = 'confirmed' | 'temporary' | 'conflict'

export type ConflictType = 'beat_drift' | 'cut_overlap' | 'note_overwrite'

export interface Project {
  id: string
  name: string
  description: string
  createdAt: number
  updatedAt: number
}

export interface AudioFile {
  id: string
  projectId: string
  fileName: string
  duration: number
  sampleRate: number
  status: ConfirmStatus
  uploadedAt: number
}

export interface BeatMarker {
  id: string
  projectId: string
  timeSeconds: number
  beatNumber: number
  bpm: number
  status: ConfirmStatus
  driftOffset: number
  createdAt: number
  updatedAt: number
}

export interface CutPoint {
  id: string
  projectId: string
  startTime: number
  endTime: number
  label: string
  status: ConfirmStatus
  hasOverlap: boolean
  createdAt: number
  updatedAt: number
}

export interface FormationNote {
  id: string
  projectId: string
  startTime: number
  endTime: number
  description: string
  status: ConfirmStatus
  createdAt: number
  updatedAt: number
}

export interface StudentVersion {
  id: string
  projectId: string
  versionName: string
  snapshotData: string
  status: ConfirmStatus
  createdAt: number
}

export interface RehearsalReport {
  id: string
  projectId: string
  title: string
  content: string
  status: ConfirmStatus
  createdAt: number
}

export interface VersionSnapshot {
  id: string
  projectId: string
  label: string
  snapshotData: string
  createdAt: number
}

export interface OperationHistory {
  id: string
  projectId: string
  operationType: string
  targetType: string
  targetId: string
  detail: string
  timestamp: number
}

export interface ConflictItem {
  id: string
  type: ConflictType
  targetId: string
  projectId: string
  message: string
  severity: 'warning' | 'error'
  suggestion: string
}
