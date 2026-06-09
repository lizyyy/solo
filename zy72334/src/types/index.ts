export type IssueType = 'denominator_zero_empty' | 'normal'
export type BoundaryStatus = 'pending_review' | 'reviewed' | 'resolved'
export type NextAction = '找数据复核人' | '找竞赛教练唐老师'
export type ColumnType = 'numeric' | 'text'
export type Role = '数据复核人' | '竞赛教练唐老师'

export interface AuditEntry {
  timestamp: string
  role: Role
  action: '创建' | '复核' | '修正' | '解决'
  description: string
  field?: string
  from?: string
  to?: string
}

export interface BoundaryRecord {
  id: string
  rowIndex: number
  columnName: string
  columnIndex: number
  currentValue: string
  originalValue: string
  correctedValue: string
  denominatorColumnName: string
  denominatorColumnIndex: number
  denominatorValue: number
  issueType: IssueType
  status: BoundaryStatus
  reason: string
  missingMaterial: string
  nextAction: NextAction
  reviewedBy?: Role
  resolvedBy?: Role
  resolvedReason?: string
  createdAt: string
  reviewedAt?: string
  resolvedAt?: string
  history: AuditEntry[]
}

export interface WeightEntry {
  id: string
  columnName: string
  columnIndex: number
  weight: number
  isComplete: boolean
}

export interface RawData {
  id: string
  fileName: string
  headers: string[]
  columnTypes: ColumnType[]
  rows: string[][]
  numericMatrix: number[][]
  uploadTime: string
}

export interface SVDResult {
  id: string
  projectedData: [number, number, number][]
  singularValues: number[]
  explainedVarianceRatio: number[]
  anomalyPointIndices: number[]
}

export interface AnomalyPoint {
  recordId: string
  pointIndex: number
  projectedCoords: [number, number, number]
  linkedBoundaryId: string
  linkedWeightId: string | null
}

export interface WorkflowStep {
  step: number
  label: string
  route: string
  isComplete: boolean
}
