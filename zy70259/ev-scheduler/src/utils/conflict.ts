import type { Vehicle, Consultant, ConsultantSchedule, Reservation, ReservationConflict } from '@/types'

interface CheckConflictParams {
  vehicleId: string
  consultantId: string
  date: string
  startTime: string
  endTime: string
  existingReservations: Reservation[]
  vehicles: Vehicle[]
  consultants: Consultant[]
  schedules: ConsultantSchedule[]
  excludeReservationId?: string
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function timeRangesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = timeToMinutes(start1)
  const e1 = timeToMinutes(end1)
  const s2 = timeToMinutes(start2)
  const e2 = timeToMinutes(end2)
  return s1 < e2 && s2 < e1
}

export function checkReservationConflict(params: CheckConflictParams): ReservationConflict {
  const {
    vehicleId,
    consultantId,
    date,
    startTime,
    endTime,
    existingReservations,
    vehicles,
    consultants,
    schedules,
    excludeReservationId,
  } = params

  const conflict: ReservationConflict = {
    vehicleConflict: false,
    consultantConflict: false,
    chargeConflict: false,
    details: [],
  }

  const vehicle = vehicles.find(v => v.id === vehicleId)
  const consultant = consultants.find(c => c.id === consultantId)

  if (!vehicle) {
    conflict.details.push('选择的试驾车不存在')
    return conflict
  }

  if (!consultant) {
    conflict.details.push('选择的销售顾问不存在')
    return conflict
  }

  const relevantReservations = existingReservations.filter(
    r => r.id !== excludeReservationId &&
      r.date === date &&
      r.status !== 'cancelled' &&
      r.status !== 'completed'
  )

  const vehicleConflictReservations = relevantReservations.filter(
    r => r.vehicleId === vehicleId && timeRangesOverlap(r.startTime, r.endTime, startTime, endTime)
  )
  if (vehicleConflictReservations.length > 0) {
    conflict.vehicleConflict = true
    conflict.details.push(
      `车辆 ${vehicle.licensePlate} 在 ${vehicleConflictReservations.map(r => `${r.startTime}-${r.endTime}`).join('、')} 已有预约`
    )
  }

  const consultantConflictReservations = relevantReservations.filter(
    r => r.consultantId === consultantId && timeRangesOverlap(r.startTime, r.endTime, startTime, endTime)
  )
  if (consultantConflictReservations.length > 0) {
    conflict.consultantConflict = true
    conflict.details.push(
      `顾问 ${consultant.name} 在 ${consultantConflictReservations.map(r => `${r.startTime}-${r.endTime}`).join('、')} 已有预约`
    )
  }

  const consultantSchedule = schedules.find(
    s => s.consultantId === consultantId && s.date === date
  )
  if (consultantSchedule) {
    if (consultantSchedule.type !== 'working') {
      conflict.consultantConflict = true
      conflict.details.push(
        `顾问 ${consultant.name} 在 ${date} 安排了${consultantSchedule.type === 'leave' ? '请假' : consultantSchedule.type === 'meeting' ? '会议' : '培训'}`
      )
    } else if (!timeRangesOverlap(startTime, endTime, consultantSchedule.startTime, consultantSchedule.endTime)) {
      conflict.consultantConflict = true
      conflict.details.push(
        `顾问 ${consultant.name} 工作时间为 ${consultantSchedule.startTime}-${consultantSchedule.endTime}，预约时间超出范围`
      )
    }
  }

  if (vehicle.chargeStatus === 'charging' && vehicle.expectedChargeEndTime) {
    const chargeEnd = vehicle.expectedChargeEndTime
    if (timeToMinutes(startTime) < timeToMinutes(chargeEnd)) {
      conflict.chargeConflict = true
      conflict.details.push(
        `车辆 ${vehicle.licensePlate} 正在充电，预计 ${chargeEnd} 完成充电`
      )
    }
  }

  if (vehicle.chargeStatus === 'low_battery') {
    conflict.chargeConflict = true
    conflict.details.push(
      `车辆 ${vehicle.licensePlate} 电量过低（${vehicle.currentBattery}%），请先充电后再预约`
    )
  }

  if (vehicle.chargeStatus === 'out_of_service') {
    conflict.chargeConflict = true
    conflict.details.push(
      `车辆 ${vehicle.licensePlate} 目前处于停用状态`
    )
  }

  return conflict
}

export function hasAnyConflict(conflict: ReservationConflict): boolean {
  return conflict.vehicleConflict || conflict.consultantConflict || conflict.chargeConflict
}

export function isDuplicateReservation(
  params: {
    customerPhone: string
    date: string
    startTime: string
    endTime: string
  },
  existingReservations: Reservation[]
): boolean {
  return existingReservations.some(
    r =>
      r.customerPhone === params.customerPhone &&
      r.date === params.date &&
      timeRangesOverlap(r.startTime, r.endTime, params.startTime, params.endTime) &&
      r.status !== 'cancelled'
  )
}

export function getAvailableTimeSlots(
  vehicleId: string,
  consultantId: string,
  date: string,
  existingReservations: Reservation[],
  schedules: ConsultantSchedule[]
): Array<{ start: string; end: string; available: boolean }> {
  const consultantSchedule = schedules.find(
    s => s.consultantId === consultantId && s.date === date
  )

  const slots: Array<{ start: string; end: string }> = []
  let hour = 9
  while (hour < 18) {
    const start = `${hour.toString().padStart(2, '0')}:00`
    const end = `${(hour + 1).toString().padStart(2, '0')}:00`
    slots.push({ start, end })
    hour++
  }

  return slots.map(slot => {
    let available = true
    if (consultantSchedule) {
      available = consultantSchedule.type === 'working' &&
        timeRangesOverlap(slot.start, slot.end, consultantSchedule.startTime, consultantSchedule.endTime)
    }
    if (available) {
      const conflict = existingReservations.some(
        r =>
          r.date === date &&
          r.status !== 'cancelled' &&
          r.status !== 'completed' &&
          (r.vehicleId === vehicleId || r.consultantId === consultantId) &&
          timeRangesOverlap(r.startTime, r.endTime, slot.start, slot.end)
      )
      available = !conflict
    }
    return { ...slot, available }
  })
}
