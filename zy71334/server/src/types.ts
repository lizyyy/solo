export interface Problem {
  id: string
  musicianName: string
  section: string
  channel: number
  description: string
  discoveredAt: string
  rehearsalId: string
  status: 'pending' | 'in_progress' | 'resolved' | 'confirmed'
  currentVersion: number
  createdAt: string
  updatedAt: string
}

export interface ProblemVersion {
  id: string
  problemId: string
  version: number
  parentVersion: number | null
  musicianName: string
  channel: number
  description: string
  tuningAction: string | null
  tuningParams: TuningParams | null
  operatorName: string
  changeReason: string | null
  anomalyDetected: AnomalyInfo | null
  createdAt: string
}

export interface TuningParams {
  eq?: { freq: number; gain: number; q: number }[]
  compression?: { threshold: number; ratio: number; attack: number; release: number }
  gain?: number
  delay?: number
  pan?: number
}

export interface AnomalyInfo {
  type: 'channel_invalid' | 'duplicate' | 'overwrite'
  reason: string
  impact: string
  nextAction: string
  relatedProblemIds?: string[]
}

export interface Confirmation {
  id: string
  problemId: string
  version: number
  musicianSigned: boolean
  musicianSignedAt: string | null
  musicianSignature: string | null
  engineerSigned: boolean
  engineerSignedAt: string | null
  engineerSignature: string | null
  notes: string | null
  createdAt: string
}

export interface AnomalyRecord {
  id: string
  problemId: string
  versionId: string
  type: 'channel_invalid' | 'duplicate' | 'overwrite'
  reason: string
  impact: string
  nextAction: string
  relatedProblemIds?: string[]
  createdAt: string
}

export interface Rehearsal {
  id: string
  name: string
  date: string
  venue: string | null
  createdAt: string
}

export interface ChannelStatus {
  channel: number
  musicianName: string | null
  section: string | null
  status: 'normal' | 'pending' | 'in_progress'
  activeProblems: number
  lastProblemAt: string | null
}

export interface VersionDiff {
  field: string
  oldValue: unknown
  newValue: unknown
  changed: boolean
}

export interface CreateProblemRequest {
  musicianName: string
  section: string
  channel: number
  description: string
  discoveredAt?: string
  operatorName: string
}

export interface CreateVersionRequest {
  musicianName?: string
  channel?: number
  description?: string
  tuningAction?: string
  tuningParams?: TuningParams
  operatorName: string
  changeReason?: string
}

export interface ConfirmRequest {
  type: 'musician' | 'engineer'
  signature: string
  notes?: string
}

export interface ProblemWithDetails extends Problem {
  versions: ProblemVersion[]
  confirmation: Confirmation | null
  anomalies: AnomalyRecord[]
}
