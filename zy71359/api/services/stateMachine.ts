const WORK_TRANSITIONS: Record<string, string[]> = {
  pending: ['queued', 'cancelled'],
  queued: ['pending', 'rescheduled', 'firing', 'cancelled'],
  firing: ['completed', 'cancelled'],
  rescheduled: ['pending', 'cancelled'],
  completed: [],
  cancelled: [],
}

const BATCH_TRANSITIONS: Record<string, string[]> = {
  open: ['locked'],
  locked: ['open', 'firing'],
  firing: ['completed'],
  completed: [],
}

export function canTransitionWork(from: string, to: string): boolean {
  return WORK_TRANSITIONS[from]?.includes(to) ?? false
}

export function canTransitionBatch(from: string, to: string): boolean {
  return BATCH_TRANSITIONS[from]?.includes(to) ?? false
}

export function transitionWork(currentStatus: string, targetStatus: string): string {
  if (!canTransitionWork(currentStatus, targetStatus)) {
    throw new Error(`不允许从 "${currentStatus}" 转换到 "${targetStatus}"`)
  }
  return targetStatus
}

export function transitionBatch(currentStatus: string, targetStatus: string): string {
  if (!canTransitionBatch(currentStatus, targetStatus)) {
    throw new Error(`不允许从 "${currentStatus}" 转换到 "${targetStatus}"`)
  }
  return targetStatus
}
