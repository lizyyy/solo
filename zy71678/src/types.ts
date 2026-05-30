export type ContractStatus = 'active' | 'expiring' | 'expired' | 'pending'
export type SampleStatus = 'complete' | 'incomplete' | 'at_risk'
export type PlatformStatus = 'active' | 'expired' | 'pending'
export type ReleaseStatus = 'draft' | 'validated' | 'scheduled' | 'released' | 'blocked'
export type RiskSeverity = 'high' | 'medium' | 'low'
export type RiskType = 'contract_expired' | 'contract_expiring' | 'platform_overstep' | 'royalty_missing' | 'royalty_insufficient' | 'release_out_of_scope'

export interface Sample {
  id: string
  title: string
  originalWork: string
  originalArtist: string
  sampleType: string
  sourceLabel: string
  contractId: string
  royaltyIds: string[]
  status: SampleStatus
  notes: string
}

export interface Contract {
  id: string
  contractNo: string
  licensor: string
  licensee: string
  authType: string
  startDate: string
  endDate: string
  status: ContractStatus
  attachments: string[]
}

export interface Platform {
  id: string
  name: string
  type: string
  region: string
  contractId: string
  startDate: string
  endDate: string
  status: PlatformStatus
}

export interface Royalty {
  id: string
  sampleId: string
  rightHolder: string
  percentage: number
  settlementCycle: string
  notes: string
}

export interface Release {
  id: string
  title: string
  releaseDate: string
  sampleId: string
  platformIds: string[]
  status: ReleaseStatus
  validationErrors: string[]
}

export interface RiskItem {
  id: string
  type: RiskType
  severity: RiskSeverity
  message: string
  step: string
  relatedId: string
  relatedType: 'sample' | 'contract' | 'platform' | 'royalty' | 'release'
}
