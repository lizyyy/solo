import { RefundReviewStatus, ReviewConclusion } from '../types';

export const StateTransitionRules: Record<RefundReviewStatus, RefundReviewStatus[]> = {
  [RefundReviewStatus.PENDING_REFUND]: [
    RefundReviewStatus.INTERCEPTING,
    RefundReviewStatus.APPROVED
  ],
  [RefundReviewStatus.INTERCEPTING]: [
    RefundReviewStatus.APPROVED,
    RefundReviewStatus.REJECTED,
    RefundReviewStatus.PENDING_REFUND
  ],
  [RefundReviewStatus.APPROVED]: [],
  [RefundReviewStatus.REJECTED]: []
};

export const ConclusionToStatusMap: Record<ReviewConclusion, RefundReviewStatus> = {
  [ReviewConclusion.MANUAL_APPROVE]: RefundReviewStatus.APPROVED,
  [ReviewConclusion.MANUAL_REJECT]: RefundReviewStatus.REJECTED,
  [ReviewConclusion.AUTO_APPROVE]: RefundReviewStatus.APPROVED,
  [ReviewConclusion.AUTO_REJECT]: RefundReviewStatus.REJECTED
};

export function isValidStatusTransition(
  currentStatus: RefundReviewStatus,
  targetStatus: RefundReviewStatus
): boolean {
  const allowedTransitions = StateTransitionRules[currentStatus];
  return allowedTransitions.includes(targetStatus);
}

export function canBeReviewed(status: RefundReviewStatus): boolean {
  return status === RefundReviewStatus.INTERCEPTING || status === RefundReviewStatus.PENDING_REFUND;
}

export function isFinalStatus(status: RefundReviewStatus): boolean {
  return status === RefundReviewStatus.APPROVED || status === RefundReviewStatus.REJECTED;
}
