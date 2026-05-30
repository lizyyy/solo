export interface Seat {
  id: string
  rowLabel: string
  seatNumber: number
  x: number
  y: number
  z: number
  zoneId: string
}

export interface SeatMeasurement {
  seatId: string
  frequencyBand: string
  splDB: number
  dataSource: string
  measuredAt: string
}

export interface Speaker {
  id: string
  label: string
  x: number
  y: number
  z: number
  rotationY: number
  model: string
  delayMs: number
  zoneId: string
}

export interface SpeakerConfig {
  speakerId: string
  frequencyBand: string
  gainDB: number
  delayMs: number
  dataSource: string
}

export interface AudienceZone {
  id: string
  name: string
  color: string
}

export interface Note {
  id: string
  planId: string
  targetType: 'seat' | 'speaker'
  targetId: string
  content: string
  createdAt: string
}

export interface Plan {
  id: string
  name: string
  createdAt: string
  frequencyBand: string
  notes: Note[]
  snapshot: { seatId: string; splDB: number }[]
}

export type AnomalyType = 'frequency_mismatch' | 'seat_occlusion' | 'delay_inversion'

export interface Anomaly {
  id: string
  type: AnomalyType
  severity: 'warning' | 'error'
  message: string
  seatId?: string
  speakerId?: string
  frequencyBand: string
  dataSource: string
}

export type FrequencyBand =
  | '31.5Hz'
  | '63Hz'
  | '125Hz'
  | '250Hz'
  | '500Hz'
  | '1kHz'
  | '2kHz'
  | '4kHz'
  | '8kHz'
  | '16kHz'

export const FREQUENCY_BANDS: FrequencyBand[] = [
  '31.5Hz',
  '63Hz',
  '125Hz',
  '250Hz',
  '500Hz',
  '1kHz',
  '2kHz',
  '4kHz',
  '8kHz',
  '16kHz',
]

export type SelectedObject = { type: 'seat' | 'speaker'; id: string } | null
