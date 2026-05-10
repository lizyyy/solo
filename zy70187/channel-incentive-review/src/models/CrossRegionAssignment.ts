import { BaseEntity, Quarter } from './types';

export interface CrossRegionAssignment extends BaseEntity {
  achievementRecordId: string;
  
  originalChannelId: string;
  originalChannelName: string;
  originalRegionId: string;
  originalRegionName: string;
  
  assignedChannelId: string;
  assignedChannelName: string;
  assignedRegionId: string;
  assignedRegionName: string;
  
  assignmentType: AssignmentType;
  assignmentReason: AssignmentReason;
  
  year: number;
  quarter: Quarter;
  
  splitPercentage: number;
  splitAmount: number;
  
  assignmentDate: Date;
  effectiveDate: Date;
  
  isApproved: boolean;
  approvalStatus: AssignmentApprovalStatus;
  approvedBy: string | null;
  approvedAt: Date | null;
  
  isDisputed: boolean;
  disputeId: string | null;
  
  notes: string;
}

export enum AssignmentType {
  FULL_TRANSFER = 'FULL_TRANSFER',
  PARTIAL_SPLIT = 'PARTIAL_SPLIT',
  SHARED_CREDIT = 'SHARED_CREDIT'
}

export enum AssignmentReason {
  CUSTOMER_MIGRATION = 'CUSTOMER_MIGRATION',
  TERRITORY_REORGANIZATION = 'TERRITORY_REORGANIZATION',
  COLLABORATIVE_SALE = 'COLLABORATIVE_SALE',
  CHANNEL_TRANSFER = 'CHANNEL_TRANSFER',
  OTHER = 'OTHER'
}

export enum AssignmentApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}
