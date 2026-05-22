export enum ReceiptStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FROZEN = 'frozen',
  SETTLED = 'settled',
  ARCHIVED = 'archived',
  CANCELLED = 'cancelled'
}

export enum RecordStatus {
  UNPROCESSED = 'unprocessed',
  CORRECTED = 'corrected',
  NEEDS_MANUAL_CONFIRM = 'needs_manual_confirm',
  PROCESSED = 'processed'
}

export enum ActionType {
  CREATE_BATCH = 'create_batch',
  UPLOAD_ATTACHMENT = 'upload_attachment',
  REVIEW_DECISION = 'review_decision',
  FREEZE_SETTLEMENT = 'freeze_settlement',
  UNFREEZE_SETTLEMENT = 'unfreeze_settlement',
  CANCEL = 'cancel',
  ARCHIVE = 'archive',
  UPDATE = 'update',
  CORRECT = 'correct'
}

export const StatusTransitionRules: Record<ReceiptStatus, ReceiptStatus[]> = {
  [ReceiptStatus.DRAFT]: [ReceiptStatus.PENDING_REVIEW, ReceiptStatus.CANCELLED],
  [ReceiptStatus.PENDING_REVIEW]: [ReceiptStatus.APPROVED, ReceiptStatus.REJECTED, ReceiptStatus.DRAFT],
  [ReceiptStatus.APPROVED]: [ReceiptStatus.FROZEN, ReceiptStatus.SETTLED, ReceiptStatus.ARCHIVED],
  [ReceiptStatus.REJECTED]: [ReceiptStatus.DRAFT, ReceiptStatus.ARCHIVED],
  [ReceiptStatus.FROZEN]: [ReceiptStatus.APPROVED, ReceiptStatus.SETTLED],
  [ReceiptStatus.SETTLED]: [ReceiptStatus.ARCHIVED],
  [ReceiptStatus.ARCHIVED]: [],
  [ReceiptStatus.CANCELLED]: [ReceiptStatus.DRAFT]
};
