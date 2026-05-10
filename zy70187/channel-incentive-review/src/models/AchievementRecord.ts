import { BaseEntity, Quarter, IncentiveTier, ChannelIncentiveStatus, StatusChangeLog } from './types';
import { TargetSnapshot } from './TargetSnapshot';

export interface AchievementRecord extends BaseEntity {
  channelId: string;
  channelName: string;
  
  year: number;
  quarter: Quarter;
  
  targetSnapshotId: string;
  targetSnapshot?: TargetSnapshot;
  
  achievementAmount: number;
  achievementRate: number;
  
  isAchieved: boolean;
  achievedTier: IncentiveTier | null;
  tierCalculationDetails: TierCalculationDetails;
  
  verificationStatus: VerificationStatus;
  verificationMethod: VerificationMethod | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  
  achievementSources: AchievementSource[];
  exclusionReasons: string[];
  
  currentStatus: ChannelIncentiveStatus;
  statusHistory: StatusChangeLog[];
  
  notes: string;
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  AUTO_VERIFIED = 'AUTO_VERIFIED',
  MANUALLY_VERIFIED = 'MANUALLY_VERIFIED',
  REJECTED = 'REJECTED'
}

export enum VerificationMethod {
  DATA_MATCH = 'DATA_MATCH',
  FORMULA_CALCULATION = 'FORMULA_CALCULATION',
  EXTERNAL_SYSTEM = 'EXTERNAL_SYSTEM',
  MANUAL_INPUT = 'MANUAL_INPUT'
}

export interface TierCalculationDetails {
  baseAmount: number;
  applicableTier: IncentiveTier;
  tierThreshold: number;
  achievementAgainstThreshold: number;
  calculationFormula: string;
  calculationBreakdown: CalculationBreakdownItem[];
  finalAmount: number;
}

export interface CalculationBreakdownItem {
  itemName: string;
  itemValue: number;
  itemDescription: string;
}

export interface AchievementSource {
  sourceSystem: string;
  sourceType: SourceType;
  sourceAmount: number;
  sourceDate: Date;
  sourceReference: string;
  verificationStatus: SourceVerificationStatus;
}

export enum SourceType {
  SALES_RECORD = 'SALES_RECORD',
  CUSTOMER_ACTIVATION = 'CUSTOMER_ACTIVATION',
  REVENUE_RECOGNITION = 'REVENUE_RECOGNITION',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT'
}

export enum SourceVerificationStatus {
  VERIFIED = 'VERIFIED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  DISPUTED = 'DISPUTED'
}
