export interface ApiLog {
  timestamp: string
  requestId: string
  appId: string
  apiName: string
  duration: number
  status: number
  responseSize: number
}

export interface AppMapping {
  appId: string
  teamId: string
  teamName: string
  businessLine: string
  effectiveFrom: string
  effectiveTo: string | null
}

export type CostModelType = 'perCall' | 'perDuration' | 'flatRate' | 'sharedPool'

export interface PerCallCostModel {
  type: 'perCall'
  costPerCall: number
}

export interface PerDurationCostModel {
  type: 'perDuration'
  costPerSecond: number
  minCost?: number
}

export interface FlatRateCostModel {
  type: 'flatRate'
  costPerCall: number
  providerCost?: number
}

export interface SharedPoolCostModel {
  type: 'sharedPool'
}

export type CostModel = PerCallCostModel | PerDurationCostModel | FlatRateCostModel | SharedPoolCostModel

export interface CostRule {
  version: number
  effectiveFrom: string
  effectiveTo: string | null
  apiName: string
  description: string
  costModel: CostModel
}

export interface SharedPoolAllocation {
  teamId: string
  ratio: number
  effectiveFrom: string
  effectiveTo: string | null
}

export type AllocationStrategy = 'byCallVolume' | 'byRevenue' | 'byRatio'

export interface SharedPool {
  poolId: string
  poolName: string
  description: string
  allocationStrategy: AllocationStrategy
  defaultRatio: number
  allocations: SharedPoolAllocation[]
}

export interface UnknownAppIdPolicy {
  assignToDefaultTeam: boolean
  defaultTeamId: string | null
  markAsUnsettled: boolean
  unsettledPoolId: string
}

export interface ValidationRules {
  allowRatioOver100: boolean
  allowMissingRatio: boolean
  maxSettledDays: number
}

export interface SharedCostConfig {
  pools: SharedPool[]
  unknownAppIdPolicy: UnknownAppIdPolicy
  validationRules: ValidationRules
}

export type AllocationStatus = 'settled' | 'unsettled' | 'partially_settled'

export type ChargeSource = 'direct' | 'shared_pool' | 'manual_adjustment' | 'unsettled'

export interface ChargeDetail {
  id: string
  requestId: string
  appId: string
  apiName: string
  timestamp: string
  duration: number
  rawCost: number
  costRuleVersion: number
  teamId: string | null
  teamName: string | null
  businessLine: string | null
  allocationStatus: AllocationStatus
  chargeSource: ChargeSource
  sharedPoolId: string | null
  manualAdjId: string | null
  notes: string
}

export interface ManualAdjustment {
  id: string
  createdAt: string
  createdBy: string
  effectiveFrom: string
  effectiveTo: string | null
  requestId?: string
  appId?: string
  apiName?: string
  targetTeamId: string
  targetTeamName: string
  targetBusinessLine: string
  amount: number
  reason: string
  isExpired: boolean
}

export interface CalculationContext {
  periodStart: string
  periodEnd: string
  logs: ApiLog[]
  appMappings: AppMapping[]
  costRules: CostRule[]
  sharedConfig: SharedCostConfig
  manualAdjustments: ManualAdjustment[]
}

export interface TeamBill {
  teamId: string
  teamName: string
  businessLine: string
  totalAmount: number
  directCost: number
  sharedPoolCost: number
  manualAdjustment: number
  unsettledAmount: number
  chargeCount: number
  settlementStatus: AllocationStatus
}

export interface ApiCostSummary {
  apiName: string
  totalCalls: number
  uniqueAppIds: string[]
  totalCost: number
  settledCost: number
  unsettledCost: number
  costRuleVersions: number[]
}

export interface BusinessLineSummary {
  businessLine: string
  teams: string[]
  totalCost: number
  directCost: number
  sharedPoolCost: number
}

export interface UnsettledItem {
  requestId: string
  appId: string
  apiName: string
  cost: number
  reason: string
}

export interface SharedPoolBreakdown {
  poolId: string
  poolName: string
  totalCost: number
  allocations: Array<{
    teamId: string
    teamName: string
    ratio: number
    amount: number
  }>
  explanation: string
}

export interface CalculationResult {
  context: {
    periodStart: string
    periodEnd: string
    totalRawLogs: number
    deduplicatedLogs: number
    totalCalls: number
  }
  summary: {
    totalCost: number
    settledCost: number
    unsettledCost: number
    settlementRate: number
  }
  teamBills: TeamBill[]
  apiSummaries: ApiCostSummary[]
  businessLineSummaries: BusinessLineSummary[]
  charges: ChargeDetail[]
  unsettledItems: UnsettledItem[]
  sharedPoolBreakdowns: SharedPoolBreakdown[]
  issues: ValidationIssue[]
}

export type ValidationIssueType = 
  | 'duplicate_log'
  | 'unknown_app_id'
  | 'unknown_api'
  | 'cost_rule_missing'
  | 'ratio_over_100'
  | 'manual_adj_expired'
  | 'mapping_expired'

export interface ValidationIssue {
  type: ValidationIssueType
  severity: 'warning' | 'error' | 'info'
  message: string
  details?: Record<string, unknown>
  affectedCount?: number
}

export interface PreflightResult {
  issues: ValidationIssue[]
  mappingGaps: Array<{
    appId: string
    callCount: number
    lastSeen: string
  }>
  unknownApis: Array<{
    apiName: string
    callCount: number
  }>
  ratioIssues: Array<{
    poolId: string
    poolName: string
    totalRatio: number
    teams: string[]
  }>
  expiredAdjustments: ManualAdjustment[]
  canProceed: boolean
}

export interface RecomputeDiff {
  teamId: string
  teamName: string
  previousAmount: number
  currentAmount: number
  difference: number
  changeReasons: string[]
}
