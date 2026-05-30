export interface Order {
  id: string
  commodity: string
  quantity: number
  foreignPrice: number
  currency: string
  deadlineRound: number
  breachRate: number
  status: 'pending' | 'loaded' | 'shipped' | 'breached' | 'cancelled'
  assignedContainerId: string | null
  createdRound: number
}

export interface ExchangeRate {
  round: number
  rate: number
  previousRate: number
  direction: 'up' | 'down' | 'stable'
}

export interface CabinSlot {
  id: string
  tier: 'first' | 'standard' | 'economy'
  costPerContainer: number
  capacity: number
  usedCapacity: number
  locked: boolean
}

export interface Container {
  id: string
  orderId: string | null
  status: 'empty' | 'loaded' | 'shipped'
}

export interface LedgerEntry {
  id: string
  round: number
  type: 'income' | 'cabin_fee' | 'breach_penalty' | 'overbooking_penalty'
  amount: number
  orderId: string | null
  description: string
  timestamp: number
}

export type ErrorType = 'exchange_rate_reversal' | 'cabin_overbooking' | 'breach_penalty_missed'

export interface TraceStep {
  stage: 'order_selected' | 'container_assigned' | 'rate_locked' | 'cabin_booked' | 'breach_checked' | 'settled'
  description: string
  value: number | null
}

export interface ReportEntry {
  id: string
  round: number
  orderId: string
  steps: TraceStep[]
  finalProfit: number
  hasError: boolean
  errorTypes: ErrorType[]
}

export interface RoundSnapshot {
  round: number
  rate: number
  orders: Order[]
  containers: Container[]
  cabinSlots: CabinSlot[]
  balance: number
  ledgerEntries: LedgerEntry[]
}

export type GamePhase = 'setup' | 'playing' | 'round_end' | 'finished'

export interface GameConfig {
  totalRounds: number
  baseRate: number
  rateVariance: number
  initialBalance: number
  containerCount: number
  cabinTiers: CabinSlot[]
}

export const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  exchange_rate_reversal: '汇率反向操作',
  cabin_overbooking: '舱位超订',
  breach_penalty_missed: '违约金漏扣',
}

export const CABIN_TIER_LABELS: Record<string, string> = {
  first: '头等舱',
  standard: '标准舱',
  economy: '经济舱',
}

export const ORDER_STATUS_LABELS: Record<Order['status'], string> = {
  pending: '待装船',
  loaded: '已装载',
  shipped: '已装船',
  breached: '已违约',
  cancelled: '已取消',
}

export const LEDGER_TYPE_LABELS: Record<LedgerEntry['type'], string> = {
  income: '订单收入',
  cabin_fee: '舱位费',
  breach_penalty: '违约金',
  overbooking_penalty: '超订罚金',
}
