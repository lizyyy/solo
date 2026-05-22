import { createMachine, createActor } from 'xstate';
import { BatchStatus } from '../../shared/types.js';

export type BatchEvent =
  | { type: 'SUBMIT' }
  | { type: 'WITHDRAW' }
  | { type: 'RECEIPT' }
  | { type: 'REVIEW_APPROVE' }
  | { type: 'REVIEW_REJECT' }
  | { type: 'FREEZE' }
  | { type: 'UNFREEZE' }
  | { type: 'SETTLE' }
  | { type: 'ARCHIVE' }
  | { type: 'RESUBMIT' };

export const batchStateMachine = createMachine({
  id: 'batch',
  initial: BatchStatus.PENDING_SUBMIT,
  context: {
    batchId: '',
    previousStatus: undefined as BatchStatus | undefined
  },
  states: {
    [BatchStatus.PENDING_SUBMIT]: {
      on: {
        SUBMIT: BatchStatus.PROCESSING,
        WITHDRAW: BatchStatus.WITHDRAWN
      }
    },
    [BatchStatus.PROCESSING]: {
      on: {
        RECEIPT: BatchStatus.PENDING_REVIEW,
        WITHDRAW: BatchStatus.WITHDRAWN
      }
    },
    [BatchStatus.PENDING_REVIEW]: {
      on: {
        REVIEW_APPROVE: BatchStatus.REVIEW_APPROVED,
        REVIEW_REJECT: BatchStatus.REVIEW_REJECTED
      }
    },
    [BatchStatus.REVIEW_APPROVED]: {
      on: {
        FREEZE: BatchStatus.FROZEN
      }
    },
    [BatchStatus.REVIEW_REJECTED]: {
      on: {
        RECEIPT: BatchStatus.PENDING_REVIEW
      }
    },
    [BatchStatus.FROZEN]: {
      on: {
        UNFREEZE: BatchStatus.REVIEW_APPROVED,
        SETTLE: BatchStatus.SETTLED
      }
    },
    [BatchStatus.SETTLED]: {
      on: {
        ARCHIVE: BatchStatus.ARCHIVED
      }
    },
    [BatchStatus.WITHDRAWN]: {
      on: {
        RESUBMIT: BatchStatus.PROCESSING
      }
    },
    [BatchStatus.ARCHIVED]: {
      type: 'final'
    }
  }
});

export function canTransition(from: BatchStatus, event: BatchEvent['type']): boolean {
  const actor = createActor(batchStateMachine);
  actor.start();
  const snapshot = actor.getSnapshot();
  
  if (snapshot.value !== from) {
    actor.stop();
    return false;
  }
  
  try {
    actor.send({ type: event } as BatchEvent);
    const nextStatus = actor.getSnapshot().value as BatchStatus;
    actor.stop();
    return nextStatus !== from;
  } catch {
    actor.stop();
    return false;
  }
}

export function getNextStatus(from: BatchStatus, event: BatchEvent['type']): BatchStatus | null {
  const actor = createActor(batchStateMachine);
  actor.start();
  const snapshot = actor.getSnapshot();
  
  if (snapshot.value !== from) {
    actor.stop();
    return null;
  }
  
  try {
    actor.send({ type: event } as BatchEvent);
    const nextStatus = actor.getSnapshot().value as BatchStatus;
    actor.stop();
    return nextStatus !== from ? nextStatus : null;
  } catch {
    actor.stop();
    return null;
  }
}

export function getValidTransitions(status: BatchStatus): string[] {
  const stateConfig = batchStateMachine.states[status];
  if (!stateConfig || !stateConfig.on) return [];
  return Object.keys(stateConfig.on);
}
