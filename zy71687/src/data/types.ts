export type Platform = 'Amazon' | 'Shopee' | '独立站'
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY'
export type TransactionStatus = 'pending' | 'collected' | 'settled'
export type WithdrawalStatus = 'pending' | 'arrived' | 'delayed'
export type ForwardStatus = 'active' | 'matched' | 'expired' | 'duplicate_error' | 'rate_date_error'
export type PlanStatus = 'planned' | 'executed' | 'skipped_exception'

export interface PlatformTransaction {
  id: string
  platform: Platform
  orderId: string
  currency: Currency
  amount: number
  status: TransactionStatus
  transactionDate: string
  settlementDate: string | null
}

export interface WithdrawalRecord {
  id: string
  platform: Platform
  currency: Currency
  amount: number
  requestDate: string
  actualArrivalDate: string
  status: WithdrawalStatus
  delayReason: string | null
}

export interface ForwardContract {
  id: string
  currency: Currency
  amount: number
  lockedRate: number
  contractDate: string
  expiryDate: string
  status: ForwardStatus
  matchedOrderId: string | null
}

export interface SettlementPlan {
  id: string
  transactionId: string
  forwardContractId: string | null
  withdrawalId: string
  currency: Currency
  amount: number
  settledRate: number
  settledAmountCNY: number
  plannedDate: string
  status: PlanStatus
  exceptionReason: string | null
}

export interface SchedulingReport {
  id: string
  reportDate: string
  dateFrom: string
  dateTo: string
  totalSettledCNY: number
  totalUncoveredCNY: number
  exceptionCount: number
  exportFormat: 'CSV' | 'PDF'
}

export interface ExceptionRecord {
  id: string
  type: 'withdrawal_delay' | 'forward_duplicate' | 'rate_date_error'
  description: string
  impactAmount: number
  impactCurrency: Currency
  reason: string
  relatedTransactionId: string | null
  relatedForwardId: string | null
  relatedWithdrawalId: string | null
  status: 'unresolved' | 'skipped' | 'resolved'
}

export interface KpiData {
  totalPendingSettlement: number
  totalForwardLocked: number
  totalUncoveredGap: number
  exceptionCount: number
}

export interface CollectionBoardItem {
  status: 'pending' | 'collecting' | 'collected'
  amount: number
  count: number
  items: PlatformTransaction[]
}

export interface GapWarning {
  type: 'uncovered' | 'expiring_soon' | 'available_forward'
  currency: Currency
  amount: number
  description: string
  relatedIds: string[]
}

export interface SpotRate {
  currency: Currency
  rate: number
}
