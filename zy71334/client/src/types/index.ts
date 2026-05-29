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

export interface ProblemWithDetails extends Problem {
  versions: ProblemVersion[]
  confirmation: Confirmation | null
  anomalies: AnomalyRecord[]
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

export const statusLabels: Record<Problem['status'], string> = {
  pending: '待处理',
  in_progress: '处理中',
  resolved: '已解决',
  confirmed: '已确认',
}

export const anomalyTypeLabels: Record<AnomalyRecord['type'], string> = {
  channel_invalid: '通道错误',
  duplicate: '重复问题',
  overwrite: '覆盖风险',
}

export const sectionOptions = [
  '主唱',
  '和声',
  '吉他手',
  '贝斯手',
  '鼓手',
  '键盘手',
  '打击乐',
  '管乐',
  '弦乐',
  '其他',
]
