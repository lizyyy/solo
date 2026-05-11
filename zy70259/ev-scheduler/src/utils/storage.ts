import type { Vehicle, Consultant, ConsultantSchedule, Reservation, ChargeRecord } from '@/types'

const STORAGE_KEYS = {
  VEHICLES: 'ev_scheduler_vehicles',
  CONSULTANTS: 'ev_scheduler_consultants',
  CONSULTANT_SCHEDULES: 'ev_scheduler_consultant_schedules',
  RESERVATIONS: 'ev_scheduler_reservations',
  CHARGE_RECORDS: 'ev_scheduler_charge_records',
}

function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key)
    if (item) {
      return JSON.parse(item)
    }
    return defaultValue
  } catch {
    return defaultValue
  }
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save to localStorage:', e)
  }
}

export function getVehicles(): Vehicle[] {
  return getFromStorage<Vehicle[]>(STORAGE_KEYS.VEHICLES, [])
}

export function saveVehicles(vehicles: Vehicle[]): void {
  saveToStorage(STORAGE_KEYS.VEHICLES, vehicles)
}

export function getConsultants(): Consultant[] {
  return getFromStorage<Consultant[]>(STORAGE_KEYS.CONSULTANTS, [])
}

export function saveConsultants(consultants: Consultant[]): void {
  saveToStorage(STORAGE_KEYS.CONSULTANTS, consultants)
}

export function getConsultantSchedules(): ConsultantSchedule[] {
  return getFromStorage<ConsultantSchedule[]>(STORAGE_KEYS.CONSULTANT_SCHEDULES, [])
}

export function saveConsultantSchedules(schedules: ConsultantSchedule[]): void {
  saveToStorage(STORAGE_KEYS.CONSULTANT_SCHEDULES, schedules)
}

export function getReservations(): Reservation[] {
  return getFromStorage<Reservation[]>(STORAGE_KEYS.RESERVATIONS, [])
}

export function saveReservations(reservations: Reservation[]): void {
  saveToStorage(STORAGE_KEYS.RESERVATIONS, reservations)
}

export function getChargeRecords(): ChargeRecord[] {
  return getFromStorage<ChargeRecord[]>(STORAGE_KEYS.CHARGE_RECORDS, [])
}

export function saveChargeRecords(records: ChargeRecord[]): void {
  saveToStorage(STORAGE_KEYS.CHARGE_RECORDS, records)
}

export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
