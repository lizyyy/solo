export const SettlementBatchStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUSPENDED: 'SUSPENDED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAID: 'PAID',
} as const;

export type SettlementBatchStatus = typeof SettlementBatchStatus[keyof typeof SettlementBatchStatus];

export const SuspendReason = {
  REFUND: 'REFUND',
  CHARGEBACK: 'CHARGEBACK',
  FEE_ADJUSTMENT: 'FEE_ADJUSTMENT',
  BANK_ERROR: 'BANK_ERROR',
  MANUAL: 'MANUAL',
  OTHER: 'OTHER',
} as const;

export type SuspendReason = typeof SuspendReason[keyof typeof SuspendReason];

export const ExceptionType = {
  REFUND_PENDING: 'REFUND_PENDING',
  CHARGEBACK_PENDING: 'CHARGEBACK_PENDING',
  FEE_MISMATCH: 'FEE_MISMATCH',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
  BATCH_VALIDATION_FAILED: 'BATCH_VALIDATION_FAILED',
  DUPLICATE_OPERATION: 'DUPLICATE_OPERATION',
  RULE_VIOLATION: 'RULE_VIOLATION',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ExceptionType = typeof ExceptionType[keyof typeof ExceptionType];

export const ApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type ApprovalStatus = typeof ApprovalStatus[keyof typeof ApprovalStatus];

export const FeeType = {
  FIXED: 'FIXED',
  PERCENTAGE: 'PERCENTAGE',
  TIERED: 'TIERED',
} as const;

export type FeeType = typeof FeeType[keyof typeof FeeType];

export const ALL_SUSPEND_REASONS = Object.values(SuspendReason);
export const ALL_SETTLEMENT_BATCH_STATUSES = Object.values(SettlementBatchStatus);
