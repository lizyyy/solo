export type IssueType = 'denominator_zero_empty' | 'normal'
export type BoundaryStatus = 'pending_review' | 'reviewed' | 'resolved'
export type NextAction = '找数据复核人' | '找竞赛教练唐老师'

export interface BoundaryRecord {
  id: string
  rowIndex: number
  columnName: string
  currentValue: string
  denominatorColumnName: string
  denominatorValue: number
  issueType: IssueType
  status: BoundaryStatus
  reason: string
  missingMaterial: string
  nextAction: NextAction
}

export interface WeightEntry {
  id: string
  columnName: string
  weight: number
  isComplete: boolean
}

export interface RawData {
  id: string
  fileName: string
  headers: string[]
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
