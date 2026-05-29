export type FingeringHand = 'right' | 'left'
export type ErrorSeverity = 'critical' | 'warning' | 'info'
export type CommentStatus = 'pending' | 'reviewed' | 'resolved'
export type AnomalyType = 'duplicate_name' | 'section_mismatch' | 'duplicate_comment' | 'missing_fingering' | 'practice_gap'

export interface Fingering {
  id: string
  name: string
  aliases: string[]
  hand: FingeringHand
  description: string
  standardAction: string
  commonMistakes: string[]
  createdAt: string
  updatedAt: string
}

export interface Section {
  id: string
  scoreId: string
  scoreName: string
  sectionNumber: number
  sectionName: string
  content: string
  fingeringSequence: string[]
  version: number
  createdAt: string
  updatedAt: string
  previousHash?: string
}

export interface ErrorCause {
  id: string
  code: string
  name: string
  category: 'technique' | 'rhythm' | 'posture' | 'timbre' | 'other'
  description: string
}

export interface PracticeMistake {
  id: string
  fingeringId: string
  fingeringName: string
  position: number
  errorCauseId: string
  errorCauseName: string
  severity: ErrorSeverity
  note: string
  timestamp: string
}

export interface PracticeRecord {
  id: string
  studentId: string
  studentName: string
  sectionId: string
  sectionName: string
  scoreName: string
  practiceDate: string
  practiceCount: number
  durationMinutes: number
  mistakes: PracticeMistake[]
  selfAssessment: string
  createdAt: string
}

export interface Comment {
  id: string
  practiceRecordId: string
  studentId: string
  teacherId: string
  teacherName: string
  sectionId: string
  content: string
  status: CommentStatus
  createdAt: string
  updatedAt: string
  sourceMaterialRef: string
}

export interface Anomaly {
  id: string
  type: AnomalyType
  severity: ErrorSeverity
  title: string
  description: string
  sourceIds: string[]
  sourceType: 'fingering' | 'section' | 'practice' | 'comment'
  resolved: boolean
  resolutionNote?: string
  createdAt: string
}

export interface LearningReport {
  id: string
  studentId: string
  studentName: string
  startDate: string
  endDate: string
  totalPracticeCount: number
  totalDurationMinutes: number
  sectionsCovered: string[]
  topMistakes: { cause: string; count: number }[]
  progressBySection: { section: string; accuracy: number; practices: number }[]
  anomaliesFound: number
  recommendations: string[]
  generatedAt: string
}

export interface AppState {
  fingerings: Fingering[]
  sections: Section[]
  errorCauses: ErrorCause[]
  practiceRecords: PracticeRecord[]
  comments: Comment[]
  anomalies: Anomaly[]
  currentStudent: string
}
