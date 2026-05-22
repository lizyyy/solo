import { LedgerStatus, Role, DataSource } from '@prisma/client'

export interface CreateLedgerDto {
  boxNo: string
  batchNo: string
  driverId: string
  driverName: string
  driverPhone: string
  receiveDate: Date
  crossDaySign?: boolean
  boxNameChange?: boolean
  originalBoxNo?: string
  temperatureMin?: number
  temperatureMax?: number
  compensationAmount?: number
  source: DataSource
  createdBy: string
}

export interface UpdateLedgerDto {
  boxNo?: string
  batchNo?: string
  driverId?: string
  driverName?: string
  driverPhone?: string
  receiveDate?: Date
  crossDaySign?: boolean
  boxNameChange?: boolean
  originalBoxNo?: string
  temperatureMin?: number
  temperatureMax?: number
  compensationAmount?: number
  changeReason: string
}

export interface StatusTransitionDto {
  ledgerId: string
  changedBy: string
  changeReason: string
  rejectionReason?: string
}

export interface AddScanDetailDto {
  scanTime: Date
  scanLocation: string
  operator: string
  temperature?: number
  boxCondition?: string
  remark?: string
}

export interface LedgerFilters {
  status?: LedgerStatus
  batchNo?: string
  startDate?: Date
  endDate?: Date
  driverId?: string
}

export const sensitiveFields = ['driverPhone'] as const

export type SensitiveField = typeof sensitiveFields[number]

export const rolePermissions: Record<Role, LedgerStatus[]> = {
  [Role.WAREHOUSE_STAFF]: [LedgerStatus.DRAFT, LedgerStatus.SUBMITTED],
  [Role.DRIVER]: [LedgerStatus.DRAFT],
  [Role.SUPERVISOR]: [LedgerStatus.SUBMITTED, LedgerStatus.REJECTED, LedgerStatus.CONFIRMED],
  [Role.AUDITOR]: [LedgerStatus.CONFIRMED, LedgerStatus.AUDITED],
  [Role.ADMIN]: Object.values(LedgerStatus)
}

export const stateTransitions: Record<LedgerStatus, LedgerStatus[]> = {
  [LedgerStatus.DRAFT]: [LedgerStatus.SUBMITTED],
  [LedgerStatus.SUBMITTED]: [LedgerStatus.REJECTED, LedgerStatus.CONFIRMED],
  [LedgerStatus.REJECTED]: [LedgerStatus.DRAFT, LedgerStatus.SUBMITTED],
  [LedgerStatus.CONFIRMED]: [LedgerStatus.REJECTED, LedgerStatus.AUDITED],
  [LedgerStatus.AUDITED]: [LedgerStatus.ARCHIVED],
  [LedgerStatus.ARCHIVED]: []
}
