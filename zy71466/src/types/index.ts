export interface TensileCurve {
  id: string
  sampleId: string
  batchNo: string
  deviceId: string
  strain: number[]
  stress: number[]
  fractureType?: string
  isAnomaly: boolean
  alignedStrain?: number[]
  alignedStress?: number[]
  clusterId?: number
}

export interface ClusterExplanation {
  clusterId: number
  count: number
  avgFractureStrength: number
  dominantFractureType: string
  dominantBatch: string
  anomalyRatio: number
  description: string
}

export interface ClusterResult {
  k: number
  labels: number[]
  centroids: number[][]
  pcaCoords: number[][]
  silhouette: number
  explanations: ClusterExplanation[]
}

export interface ConflictRecord {
  curveId: string
  sampleId: string
  conflictType: 'batch_mismatch' | 'device_anomaly' | 'curve_batch_conflict'
  description: string
  curveJudgment: string
  metaJudgment: string
  suggestion: string
  severity: 'warning' | 'error'
}

export interface FilterState {
  selectedBatches: string[]
  selectedDevices: string[]
  selectedAnomalyTypes: string[]
  selectedFractureTypes: string[]
}

export interface AlignmentParams {
  mode: 'interpolation' | 'dtw'
  targetLength: number
}

export interface AnalysisReport {
  filterState: FilterState
  curves: TensileCurve[]
  clusterResult: ClusterResult | null
  conflicts: ConflictRecord[]
  alignmentParams: AlignmentParams
  exportTime: string
}
