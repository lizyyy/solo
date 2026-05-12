export enum SyncStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed'
}

export enum CardStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REFUNDED = 'refunded',
  BLACKLISTED = 'blacklisted'
}

export enum AnomalyType {
  PLATE_NOT_SYNCED = 'plate_not_synced',
  REFUND_STILL_ACTIVE = 'refund_still_active',
  BLACKLIST_EXPIRED = 'blacklist_expired',
  MULTIPLE_CARDS_SAME_PLATE = 'multiple_cards_same_plate',
  SYNC_FAILED = 'sync_failed'
}

export enum AnomalyStatus {
  OPEN = 'open',
  PROCESSING = 'processing',
  RESOLVED = 'resolved',
  IGNORED = 'ignored'
}

export interface MonthlyCard {
  id: string
  cardNo: string
  plateNumber: string
  ownerName: string
  ownerPhone: string
  startDate: string
  endDate: string
  status: CardStatus
  syncStatus: SyncStatus
  syncAttempts: number
  lastSyncTime?: string
  lastSyncError?: string
  createdAt: string
  updatedAt: string
}

export interface BlacklistRecord {
  id: string
  plateNumber: string
  reason: string
  startTime: string
  endTime?: string
  isActive: boolean
  createdAt: string
}

export interface RefundRecord {
  id: string
  cardId: string
  plateNumber: string
  refundAmount: number
  refundDate: string
  refundReason: string
  operator: string
  synced: boolean
}

export interface Anomaly {
  id: string
  type: AnomalyType
  cardId?: string
  plateNumber?: string
  description: string
  status: AnomalyStatus
  priority: 'high' | 'medium' | 'low'
  assignee?: string
  resolution?: string
  resolvedAt?: string
  createdAt: string
  updatedAt: string
}

export interface ProcessHistory {
  id: string
  anomalyId: string
  cardId?: string
  action: string
  operator: string
  result: string
  createdAt: string
}

export interface SyncLog {
  id: string
  cardId: string
  plateNumber: string
  status: SyncStatus
  errorMessage?: string
  retryCount: number
  createdAt: string
}
