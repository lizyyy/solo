export type PalletStatus = 'in_stock' | 'in_transit' | 'with_customer' | 'damaged' | 'pending_compensation'

export interface Pallet {
  id: string
  code: string
  type: string
  deposit: number
  status: PalletStatus
  currentCustomer?: string
  lastOutboundId?: string
  createdAt: string
  updatedAt: string
}

export interface OutboundRecord {
  id: string
  palletIds: string[]
  customerId: string
  customerName: string
  driverName: string
  plateNumber: string
  outboundDate: string
  expectedReturnDate: string
  status: 'pending_signature' | 'signed' | 'returned' | 'overdue'
  signedDate?: string
  returnedDate?: string
  createdAt: string
}

export interface Customer {
  id: string
  name: string
  contact: string
  phone: string
  address: string
  totalDeposit: number
  usedDeposit: number
  createdAt: string
}

export interface DamageRecord {
  id: string
  palletId: string
  outboundId: string
  customerId: string
  customerName: string
  damageLevel: 'minor' | 'medium' | 'severe'
  damageDescription: string
  deductionAmount: number
  deducted: boolean
  detectedDate: string
  deductedDate?: string
  createdAt: string
}

export interface SettlementRecord {
  id: string
  customerId: string
  customerName: string
  type: 'deposit_payment' | 'deduction' | 'refund'
  amount: number
  relatedDamageIds?: string[]
  remark: string
  settlementDate: string
  createdAt: string
}

export type RecordStatus = 'pending' | 'completed' | 'blocked'

export interface ProcessRecord {
  id: string
  type: 'outbound' | 'signature' | 'return' | 'damage' | 'settlement'
  refId: string
  title: string
  description: string
  status: RecordStatus
  blockReason?: string
  createdAt: string
  handledAt?: string
}

export interface DashboardStats {
  inStock: number
  inTransit: number
  withCustomer: number
  pendingCompensation: number
  totalPallets: number
}
