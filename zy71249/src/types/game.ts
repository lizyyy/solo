export type Currency = 'CNY' | 'USD' | 'EUR'

export interface Material {
  id: string
  name: string
  safetyStock: number
  unitCost: number
  currency: Currency
}

export interface Supplier {
  id: string
  name: string
  reliability: number
  leadTime: number
  unitPrice: number
  currency: Currency
  materialId: string
  isActive: boolean
  disruptionRound: number | null
  disruptionDuration: number
}

export interface InventoryTransaction {
  round: number
  type: 'IN' | 'OUT'
  quantity: number
  source: string
  materialId: string
}

export interface InventoryItem {
  materialId: string
  quantity: number
  transactions: InventoryTransaction[]
}

export type EventType = 'PORT_CONGESTION' | 'EXCHANGE_RATE' | 'SUPPLIER_DISRUPTION'

export interface GameEvent {
  id: string
  type: EventType
  description: string
  impact: number
  round: number
  resolved: boolean
}

export type RiskType = 'DISRUPTION' | 'BACKLOG' | 'FX_LOSS'

export interface RiskRecord {
  id: string
  type: RiskType
  materialId: string
  amount: number
  description: string
  round: number
}

export type CashType = 'INCOME' | 'EXPENSE' | 'FX_LOSS' | 'PENALTY'

export interface CashTransaction {
  id: string
  type: CashType
  amount: number
  description: string
  round: number
}

export interface CustomerOrder {
  id: string
  materialId: string
  quantity: number
  deadline: number
  unitPrice: number
  isDelivered: boolean
  isExpired: boolean
  penaltyAmount: number
  roundCreated: number
}

export interface PendingShipment {
  id: string
  supplierId: string
  materialId: string
  quantity: number
  arrivalRound: number
  costInCny: number
  isDelayed: boolean
  originalArrivalRound: number
}

export interface ExchangeRate {
  USD_CNY: number
  EUR_CNY: number
}

export interface BusinessReport {
  sessionId: string
  totalRevenue: number
  totalExpense: number
  totalFxLoss: number
  totalPenalty: number
  netProfit: number
  riskRecords: RiskRecord[]
  materialIds: string[]
  roundSummaries: RoundSummary[]
}

export interface RoundSummary {
  round: number
  revenue: number
  expense: number
  fxLoss: number
  penalty: number
  profit: number
  eventCount: number
}

export interface RoundSnapshot {
  round: number
  events: GameEvent[]
  actions: string[]
  cashAfterRound: number
  inventoryAfterRound: Record<string, number>
  exchangeRate: ExchangeRate
}

export interface ReplayRecord {
  sessionId: string
  date: string
  finalScore: number
  netProfit: number
  rounds: RoundSnapshot[]
}

export interface GameSession {
  id: string
  currentRound: number
  maxRounds: number
  cash: number
  exchangeRate: ExchangeRate
  materials: Material[]
  suppliers: Supplier[]
  inventory: InventoryItem[]
  events: GameEvent[]
  riskRecords: RiskRecord[]
  cashTransactions: CashTransaction[]
  orders: CustomerOrder[]
  pendingShipments: PendingShipment[]
  selectedSupplierId: string
  isFinished: boolean
  report: BusinessReport | null
  roundSnapshots: RoundSnapshot[]
  currentRoundActions: string[]
  isRoundActive: boolean
}
