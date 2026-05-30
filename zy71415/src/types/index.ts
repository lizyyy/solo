export type CollectStatus = "processed" | "pending" | "returned"

export type AlertType = "reserve_shortage" | "limit_exceeded" | "duplicate_collect"

export interface SourceTrace {
  step: number
  action: string
  timestamp: string
  operator: string
  ruleVersion: string
  detail: string
}

export interface SubAccount {
  id: string
  accountNo: string
  accountName: string
  bank: string
  balance: number
  collectAmount: number
  reserveBalance: number
  reserveRequired: number
  regLimit: number
  limitUsed: number
  limitRemain: number
  status: CollectStatus
  ruleVersion: string
  collectDate: string
  sourceTrace: SourceTrace[]
  arrivalTime?: string
  isDuplicateCollect?: boolean
  isReserveShortage?: boolean
  isLimitExceeded?: boolean
}

export interface StatusDefinition {
  status: CollectStatus
  label: string
  condition: string
  color: string
  bgColor: string
}

export interface RuleVersion {
  version: string
  effectiveDate: string
  description: string
  reserveRatio: number
  regLimitConfig: Record<string, number>
  statusDefinitions: StatusDefinition[]
}

export interface FilterState {
  dateRange: [string, string]
  banks: string[]
  statuses: CollectStatus[]
  ruleVersion: string
  searchKeyword: string
}

export interface Alert {
  id: string
  type: AlertType
  accountId: string
  accountName: string
  bank: string
  message: string
  timestamp: string
  severity: "warning" | "critical"
}

export type SortField = "accountNo" | "balance" | "collectAmount" | "reserveBalance" | "limitUsed" | "limitRemain" | "collectDate"
export type SortDirection = "asc" | "desc"
