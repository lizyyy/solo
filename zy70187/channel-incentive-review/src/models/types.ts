export enum ChannelIncentiveStatus {
  INITIAL = 'INITIAL',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  VERIFIED = 'VERIFIED',
  DISPUTED = 'DISPUTED',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAYOUT_SCHEDULED = 'PAYOUT_SCHEDULED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED'
}

export enum DisputeReason {
  TARGET_SNAPSHOT_DISAGREEMENT = 'TARGET_SNAPSHOT_DISAGREEMENT',
  ACHIEVEMENT_CRITERIA_DISAGREEMENT = 'ACHIEVEMENT_CRITERIA_DISAGREEMENT',
  PROTECTION_PERIOD_DISAGREEMENT = 'PROTECTION_PERIOD_DISAGREEMENT',
  CROSS_REGION_ASSIGNMENT_DISAGREEMENT = 'CROSS_REGION_ASSIGNMENT_DISAGREEMENT',
  TIER_CALCULATION_DISAGREEMENT = 'TIER_CALCULATION_DISAGREEMENT',
  OTHER = 'OTHER'
}

export enum IncentiveTier {
  TIER_1 = 'TIER_1',
  TIER_2 = 'TIER_2',
  TIER_3 = 'TIER_3',
  TIER_4 = 'TIER_4'
}

export enum Quarter {
  Q1 = 'Q1',
  Q2 = 'Q2',
  Q3 = 'Q3',
  Q4 = 'Q4'
}

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface OperatorInfo {
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  timestamp: Date;
}

export interface StatusChangeLog {
  fromStatus: ChannelIncentiveStatus | null;
  toStatus: ChannelIncentiveStatus;
  operator: OperatorInfo;
  reason: string;
  timestamp: Date;
}
