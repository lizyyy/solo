import { BaseEntity, Quarter } from './types';

export interface ProtectionPeriod extends BaseEntity {
  channelId: string;
  channelName: string;
  
  year: number;
  quarter: Quarter;
  
  protectionType: ProtectionType;
  protectionReason: ProtectionReason;
  
  effectiveStartDate: Date;
  effectiveEndDate: Date;
  
  protectionTerms: ProtectionTerms;
  
  isActive: boolean;
  isApproved: boolean;
  approvedBy: string | null;
  approvedAt: Date | null;
  
  achievementRecordId: string | null;
  relatedDisputeId: string | null;
  
  notes: string;
}

export enum ProtectionType {
  TIER_PROTECTION = 'TIER_PROTECTION',
  THRESHOLD_PROTECTION = 'THRESHOLD_PROTECTION',
  RATE_PROTECTION = 'RATE_PROTECTION',
  FULL_INCENTIVE_PROTECTION = 'FULL_INCENTIVE_PROTECTION'
}

export enum ProtectionReason {
  PREVIOUS_QUARTER_ACHIEVEMENT = 'PREVIOUS_QUARTER_ACHIEVEMENT',
  SPECIAL_AGREEMENT = 'SPECIAL_AGREEMENT',
  MARKET_CONDITION = 'MARKET_CONDITION',
  NEW_CHANNEL = 'NEW_CHANNEL',
  STRATEGIC_IMPORTANCE = 'STRATEGIC_IMPORTANCE'
}

export interface ProtectionTerms {
  protectedTier: string | null;
  protectedThreshold: number | null;
  protectedRate: number | null;
  protectedAmount: number | null;
  applicationRules: ApplicationRule[];
}

export interface ApplicationRule {
  ruleName: string;
  ruleCondition: string;
  ruleAction: string;
  isActive: boolean;
}
