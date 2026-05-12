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
  paidAmount: number
  refundAmount?: number
  refundedAt?: string
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
  memberId: string
  memberName: string
  memberPhone: string
  isMember?: boolean
}
