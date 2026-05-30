export interface TyphoonEvent {
  id: string
  name: string
  category: string
  startDate: string
  endDate: string
}

export interface TyphoonPathPoint {
  id: string
  typhoonId: string
  latitude: number
  longitude: number
  timestamp: string
  windSpeed: number
  pressure: number
}

export interface Region {
  id: string
  name: string
  code: string
  latitude: number
  longitude: number
}

export interface Policy {
  id: string
  regionId: string
  typhoonId: string
  insuredAmount: number
  premium: number
  effectiveDate: string
  policyType: string
}

export interface Claim {
  id: string
  policyId: string
  regionId: string
  typhoonId: string
  claimAmount: number
  claimDate: string
  claimStatus: string
  source: string
}

export interface CubeParameters {
  typhoonId: string
  timeRange: [number, number]
  regionIds: string[]
  claimThreshold: number
  showTyphoonPath: boolean
  showPolicyDistribution: boolean
  showClaims: boolean
}

export type AnomalyType = 'path_time_misalign' | 'region_aggregate_conflict' | 'extreme_claim_occlusion' | 'source_missing' | 'time_gap'

export interface AnomalyRecord {
  id: string
  cubeSnapshotId: string
  type: AnomalyType
  sourceType: 'typhoon_path' | 'policy' | 'claim'
  sourceId: string
  description: string
  severity: 'high' | 'medium' | 'low'
  acknowledged: boolean
  detectedAt: string
}

export interface DecisionLog {
  id: string
  cubeSnapshotId: string
  action: string
  reason: string
  operator: string
  timestamp: string
}

export interface LossCubeSnapshot {
  id: string
  name: string
  typhoonId: string
  parameters: CubeParameters
  anomalies: AnomalyRecord[]
  decisions: DecisionLog[]
  createdAt: string
  exportData: ExportResult | null
}

export interface ExportResult {
  timestamp: string
  parameters: CubeParameters
  summary: {
    totalInsuredAmount: number
    totalClaims: number
    totalClaimAmount: number
    regionCount: number
    anomalyCount: number
  }
  anomalies: AnomalyRecord[]
  decisions: DecisionLog[]
  regionBreakdown: {
    regionId: string
    regionName: string
    insuredAmount: number
    claimCount: number
    claimAmount: number
  }[]
}
