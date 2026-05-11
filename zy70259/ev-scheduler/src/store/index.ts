import { create } from 'zustand'
import dayjs from 'dayjs'
import type { Vehicle, Consultant, ConsultantSchedule, Reservation, ChargeRecord, ReservationStatus } from '@/types'
import {
  getVehicles, saveVehicles,
  getConsultants, saveConsultants,
  getConsultantSchedules, saveConsultantSchedules,
  getReservations, saveReservations,
  getChargeRecords, saveChargeRecords,
  generateId,
} from '@/utils/storage'
import { checkReservationConflict, isDuplicateReservation, hasAnyConflict } from '@/utils/conflict'

interface StoreState {
  vehicles: Vehicle[]
  consultants: Consultant[]
  consultantSchedules: ConsultantSchedule[]
  reservations: Reservation[]
  chargeRecords: ChargeRecord[]
  initialized: boolean

  initialize: () => void

  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>) => Vehicle
  updateVehicle: (id: string, data: Partial<Vehicle>) => void
  deleteVehicle: (id: string) => void

  addConsultant: (consultant: Omit<Consultant, 'id' | 'createdAt' | 'updatedAt'>) => Consultant
  updateConsultant: (id: string, data: Partial<Consultant>) => void
  deleteConsultant: (id: string) => void

  addSchedule: (schedule: Omit<ConsultantSchedule, 'id' | 'createdAt' | 'updatedAt'>) => ConsultantSchedule
  updateSchedule: (id: string, data: Partial<ConsultantSchedule>) => void
  deleteSchedule: (id: string) => void

  createReservation: (
    data: Omit<Reservation, 'id' | 'status' | 'conflictInfo' | 'createdAt' | 'updatedAt'>
  ) => { reservation: Reservation | null; conflict: ReturnType<typeof checkReservationConflict>; duplicate: boolean }
  updateReservation: (id: string, data: Partial<Reservation>) => void
  updateReservationStatus: (id: string, status: ReservationStatus, notes?: string) => { success: boolean; conflict?: ReturnType<typeof checkReservationConflict> }
  rescheduleReservation: (
    id: string,
    newData: { date: string; startTime: string; endTime: string }
  ) => { success: boolean; conflict?: ReturnType<typeof checkReservationConflict> }
  deleteReservation: (id: string) => void

  startCharging: (vehicleId: string) => ChargeRecord | null
  endCharging: (vehicleId: string, endBattery: number) => void
  updateChargeStatus: (vehicleId: string, battery: number) => void

  importVehicles: (data: Partial<Vehicle>[]) => { success: number; failed: number; errors: string[] }
  importConsultants: (data: Partial<Consultant>[]) => { success: number; failed: number; errors: string[] }
}

export const useStore = create<StoreState>((set, get) => ({
  vehicles: [],
  consultants: [],
  consultantSchedules: [],
  reservations: [],
  chargeRecords: [],
  initialized: false,

  initialize: () => {
    set({
      vehicles: getVehicles(),
      consultants: getConsultants(),
      consultantSchedules: getConsultantSchedules(),
      reservations: getReservations(),
      chargeRecords: getChargeRecords(),
      initialized: true,
    })
  },

  addVehicle: (vehicle) => {
    const newVehicle: Vehicle = {
      ...vehicle,
      id: generateId(),
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
    }
    const vehicles = [...get().vehicles, newVehicle]
    set({ vehicles })
    saveVehicles(vehicles)
    return newVehicle
  },

  updateVehicle: (id, data) => {
    const vehicles = get().vehicles.map(v =>
      v.id === id ? { ...v, ...data, updatedAt: dayjs().toISOString() } : v
    )
    set({ vehicles })
    saveVehicles(vehicles)
  },

  deleteVehicle: (id) => {
    const vehicles = get().vehicles.filter(v => v.id !== id)
    set({ vehicles })
    saveVehicles(vehicles)
  },

  addConsultant: (consultant) => {
    const newConsultant: Consultant = {
      ...consultant,
      id: generateId(),
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
    }
    const consultants = [...get().consultants, newConsultant]
    set({ consultants })
    saveConsultants(consultants)
    return newConsultant
  },

  updateConsultant: (id, data) => {
    const consultants = get().consultants.map(c =>
      c.id === id ? { ...c, ...data, updatedAt: dayjs().toISOString() } : c
    )
    set({ consultants })
    saveConsultants(consultants)
  },

  deleteConsultant: (id) => {
    const consultants = get().consultants.filter(c => c.id !== id)
    set({ consultants })
    saveConsultants(consultants)
  },

  addSchedule: (schedule) => {
    const newSchedule: ConsultantSchedule = {
      ...schedule,
      id: generateId(),
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
    }
    const schedules = [...get().consultantSchedules, newSchedule]
    set({ consultantSchedules: schedules })
    saveConsultantSchedules(schedules)
    return newSchedule
  },

  updateSchedule: (id, data) => {
    const schedules = get().consultantSchedules.map(s =>
      s.id === id ? { ...s, ...data, updatedAt: dayjs().toISOString() } : s
    )
    set({ consultantSchedules: schedules })
    saveConsultantSchedules(schedules)
  },

  deleteSchedule: (id) => {
    const schedules = get().consultantSchedules.filter(s => s.id !== id)
    set({ consultantSchedules: schedules })
    saveConsultantSchedules(schedules)
  },

  createReservation: (data) => {
    const state = get()
    const duplicate = isDuplicateReservation(
      { customerPhone: data.customerPhone, date: data.date, startTime: data.startTime, endTime: data.endTime },
      state.reservations
    )
    if (duplicate) {
      return { reservation: null, conflict: { vehicleConflict: false, consultantConflict: false, chargeConflict: false, details: ['该客户在此时间段已有预约，请勿重复提交'] }, duplicate: true }
    }

    const conflict = checkReservationConflict({
      vehicleId: data.vehicleId,
      consultantId: data.consultantId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      existingReservations: state.reservations,
      vehicles: state.vehicles,
      consultants: state.consultants,
      schedules: state.consultantSchedules,
    })

    const newReservation: Reservation = {
      ...data,
      id: generateId(),
      status: hasAnyConflict(conflict) ? 'pending' : 'confirmed',
      conflictInfo: hasAnyConflict(conflict) ? conflict : undefined,
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
    }

    const reservations = [...state.reservations, newReservation]
    set({ reservations })
    saveReservations(reservations)

    return { reservation: newReservation, conflict, duplicate: false }
  },

  updateReservation: (id, data) => {
    const reservations = get().reservations.map(r =>
      r.id === id ? { ...r, ...data, updatedAt: dayjs().toISOString() } : r
    )
    set({ reservations })
    saveReservations(reservations)
  },

  updateReservationStatus: (id, status, notes) => {
    const state = get()
    const reservation = state.reservations.find(r => r.id === id)
    if (!reservation) return { success: false }

    if (status === 'confirmed' && reservation.conflictInfo) {
      const conflict = checkReservationConflict({
        vehicleId: reservation.vehicleId,
        consultantId: reservation.consultantId,
        date: reservation.date,
        startTime: reservation.startTime,
        endTime: reservation.endTime,
        existingReservations: state.reservations,
        vehicles: state.vehicles,
        consultants: state.consultants,
        schedules: state.consultantSchedules,
        excludeReservationId: id,
      })
      if (hasAnyConflict(conflict)) {
        return { success: false, conflict }
      }
    }

    const reservations = state.reservations.map(r => {
      if (r.id === id) {
        const updated: Partial<Reservation> = { status, updatedAt: dayjs().toISOString() }
        if (notes) updated.notes = notes
        if (status === 'confirmed') updated.conflictInfo = undefined
        if (status === 'completed') updated.completedAt = dayjs().toISOString()
        return { ...r, ...updated }
      }
      return r
    })
    set({ reservations })
    saveReservations(reservations)
    return { success: true }
  },

  rescheduleReservation: (id, newData) => {
    const state = get()
    const reservation = state.reservations.find(r => r.id === id)
    if (!reservation) return { success: false }

    const conflict = checkReservationConflict({
      vehicleId: reservation.vehicleId,
      consultantId: reservation.consultantId,
      date: newData.date,
      startTime: newData.startTime,
      endTime: newData.endTime,
      existingReservations: state.reservations,
      vehicles: state.vehicles,
      consultants: state.consultants,
      schedules: state.consultantSchedules,
      excludeReservationId: id,
    })

    const reservations = state.reservations.map(r => {
      if (r.id === id) {
        const newStatus: ReservationStatus = hasAnyConflict(conflict) ? 'pending' : 'confirmed'
        return {
          ...r,
          ...newData,
          status: newStatus,
          conflictInfo: hasAnyConflict(conflict) ? conflict : undefined,
          updatedAt: dayjs().toISOString(),
        }
      }
      return r
    })
    set({ reservations })
    saveReservations(reservations)

    return { success: !hasAnyConflict(conflict), conflict }
  },

  deleteReservation: (id) => {
    const reservations = get().reservations.filter(r => r.id !== id)
    set({ reservations })
    saveReservations(reservations)
  },

  startCharging: (vehicleId) => {
    const state = get()
    const vehicle = state.vehicles.find(v => v.id === vehicleId)
    if (!vehicle) return null

    const chargeRecord: ChargeRecord = {
      id: generateId(),
      vehicleId,
      startTime: dayjs().toISOString(),
      startBattery: vehicle.currentBattery,
      status: 'in_progress',
      createdAt: dayjs().toISOString(),
    }

    const chargeRecords = [...state.chargeRecords, chargeRecord]
    const vehicles = state.vehicles.map(v =>
      v.id === vehicleId
        ? {
            ...v,
            chargeStatus: 'charging' as const,
            chargeStartTime: dayjs().toISOString(),
            expectedChargeEndTime: dayjs().add(1, 'hour').format('HH:mm'),
            updatedAt: dayjs().toISOString(),
          }
        : v
    )

    set({ chargeRecords, vehicles })
    saveChargeRecords(chargeRecords)
    saveVehicles(vehicles)

    return chargeRecord
  },

  endCharging: (vehicleId, endBattery) => {
    const state = get()
    const chargeRecord = state.chargeRecords.find(
      r => r.vehicleId === vehicleId && r.status === 'in_progress'
    )
    if (!chargeRecord) return

    const chargeRecords = state.chargeRecords.map(r =>
      r.id === chargeRecord.id
        ? { ...r, endTime: dayjs().toISOString(), endBattery, status: 'completed' as const }
        : r
    )

    const vehicles = state.vehicles.map(v =>
      v.id === vehicleId
        ? {
            ...v,
            currentBattery: endBattery,
            chargeStatus: endBattery >= 80 ? 'fully_charged' as const : endBattery < 30 ? 'low_battery' as const : 'fully_charged' as const,
            chargeStartTime: undefined,
            expectedChargeEndTime: undefined,
            updatedAt: dayjs().toISOString(),
          }
        : v
    )

    set({ chargeRecords, vehicles })
    saveChargeRecords(chargeRecords)
    saveVehicles(vehicles)
  },

  updateChargeStatus: (vehicleId, battery) => {
    const state = get()
    const vehicles = state.vehicles.map(v =>
      v.id === vehicleId
        ? {
            ...v,
            currentBattery: battery,
            chargeStatus: battery < 30 ? 'low_battery' as const : 'fully_charged' as const,
            updatedAt: dayjs().toISOString(),
          }
        : v
    )
    set({ vehicles })
    saveVehicles(vehicles)
  },

  importVehicles: (data) => {
    const errors: string[] = []
    let success = 0
    let failed = 0

    data.forEach((item, index) => {
      if (!item.licensePlate || !item.model || !item.brand) {
        failed++
        errors.push(`第 ${index + 1} 行：缺少必要字段（车牌、车型、品牌）`)
        return
      }

      const exists = get().vehicles.some(v => v.licensePlate === item.licensePlate)
      if (exists) {
        failed++
        errors.push(`第 ${index + 1} 行：车牌 ${item.licensePlate} 已存在`)
        return
      }

      get().addVehicle({
        licensePlate: item.licensePlate!,
        model: item.model!,
        brand: item.brand!,
        batteryCapacity: item.batteryCapacity ?? 100,
        currentBattery: item.currentBattery ?? 100,
        chargeStatus: item.chargeStatus ?? 'fully_charged',
        mileage: item.mileage ?? 0,
        isAvailable: item.isAvailable ?? true,
      })
      success++
    })

    return { success, failed, errors }
  },

  importConsultants: (data) => {
    const errors: string[] = []
    let success = 0
    let failed = 0

    data.forEach((item, index) => {
      if (!item.name || !item.phone) {
        failed++
        errors.push(`第 ${index + 1} 行：缺少必要字段（姓名、电话）`)
        return
      }

      const exists = get().consultants.some(c => c.phone === item.phone)
      if (exists) {
        failed++
        errors.push(`第 ${index + 1} 行：电话 ${item.phone} 已存在`)
        return
      }

      get().addConsultant({
        name: item.name!,
        phone: item.phone!,
        specialty: item.specialty ?? '',
        isActive: item.isActive ?? true,
      })
      success++
    })

    return { success, failed, errors }
  },
}))
