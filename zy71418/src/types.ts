export type DiffType = 'cancellation_fee' | 'cross_market' | 'rate_version' | 'inconsistent'
export type ReconciliationStatus = 'pending' | 'confirmed' | 'review' | 'resolved'
export type Market = 'SSE' | 'SZSE' | 'BSE' | 'NEEQ'
export type TimelineEventType = 'order_created' | 'trade_report' | 'order_cancelled' | 'cross_market_tag' | 'rate_version_change' | 'conclusion'

export interface ReconciliationRecord {
  id: string
  brokerId: string
  brokerName: string
  orderId: string
  matchingFee: number
  tradeReportFee: number
  diffAmount: number
  diffTypes: DiffType[]
  status: ReconciliationStatus
  market: Market
  createdAt: string
  updatedAt: string
  aggregationConclusion?: AggregationConclusion
}

export interface TimelineEvent {
  id: string
  recordId: string
  eventType: TimelineEventType
  timestamp: string
  description: string
  metadata: Record<string, unknown>
}

export interface BrokerRateEvidence {
  id: string
  recordId: string
  rateVersion: string
  effectiveTime: string
  rateValue: number
  matchingConclusion: string
  tradeReportConclusion: string
  isInconsistent: boolean
}

export interface AggregationConclusion {
  recordId: string
  conclusionAmount: number
  logicDescription: string
  corroboratedByRecalc: boolean
  corroboratedByRollback: boolean
}

export interface FeeRecalcDetail {
  id: string
  recordId: string
  step: number
  beforeRate: number
  afterRate: number
  beforeFee: number
  afterFee: number
  reason: string
  timestamp: string
}

export interface CancelRollbackDetail {
  id: string
  recordId: string
  step: number
  beforeFee: number
  afterFee: number
  rollbackReason: string
  timestamp: string
}

export interface FilterState {
  brokerIds: string[]
  dateRange: [string, string] | null
  diffTypes: DiffType[]
  statuses: ReconciliationStatus[]
  markets: Market[]
}

export const DIFF_TYPE_LABELS: Record<DiffType, string> = {
  cancellation_fee: '撤单仍计费',
  cross_market: '跨市场重复',
  rate_version: '费率版本差异',
  inconsistent: '结论不一致',
}

export const STATUS_LABELS: Record<ReconciliationStatus, string> = {
  pending: '待处理',
  confirmed: '已确认',
  review: '待复核',
  resolved: '已解决',
}

export const MARKET_LABELS: Record<Market, string> = {
  SSE: '上交所',
  SZSE: '深交所',
  BSE: '北交所',
  NEEQ: '股转系统',
}

export const EVENT_TYPE_LABELS: Record<TimelineEventType, string> = {
  order_created: '订单创建',
  trade_report: '成交回报',
  order_cancelled: '订单撤销',
  cross_market_tag: '跨市场标记',
  rate_version_change: '费率版本变更',
  conclusion: '对账结论',
}
