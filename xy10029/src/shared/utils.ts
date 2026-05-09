import {
  Device,
  DeviceHistory,
  DeviceStatus,
  ChangeType,
  SystemLog,
  LogLevel,
  FailedOperation,
  RetryStatus
} from './types'
import { v4 as uuidv4 } from 'uuid'

export function generateId(): string {
  return uuidv4()
}

export function getCurrentTimestamp(): string {
  return new Date().toISOString()
}

export function formatDate(date: Date): string {
  return date.toISOString()
}

export function parseDate(dateString: string): Date {
  return new Date(dateString)
}

export function isValidDeviceTransition(
  currentStatus: DeviceStatus,
  nextStatus: DeviceStatus,
  transitions: Record<DeviceStatus, DeviceStatus[]>
): boolean {
  return transitions[currentStatus]?.includes(nextStatus) || false
}

export function createDeviceHistory(
  device: Device,
  changeType: ChangeType,
  userId: string,
  userName: string,
  description: string,
  version: number
): DeviceHistory {
  return {
    id: generateId(),
    deviceId: device.id,
    version,
    snapshot: JSON.stringify(device),
    changedAt: getCurrentTimestamp(),
    changedBy: userId,
    changedByName: userName,
    changeType,
    description
  }
}

export function createSystemLog(
  level: LogLevel,
  module: string,
  action: string,
  userId: string | null,
  userName: string | null,
  details: string,
  success: boolean,
  errorMessage: string | null = null,
  duration: number = 0
): SystemLog {
  return {
    id: generateId(),
    level,
    module,
    action,
    userId,
    userName,
    details,
    success,
    errorMessage,
    duration,
    timestamp: getCurrentTimestamp()
  }
}

export function createFailedOperation(
  operationType: string,
  details: string,
  errorMessage: string,
  maxRetries: number = 3
): FailedOperation {
  const now = getCurrentTimestamp()
  return {
    id: generateId(),
    operationType,
    details,
    errorMessage,
    retryCount: 0,
    maxRetries,
    status: RetryStatus.PENDING,
    lastAttemptAt: now,
    nextRetryAt: calculateNextRetry(0, now),
    createdAt: now
  }
}

export function calculateNextRetry(
  retryCount: number,
  lastAttemptAt: string
): string {
  const baseDelay = 5000
  const delay = baseDelay * Math.pow(2, retryCount)
  const lastAttempt = parseDate(lastAttemptAt)
  return formatDate(new Date(lastAttempt.getTime() + delay))
}

export function serializeSnapshot<T>(data: T): string {
  return JSON.stringify(data, null, 2)
}

export function deserializeSnapshot<T>(snapshot: string): T {
  return JSON.parse(snapshot) as T
}

export function maskPassword(password: string): string {
  return '*'.repeat(password.length)
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}
