export enum PlayerStatus {
  CONFIRMED = 'confirmed',
  WAITLIST = 'waitlist',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export enum SessionStatus {
  OPEN = 'open',
  FULL = 'full',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed'
}

export interface Member {
  id: string
  name: string
  phone: string
  isMember: boolean
  memberDiscount: number
  createdAt: string
}

export interface FeeAdjustment {
  id: string
  adjustedAt: string
  reason: 'player_added' | 'player_cancelled' | 'waitlist_promoted' | 'manual_adjustment'
  playerCountBefore: number
  playerCountAfter: number
  feePerPersonBefore: number
  feePerPersonAfter: number
  description: string
}

export interface PlayerSettlement {
  playerId: string
  playerName: string
  originalFee: number
  finalFee: number
  adjustmentAmount: number
  refundDue: number
  additionalPaymentDue: number
  isMember: boolean
  memberDiscount: number
}

export interface Player {
  id: string
  memberId: string
  memberName: string
  memberPhone: string
  isMember: boolean
  status: PlayerStatus
  joinedAt: string
  confirmedAt?: string
  cancelledAt?: string
  originalPaidAmount: number
  currentFee: number
  totalAdjustments: number
  refundAmount?: number
  refundedAt?: string
  settlement?: PlayerSettlement
}

export interface SessionSettlement {
  isSettled: boolean
  settledAt?: string
  finalPlayerCount: number
  totalFee: number
  actualFeePerPerson: number
  playerSettlements: PlayerSettlement[]
}

export interface CourtSession {
  id: string
  courtNumber: number
  date: string
  startTime: string
  endTime: string
  maxPlayers: number
  minPlayers: number
  totalFee: number
  status: SessionStatus
  players: Player[]
  waitlist: Player[]
  createdAt: string
  autoCancelIfNotEnough: boolean
  cancelThresholdMinutes: number
  feeAdjustments: FeeAdjustment[]
  settlement?: SessionSettlement
  referenceFeePerPerson?: number
}

export interface CreateSessionRequest {
  courtNumber: number
  date: string
  startTime: string
  endTime: string
  maxPlayers?: number
  minPlayers?: number
  totalFee: number
  autoCancelIfNotEnough?: boolean
  cancelThresholdMinutes?: number
}

export interface AddPlayerRequest {
  memberName: string
  memberPhone: string
  isMember?: boolean
}

export interface ConfirmAttendanceRequest {
  confirmed?: boolean
}

export interface CancelPlayerRequest {
  reason?: string
}
