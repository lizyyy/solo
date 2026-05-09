import { RefundStatus, RejectStage } from '../types';

export interface TransitionRule {
  from: RefundStatus[];
  to: RefundStatus;
  condition?: () => boolean;
  stageWhenRejected?: RejectStage;
}

export const REFUND_STATUS_TRANSITIONS: Record<RefundStatus, TransitionRule[]> = {
  [RefundStatus.PENDING]: [
    {
      from: [RefundStatus.PENDING],
      to: RefundStatus.CALCULATED,
      stageWhenRejected: RejectStage.CALCULATION,
    },
    {
      from: [RefundStatus.PENDING],
      to: RefundStatus.REJECTED,
      stageWhenRejected: RejectStage.VALIDATION,
    },
  ],
  [RefundStatus.CALCULATED]: [
    {
      from: [RefundStatus.CALCULATED],
      to: RefundStatus.APPROVED,
      stageWhenRejected: RejectStage.APPROVAL,
    },
    {
      from: [RefundStatus.CALCULATED],
      to: RefundStatus.REJECTED,
      stageWhenRejected: RejectStage.CALCULATION,
    },
  ],
  [RefundStatus.APPROVED]: [
    {
      from: [RefundStatus.APPROVED],
      to: RefundStatus.CALLBACK_SENT,
      stageWhenRejected: RejectStage.CALLBACK,
    },
    {
      from: [RefundStatus.APPROVED],
      to: RefundStatus.REJECTED,
      stageWhenRejected: RejectStage.APPROVAL,
    },
  ],
  [RefundStatus.CALLBACK_SENT]: [
    {
      from: [RefundStatus.CALLBACK_SENT],
      to: RefundStatus.RECONCILED,
      stageWhenRejected: RejectStage.RECONCILIATION,
    },
    {
      from: [RefundStatus.CALLBACK_SENT],
      to: RefundStatus.REJECTED,
      stageWhenRejected: RejectStage.CALLBACK,
    },
  ],
  [RefundStatus.RECONCILED]: [
    {
      from: [RefundStatus.RECONCILED],
      to: RefundStatus.COMPLETED,
      stageWhenRejected: RejectStage.RECONCILIATION,
    },
    {
      from: [RefundStatus.RECONCILED],
      to: RefundStatus.REJECTED,
      stageWhenRejected: RejectStage.RECONCILIATION,
    },
  ],
  [RefundStatus.COMPLETED]: [],
  [RefundStatus.REJECTED]: [],
};

export class StateTransitionService {
  canTransition(
    currentStatus: RefundStatus,
    targetStatus: RefundStatus
  ): { allowed: boolean; stageWhenRejected?: RejectStage; reason?: string } {
    const transitions = REFUND_STATUS_TRANSITIONS[currentStatus] || [];
    const matchingTransition = transitions.find(t => t.to === targetStatus);

    if (!matchingTransition) {
      return {
        allowed: false,
        reason: `无法从 ${currentStatus} 转换到 ${targetStatus}`,
      };
    }

    if (matchingTransition.condition && !matchingTransition.condition()) {
      return {
        allowed: false,
        reason: '转换条件不满足',
      };
    }

    return {
      allowed: true,
      stageWhenRejected: matchingTransition.stageWhenRejected,
    };
  }

  isTerminalStatus(status: RefundStatus): boolean {
    return status === RefundStatus.COMPLETED || status === RefundStatus.REJECTED;
  }

  isSameOrEarlierStatus(current: RefundStatus, target: RefundStatus): boolean {
    const order: RefundStatus[] = [
      RefundStatus.PENDING,
      RefundStatus.CALCULATED,
      RefundStatus.APPROVED,
      RefundStatus.CALLBACK_SENT,
      RefundStatus.RECONCILED,
      RefundStatus.COMPLETED,
    ];

    const currentIndex = order.indexOf(current);
    const targetIndex = order.indexOf(target);

    return targetIndex <= currentIndex;
  }

  getRejectStageForTransition(
    fromStatus: RefundStatus,
    toStatus: RefundStatus
  ): RejectStage | null {
    const transitions = REFUND_STATUS_TRANSITIONS[fromStatus] || [];
    const matchingTransition = transitions.find(t => t.to === toStatus);
    return matchingTransition?.stageWhenRejected || null;
  }

  getNextPossibleStatuses(currentStatus: RefundStatus): RefundStatus[] {
    const transitions = REFUND_STATUS_TRANSITIONS[currentStatus] || [];
    return transitions.map(t => t.to);
  }
}
