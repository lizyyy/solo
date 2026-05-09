export type ListVersionStatus = 'active' | 'archived';
export type HitStatus = 'pending_review' | 'review_approved' | 'review_rejected' | 'pending_unfreeze' | 'unfreeze_approved' | 'unfreeze_rejected' | 'closed';
export type FreezeStatus = 'frozen' | 'unfrozen';
export type ReviewDecision = 'approved' | 'rejected';
export type AuditActionType = 'list_version_created' | 'list_version_archived' | 'hit_recorded' | 'hit_reviewed' | 'freeze_created' | 'unfreeze_requested' | 'unfreeze_approved' | 'unfreeze_rejected' | 'freeze_lifted';

export interface ListVersion {
  id: string;
  name: string;
  description: string;
  version: string;
  status: ListVersionStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface HitRecord {
  id: string;
  listVersionId: string;
  accountId: string;
  transactionId: string;
  matchReason: string;
  matchScore: number;
  status: HitStatus;
  currentBlock: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountFreeze {
  id: string;
  hitRecordId: string;
  accountId: string;
  freezeReason: string;
  status: FreezeStatus;
  unfreezeRequestedBy: string | null;
  unfreezeRequestedAt: string | null;
  unfreezeReason: string | null;
  unfrozenBy: string | null;
  unfrozenAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewRecord {
  id: string;
  hitRecordId: string;
  decision: ReviewDecision;
  reviewer: string;
  comment: string;
  previousStatus: HitStatus;
  createdAt: string;
}

export interface ApprovalRecord {
  id: string;
  accountFreezeId: string;
  hitRecordId: string;
  decision: ReviewDecision;
  approver: string;
  comment: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actionType: AuditActionType;
  entityType: 'list_version' | 'hit_record' | 'account_freeze';
  entityId: string;
  actor: string;
  details: string;
  timestamp: string;
}
