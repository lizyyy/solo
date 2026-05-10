import { BaseEntity, ChannelIncentiveStatus, DisputeReason, StatusChangeLog, OperatorInfo } from './types';

export interface Dispute extends BaseEntity {
  achievementRecordId: string;
  
  disputeType: DisputeType;
  disputeReason: DisputeReason;
  disputeDetails: DisputeDetails;
  
  raisedBy: OperatorInfo;
  raisedAt: Date;
  
  currentStatus: DisputeStatus;
  statusHistory: DisputeStatusChangeLog[];
  
  assignedTo: string | null;
  assignedAt: Date | null;
  
  evidence: DisputeEvidence[];
  comments: DisputeComment[];
  
  resolution: DisputeResolution | null;
  resolvedAt: Date | null;
  resolvedBy: OperatorInfo | null;
  
  relatedIncentiveStatusChange: ChannelIncentiveStatus | null;
}

export enum DisputeType {
  TARGET_SNAPSHOT = 'TARGET_SNAPSHOT',
  ACHIEVEMENT_AMOUNT = 'ACHIEVEMENT_AMOUNT',
  PROTECTION_PERIOD = 'PROTECTION_PERIOD',
  CROSS_REGION_ASSIGNMENT = 'CROSS_REGION_ASSIGNMENT',
  TIER_CALCULATION = 'TIER_CALCULATION',
  INCENTIVE_AMOUNT = 'INCENTIVE_AMOUNT'
}

export enum DisputeStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  AWAITING_EVIDENCE = 'AWAITING_EVIDENCE',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED'
}

export interface DisputeDetails {
  description: string;
  expectedOutcome: string;
  affectedItems: DisputeAffectedItem[];
}

export interface DisputeAffectedItem {
  itemType: string;
  itemId: string;
  itemDescription: string;
  currentValue: string;
  expectedValue: string;
}

export interface DisputeEvidence {
  evidenceType: EvidenceType;
  evidenceTitle: string;
  evidenceDescription: string;
  evidenceUrl: string;
  uploadedBy: OperatorInfo;
  uploadedAt: Date;
}

export enum EvidenceType {
  DOCUMENT = 'DOCUMENT',
  SCREENSHOT = 'SCREENSHOT',
  EMAIL = 'EMAIL',
  SYSTEM_RECORD = 'SYSTEM_RECORD',
  OTHER = 'OTHER'
}

export interface DisputeComment {
  comment: string;
  author: OperatorInfo;
  timestamp: Date;
  isInternal: boolean;
}

export interface DisputeResolution {
  resolutionType: ResolutionType;
  resolutionDetails: string;
  impact: ResolutionImpact;
}

export enum ResolutionType {
  UPHELD = 'UPHELD',
  PARTIALLY_UPHELD = 'PARTIALLY_UPHELD',
  REJECTED = 'REJECTED'
}

export interface ResolutionImpact {
  statusChange: boolean;
  newStatus: ChannelIncentiveStatus | null;
  amountAdjustment: number;
  tierAdjustment: string | null;
  notes: string;
}

export interface DisputeStatusChangeLog {
  fromStatus: DisputeStatus | null;
  toStatus: DisputeStatus;
  operator: OperatorInfo;
  reason: string;
  timestamp: Date;
}
