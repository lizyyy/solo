export enum RefundStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
  RETRYING = 'retrying',
}

export const RefundStatusTransitions: Record<RefundStatus, RefundStatus[]> = {
  [RefundStatus.DRAFT]: [RefundStatus.PENDING, RefundStatus.CANCELLED],
  [RefundStatus.PENDING]: [RefundStatus.PROCESSING, RefundStatus.REJECTED, RefundStatus.CANCELLED],
  [RefundStatus.PROCESSING]: [RefundStatus.SUCCESS, RefundStatus.FAILED, RefundStatus.RETRYING],
  [RefundStatus.SUCCESS]: [],
  [RefundStatus.FAILED]: [RefundStatus.RETRYING, RefundStatus.CANCELLED],
  [RefundStatus.CANCELLED]: [],
  [RefundStatus.REJECTED]: [],
  [RefundStatus.RETRYING]: [RefundStatus.PROCESSING, RefundStatus.FAILED],
};
