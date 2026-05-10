import { BatchStatus, InspectionType } from './types';
import { InvalidStateTransitionError, DuplicateSubmissionError } from './errors';
import { Batch } from './models';

export const INSPECTION_OPERATIONS: Record<string, string> = {
  TEMPERATURE: '验温',
  WEIGHT: '验重',
  TICKET: '验票'
};

export const STATE_NAMES: Record<BatchStatus, string> = {
  [BatchStatus.PENDING]: '待验收',
  [BatchStatus.TEMPERATURE_CHECKED]: '验温完成',
  [BatchStatus.WEIGHT_CHECKED]: '验重完成',
  [BatchStatus.TICKET_CHECKED]: '验票完成',
  [BatchStatus.ACCEPTED]: '已验收',
  [BatchStatus.PARTIALLY_ACCEPTED]: '部分验收',
  [BatchStatus.REJECTED]: '已拒收',
  [BatchStatus.REPLENISHED]: '已补货'
};

export interface StateTransition {
  from: BatchStatus;
  to: BatchStatus;
  allowed: boolean;
  reason?: string;
}

export const ALLOWED_TRANSITIONS: Map<BatchStatus, BatchStatus[]> = new Map([
  [BatchStatus.PENDING, [
    BatchStatus.TEMPERATURE_CHECKED,
    BatchStatus.REJECTED
  ]],
  [BatchStatus.TEMPERATURE_CHECKED, [
    BatchStatus.WEIGHT_CHECKED,
    BatchStatus.REJECTED
  ]],
  [BatchStatus.WEIGHT_CHECKED, [
    BatchStatus.TICKET_CHECKED,
    BatchStatus.REJECTED
  ]],
  [BatchStatus.TICKET_CHECKED, [
    BatchStatus.ACCEPTED,
    BatchStatus.PARTIALLY_ACCEPTED,
    BatchStatus.REJECTED
  ]],
  [BatchStatus.REJECTED, [
    BatchStatus.REPLENISHED
  ]],
  [BatchStatus.REPLENISHED, [
    BatchStatus.TEMPERATURE_CHECKED,
    BatchStatus.WEIGHT_CHECKED,
    BatchStatus.TICKET_CHECKED,
    BatchStatus.ACCEPTED
  ]],
  [BatchStatus.ACCEPTED, []],
  [BatchStatus.PARTIALLY_ACCEPTED, []]
]);

export function canTransition(from: BatchStatus, to: BatchStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS.get(from);
  if (!allowed) {
    return false;
  }
  return allowed.includes(to);
}

export function validateTransition(from: BatchStatus, to: BatchStatus): void {
  if (!canTransition(from, to)) {
    const allowed = ALLOWED_TRANSITIONS.get(from) || [];
    throw new InvalidStateTransitionError(
      STATE_NAMES[from],
      STATE_NAMES[to],
      allowed.map(s => STATE_NAMES[s])
    );
  }
}

export function checkDuplicateSubmission(
  batch: Batch,
  inspectionType: InspectionType
): void {
  switch (inspectionType) {
    case InspectionType.TEMPERATURE:
      if (batch.status === BatchStatus.TEMPERATURE_CHECKED ||
          batch.status === BatchStatus.WEIGHT_CHECKED ||
          batch.status === BatchStatus.TICKET_CHECKED ||
          batch.status === BatchStatus.ACCEPTED ||
          batch.status === BatchStatus.PARTIALLY_ACCEPTED) {
        throw new DuplicateSubmissionError(INSPECTION_OPERATIONS.TEMPERATURE, batch.id);
      }
      break;
    case InspectionType.WEIGHT:
      if (batch.status === BatchStatus.WEIGHT_CHECKED ||
          batch.status === BatchStatus.TICKET_CHECKED ||
          batch.status === BatchStatus.ACCEPTED ||
          batch.status === BatchStatus.PARTIALLY_ACCEPTED) {
        throw new DuplicateSubmissionError(INSPECTION_OPERATIONS.WEIGHT, batch.id);
      }
      break;
    case InspectionType.TICKET:
      if (batch.status === BatchStatus.TICKET_CHECKED ||
          batch.status === BatchStatus.ACCEPTED ||
          batch.status === BatchStatus.PARTIALLY_ACCEPTED) {
        throw new DuplicateSubmissionError(INSPECTION_OPERATIONS.TICKET, batch.id);
      }
      break;
  }
}

export function isTerminalStatus(status: BatchStatus): boolean {
  return [
    BatchStatus.ACCEPTED,
    BatchStatus.PARTIALLY_ACCEPTED,
    BatchStatus.REJECTED
  ].includes(status);
}

export function getAllowedTargetStates(current: BatchStatus): BatchStatus[] {
  return ALLOWED_TRANSITIONS.get(current) || [];
}

export function getNextRequiredState(current: BatchStatus): BatchStatus | null {
  const flow: BatchStatus[] = [
    BatchStatus.PENDING,
    BatchStatus.TEMPERATURE_CHECKED,
    BatchStatus.WEIGHT_CHECKED,
    BatchStatus.TICKET_CHECKED,
    BatchStatus.ACCEPTED
  ];
  const currentIndex = flow.indexOf(current);
  if (currentIndex === -1 || currentIndex === flow.length - 1) {
    return null;
  }
  return flow[currentIndex + 1];
}
