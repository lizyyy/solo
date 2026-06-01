export type PriorType = 'beta' | 'normal'

export interface PriorParams {
  type: PriorType
  alpha: number
  beta: number
  mu?: number
  sigma2?: number
}

export type AdUnit = 'CPM' | 'CPC' | 'CPA'

export interface Observation {
  obsId: string
  channel: string
  impressions: number
  clicks: number
  conversions: number
  unit: AdUnit
  weight: number
  source: string
  recordedAt: string
  note: string
  isOutlier: boolean
  outlierReason: string
}

export interface Batch {
  batchId: string
  createdAt: string
  operatorName: string
  note: string
  observations: Observation[]
}

export type WarningType = 'unit_mismatch' | 'weight_not_closed' | 'boundary_exceeded' | 'outlier_detected'
export type WarningSeverity = 'info' | 'warn' | 'error'

export interface Warning {
  type: WarningType
  field: string
  message: string
  detail: string
  severity: WarningSeverity
}

export interface PosteriorResult {
  computeId: string
  batchId: string
  priorSnapshot: PriorParams
  posteriorParams: PriorParams
  observations: Observation[]
  warnings: Warning[]
  computedAt: string
  posteriorMean: number
  posteriorStd: number
  credibleLower: number
  credibleUpper: number
}

export interface ChangedField {
  field: string
  before: number
  after: number
  delta: number
  reason: string
}

export interface SupplementDiff {
  supplementId: string
  computeId: string
  obsId: string
  before: PosteriorResult
  after: PosteriorResult
  changedFields: ChangedField[]
  supplementedAt: string
  supplementedBy: string
}

export interface AppData {
  batches: Batch[]
  computations: PosteriorResult[]
  supplements: SupplementDiff[]
  priorParams: PriorParams
  boundaryConfig: BoundaryConfig
}

export interface BoundaryConfig {
  maxAlpha: number
  maxBeta: number
  maxMu: number
  maxSigma2: number
  minConversions: number
  maxConversions: number
  outlierStdThreshold: number
}
