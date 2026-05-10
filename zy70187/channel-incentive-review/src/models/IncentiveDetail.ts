import { BaseEntity, Quarter, IncentiveTier, ChannelIncentiveStatus, StatusChangeLog } from './types';
import { AchievementRecord } from './AchievementRecord';
import { ProtectionPeriod } from './ProtectionPeriod';
import { CrossRegionAssignment } from './CrossRegionAssignment';

export interface IncentiveDetail extends BaseEntity {
  channelId: string;
  channelName: string;
  
  year: number;
  quarter: Quarter;
  
  achievementRecordId: string;
  achievementRecord?: AchievementRecord;
  
  protectionPeriodId: string | null;
  protectionPeriod?: ProtectionPeriod;
  
  crossRegionAssignmentId: string | null;
  crossRegionAssignment?: CrossRegionAssignment;
  
  baseIncentiveAmount: number;
  tierIncentiveAmount: number;
  protectionAdjustmentAmount: number;
  crossRegionSplitAmount: number;
  deductionAmount: number;
  finalIncentiveAmount: number;
  
  tier: IncentiveTier;
  incentiveRate: number;
  
  calculationDetails: IncentiveCalculationDetails;
  
  paymentStatus: PaymentStatus;
  scheduledPaymentDate: Date | null;
  actualPaymentDate: Date | null;
  paymentReference: string | null;
  
  currentStatus: ChannelIncentiveStatus;
  statusHistory: StatusChangeLog[];
  
  isManualAdjustment: boolean;
  manualAdjustmentReason: string | null;
  adjustedBy: string | null;
  
  notes: string;
}

export enum PaymentStatus {
  NOT_SCHEDULED = 'NOT_SCHEDULED',
  SCHEDULED = 'SCHEDULED',
  IN_PROCESS = 'IN_PROCESS',
  PAID = 'PAID',
  DELAYED = 'DELAYED',
  CANCELLED = 'CANCELLED'
}

export interface IncentiveCalculationDetails {
  baseCalculation: BaseCalculation;
  tierCalculation: TierCalculation;
  protectionAdjustment: ProtectionAdjustment | null;
  crossRegionAdjustment: CrossRegionAdjustment | null;
  deductions: DeductionItem[];
  finalCalculation: FinalCalculation;
}

export interface BaseCalculation {
  achievementAmount: number;
  baseRate: number;
  baseAmount: number;
  formula: string;
}

export interface TierCalculation {
  achievedTier: IncentiveTier;
  tierRate: number;
  tierMultiplier: number;
  tierAmount: number;
  formula: string;
  protectionApplied: boolean;
  protectionTier: IncentiveTier | null;
}

export interface ProtectionAdjustment {
  protectionType: string;
  adjustmentType: AdjustmentType;
  adjustmentAmount: number;
  reason: string;
}

export interface CrossRegionAdjustment {
  assignmentType: string;
  splitPercentage: number;
  adjustmentAmount: number;
  reason: string;
}

export enum AdjustmentType {
  ADDITION = 'ADDITION',
  DEDUCTION = 'DEDUCTION'
}

export interface DeductionItem {
  deductionType: string;
  deductionAmount: number;
  deductionReason: string;
  referenceId: string | null;
}

export interface FinalCalculation {
  grossAmount: number;
  totalAdjustments: number;
  netAmount: number;
  formula: string;
}
