export interface Reservation {
  id: number
  room: string
  instrument: string
  person: string
  timeSlot: string
  date: string
  noiseLevel: number
  originalRoom?: string | null
  originalInstrument?: string | null
  status: 'normal' | 'conflict' | 'high_noise' | 'swapped'
  createdAt: string
  updatedAt: string
}

export interface SwapLog {
  id: number
  reservationId: number
  fromRoom: string
  toRoom: string
  reason: string
  operator: string
  createdAt: string
}

export interface ConflictResult {
  type: 'time_conflict'
  reservationIds: number[]
  room: string
  timeSlot: string
  date: string
  description: string
  status: 'pending' | 'resolved'
}

export interface NoiseAdjacencyResult {
  type: 'noise_adjacency'
  reservationIds: number[]
  roomA: string
  roomB: string
  timeSlot: string
  date: string
  noiseA: number
  noiseB: number
  combinedRisk: 'high' | 'medium' | 'low'
  suggestion: string
  status: 'pending' | 'resolved'
}

export interface DetectionReport {
  id: number
  name: string
  conflictCount: number
  adjacencyRiskCount: number
  details: string
  createdAt: string
}

export interface Room {
  id: number
  name: string
  type: string
  floor: number
  adjacentRooms: string[]
  baseNoiseLevel: number
}

export const TIME_SLOTS = [
  '08:00-10:00',
  '10:00-12:00',
  '14:00-16:00',
  '16:00-18:00',
  '19:00-21:00',
]

export const INSTRUMENTS = ['钢琴', '架子鼓', '声乐', '小提琴', '大提琴', '吉他']

export const NOISE_LEVELS = [
  { value: 1, label: '1 - 极安静' },
  { value: 2, label: '2 - 安静' },
  { value: 3, label: '3 - 一般' },
  { value: 4, label: '4 - 较吵' },
  { value: 5, label: '5 - 很吵' },
]
