export interface Horse {
  id: string
  horseNumber: string
  horseName: string
  breed: string
  gender: string
  birthDate: string
  owner: string
  rider: string
  microchipId?: string
  notes?: string
}

export interface VetRecord {
  id: string
  horseNumber: string
  horseName: string
  treatmentDate: string
  diagnosis: string
  treatment: string
  vetName: string
  restPeriodDays: number
  recoveryDate: string
  isCleared: boolean
  notes?: string
}

export interface ShoeingRecord {
  id: string
  horseNumber: string
  horseName: string
  shoeingDate: string
  farrierName: string
  frontLeft: string
  frontRight: string
  hindLeft: string
  hindRight: string
  nextDueDate: string
  notes?: string
}

export interface TackItem {
  id: string
  tackNumber: string
  tackType: 'saddle' | 'bridle' | 'girth' | 'pad' | 'other'
  brand: string
  model: string
  size: string
  sizeUnit: string
  purchaseDate: string
  lastInspectionDate: string
  condition: 'excellent' | 'good' | 'fair' | 'needs_repair' | 'retired'
  assignedHorseNumber?: string
  assignedHorseName?: string
  notes?: string
}

export interface RaceEntry {
  id: string
  raceNumber: string
  raceName: string
  startTime: string
  endTime: string
  location: string
  weatherCondition?: string
  temperature?: number
  humidity?: number
  horseNumber: string
  horseName: string
  rider: string
  category: string
  class: string
  notes?: string
}

export type RiskType =
  | 'rest_period_not_expired'
  | 'duplicate_race_entry'
  | 'shoeing_overdue'
  | 'tack_size_mismatch'
  | 'high_temperature_risk'

export interface Risk {
  id: string
  sessionId: string
  horseNumber: string
  horseName: string
  type: RiskType
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  detectedAt: string
  raceNumber?: string
  raceName?: string
  tackNumber?: string
  data?: Record<string, unknown>
}

export interface ReviewRecord {
  id: string
  sessionId: string
  riskId: string
  riskType: RiskType
  horseNumber: string
  horseName: string
  originalAssessment: 'violation' | 'warning'
  coachJudgment: 'confirmed' | 'overruled' | 'pending'
  coachNotes: string
  actionTaken: string
  reviewedAt: string
  reviewedBy: string
}

export interface Session {
  id: string
  date: string
  name: string
  eventName: string
  location: string
  createdAt: string
  updatedAt: string
  status: 'importing' | 'checking' | 'reviewing' | 'exported'
}

export interface ImportLog {
  id: string
  sessionId: string
  type: 'horses' | 'vet_records' | 'shoeing' | 'tack' | 'race_schedule'
  fileName: string
  recordCount: number
  importedAt: string
  errors: string[]
  warnings: string[]
}

export interface AppSettings {
  defaultRestPeriodDays: number
  shoeingIntervalDays: number
  highTemperatureThreshold: number
  sizeTolerance: number
  reviewRequired: boolean
}

export const defaultSettings: AppSettings = {
  defaultRestPeriodDays: 14,
  shoeingIntervalDays: 42,
  highTemperatureThreshold: 35,
  sizeTolerance: 2,
  reviewRequired: true,
}
