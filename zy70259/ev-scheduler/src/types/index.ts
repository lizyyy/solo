export type ChargeStatus = 'charging' | 'fully_charged' | 'low_battery' | 'out_of_service'
export type ReservationStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled'

export interface Vehicle {
  id: string
  licensePlate: string
  model: string
  brand: string
  batteryCapacity: number
  currentBattery: number
  chargeStatus: ChargeStatus
  chargeStartTime?: string
  expectedChargeEndTime?: string
  mileage: number
  isAvailable: boolean
  createdAt: string
  updatedAt: string
}

export interface Consultant {
  id: string
  name: string
  phone: string
  specialty: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ConsultantSchedule {
  id: string
  consultantId: string
  date: string
  startTime: string
  endTime: string
  type: 'working' | 'leave' | 'meeting' | 'training'
  description?: string
  createdAt: string
  updatedAt: string
}

export interface Reservation {
  id: string
  customerName: string
  customerPhone: string
  vehicleId: string
  consultantId: string
  date: string
  startTime: string
  endTime: string
  testDriveRoute: string
  status: ReservationStatus
  source: string
  notes?: string
  conflictInfo?: ReservationConflict
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface ReservationConflict {
  vehicleConflict: boolean
  consultantConflict: boolean
  chargeConflict: boolean
  details: string[]
}

export interface ChargeRecord {
  id: string
  vehicleId: string
  startTime: string
  endTime?: string
  startBattery: number
  endBattery?: number
  status: 'in_progress' | 'completed' | 'interrupted'
  createdAt: string
}
