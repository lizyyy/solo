import { LedgerStatus } from '@prisma/client'
import { stateTransitions } from '../types'

export class StateMachineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StateMachineError'
  }
}

export function canTransition(from: LedgerStatus, to: LedgerStatus): boolean {
  const allowedTransitions = stateTransitions[from]
  return allowedTransitions.includes(to)
}

export function validateTransition(from: LedgerStatus, to: LedgerStatus): void {
  if (!canTransition(from, to)) {
    throw new StateMachineError(
      `状态转换不允许: ${from} -> ${to}. 允许的转换: ${stateTransitions[from].join(', ')}`
    )
  }
}

export function getNextStates(current: LedgerStatus): LedgerStatus[] {
  return stateTransitions[current]
}

export function isEditable(status: LedgerStatus): boolean {
  return status === LedgerStatus.DRAFT || status === LedgerStatus.REJECTED
}

export function isReadOnly(status: LedgerStatus): boolean {
  return (
    status === LedgerStatus.AUDITED ||
    status === LedgerStatus.ARCHIVED
  )
}

export function isPendingReview(status: LedgerStatus): boolean {
  return status === LedgerStatus.SUBMITTED
}
