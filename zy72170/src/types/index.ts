export type CrowdingLevel = 'crowded' | 'normal' | 'pending_review'

export type DataSource = 'gis_import' | 'resident_feedback' | 'inspection'

export type ConflictResolution = 'use_feedback' | 'use_import' | 'mark_for_review'

export interface GISPoint {
  id: string
  latitude: number
  longitude: number
  name: string
  street: string
  source: DataSource
  sourceId: string
  importedAt: string
}

export interface CrowdingStatus {
  id: string
  pointId: string
  status: CrowdingLevel
  source: string
  recordedAt: string
}

export interface ResidentFeedback {
  id: string
  pointId: string
  residentName: string
  content: string
  feedbackTime: string
  hasConflict: boolean
  conflictDetail?: string
}

export interface InspectionPhoto {
  id: string
  pointId: string
  photoUrl: string
  takenAt: string
  inspector: string
}

export interface ManualNote {
  id: string
  pointId: string
  street: string
  content: string
  editedAt: string
  editedBy: string
}

export interface ProcessingRecord {
  id: string
  pointId: string
  action: string
  fromStatus: string
  toStatus: string
  reason: string
  operatedAt: string
  operator: string
}

export interface HistoricalOpinion {
  id: string
  pointId: string
  content: string
  source: string
  createdAt: string
  isOverridden: boolean
  overriddenAt?: string
  overrideReason?: string
}

export interface Conflict {
  id: string
  pointId: string
  feedbackId: string
  importDataSummary: string
  feedbackSummary: string
  suggestedAction: ConflictResolution
  resolution?: ConflictResolution
  detectedAt: string
}

export interface TrailStore {
  points: GISPoint[]
  statuses: CrowdingStatus[]
  feedbacks: ResidentFeedback[]
  photos: InspectionPhoto[]
  notes: ManualNote[]
  records: ProcessingRecord[]
  opinions: HistoricalOpinion[]
  conflicts: Conflict[]
  selectedPointId: string | null
  sidebarTab: 'feedback' | 'photos' | 'notes'
  conflictBannerExpanded: boolean

  setSelectedPoint: (id: string | null) => void
  setSidebarTab: (tab: 'feedback' | 'photos' | 'notes') => void
  setConflictBannerExpanded: (expanded: boolean) => void

  getPointById: (id: string) => GISPoint | undefined
  getStatusByPointId: (pointId: string) => CrowdingStatus | undefined
  getFeedbacksByPointId: (pointId: string) => ResidentFeedback[]
  getPhotosByPointId: (pointId: string) => InspectionPhoto[]
  getNotesByPointId: (pointId: string) => ManualNote[]
  getRecordsByPointId: (pointId: string) => ProcessingRecord[]
  getOpinionsByPointId: (pointId: string) => HistoricalOpinion[]
  getConflictsByPointId: (pointId: string) => Conflict[]
  getUnresolvedConflicts: () => Conflict[]

  updateNote: (noteId: string, content: string) => void
  addNote: (pointId: string, street: string, content: string) => void
  resolveConflict: (conflictId: string, resolution: ConflictResolution) => void
  updatePointStatus: (pointId: string, newStatus: CrowdingLevel, reason: string) => void
  overrideOpinion: (opinionId: string, reason: string) => void
  addOpinion: (pointId: string, content: string, source: string) => void

  exportReport: () => string
}
