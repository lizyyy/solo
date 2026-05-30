export type ExceptionType = 'claim_missing' | 'discount_error' | 'quote_overwrite' | 'channel_conflict'

export interface PolicyRecord {
  id: string
  customerName: string
  plateNumber: string
  insuranceTypes: string[]
  coverageAmounts: Record<string, number>
  premium: number
  startDate: string
  endDate: string
  ncdCoefficient: number
}

export interface ClaimRecord {
  id: string
  policyId: string
  claimDate: string
  claimAmount: number
  claimType: string
  isIncluded: boolean
  missReason?: string
}

export interface DiscountStep {
  label: string
  coefficient: number
  source: string
}

export interface DiscountCalculation {
  id: string
  policyId: string
  baseNCD: number
  channelDiscount: number
  finalCoefficient: number
  steps: DiscountStep[]
  isCorrect: boolean
  errorReason?: string
}

export interface QuoteVersion {
  id: string
  policyId: string
  channel: string
  version: number
  premium: number
  timestamp: string
  isOverwritten: boolean
  overwriteReason?: string
}

export interface ChannelRule {
  id: string
  channelName: string
  discountRate: number
  conditions: string[]
}

export interface CustomerNote {
  id: string
  policyId: string
  content: string
  timestamp: string
  author: string
}

export interface DifferenceItem {
  field: string
  expected: string
  actual: string
  reason: string
  severity: 'info' | 'warning' | 'error'
}

export interface ComparisonResult {
  id: string
  policyId: string
  differences: DifferenceItem[]
  overallStatus: 'normal' | 'warning' | 'error'
  summary: string
}

export interface RenewalTask {
  id: string
  policyId: string
  customerName: string
  plateNumber: string
  status: 'pending' | 'processing' | 'completed' | 'exception'
  exceptionTypes: ExceptionType[]
  policy: PolicyRecord
  claims: ClaimRecord[]
  discount: DiscountCalculation
  quotes: QuoteVersion[]
  channelRules: ChannelRule[]
  notes: CustomerNote[]
  comparison: ComparisonResult
}

export const EXCEPTION_LABELS: Record<ExceptionType, string> = {
  claim_missing: '出险漏入',
  discount_error: '折扣误套',
  quote_overwrite: '版本覆盖',
  channel_conflict: '渠道冲突',
}

export const STATUS_LABELS: Record<RenewalTask['status'], string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成',
  exception: '异常',
}

export const STATUS_COLORS: Record<RenewalTask['status'], string> = {
  pending: '#94a3b8',
  processing: '#0ea5e9',
  completed: '#22c55e',
  exception: '#ef4444',
}

export const SEVERITY_COLORS: Record<DifferenceItem['severity'], string> = {
  info: '#0ea5e9',
  warning: '#f97316',
  error: '#ef4444',
}
