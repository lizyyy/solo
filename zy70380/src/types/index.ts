export interface Member {
  id: string;
  name: string;
  phone: string;
  points: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  memberId: string;
  amount: number;
  category: string;
  createdAt: string;
}

export interface PointRuleVersion {
  id: string;
  version: string;
  name: string;
  description: string;
  rules: CategoryRule[];
  effectiveAt: string;
  isFrozen: boolean;
  createdAt: string;
}

export interface CategoryRule {
  category: string;
  multiplier: number;
}

export interface PointLog {
  id: string;
  memberId: string;
  amount: number;
  type: 'earn' | 'spend' | 'compensation' | 'adjustment';
  transactionId?: string;
  redemptionId?: string;
  recalculationTaskId?: string;
  description: string;
  createdAt: string;
}

export interface Redemption {
  id: string;
  memberId: string;
  points: number;
  giftName: string;
  giftId: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface RecalculationTask {
  id: string;
  name: string;
  description: string;
  ruleVersionId: string;
  memberIds?: string[];
  startTime?: string;
  endTime?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalMembers: number;
  processedMembers: number;
  progress: number;
  summary?: RecalculationSummary;
  createdAt: string;
  completedAt?: string;
}

export interface RecalculationSummary {
  totalOriginalPoints: number;
  totalNewPoints: number;
  totalDifference: number;
  lockedPoints: number;
  pendingAdjustment: number;
  membersWithPositiveDiff: number;
  membersWithNegativeDiff: number;
  membersWithLockedPoints: number;
}

export interface MemberRecalculationResult {
  taskId: string;
  memberId: string;
  originalPoints: number;
  newPoints: number;
  difference: number;
  lockedPoints: number;
  netDifference: number;
  status: 'pending_review' | 'ready' | 'completed';
  detailSources: RecalculationDetailSource[];
  createdAt: string;
}

export interface RecalculationDetailSource {
  transactionId: string;
  originalPoints: number;
  newPoints: number;
  difference: number;
  category: string;
  originalMultiplier: number;
  newMultiplier: number;
}

export interface CompensationAdjustment {
  id: string;
  taskId: string;
  memberId: string;
  amount: number;
  type: 'credit' | 'debit';
  status: 'pending_review' | 'approved' | 'rejected';
  pointLogId?: string;
  reason: string;
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
}
