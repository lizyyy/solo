import { BaseEntity, Quarter, IncentiveTier } from './types';

export interface TargetSnapshot extends BaseEntity {
  channelId: string;
  channelName: string;
  regionId: string;
  regionName: string;
  
  year: number;
  quarter: Quarter;
  
  targetType: TargetType;
  targetAmount: number;
  targetUnit: TargetUnit;
  
  tierConfig: TierConfig[];
  
  effectiveDate: Date;
  snapshotSource: string;
  snapshotNotes: string;
  isFinalized: boolean;
}

export enum TargetType {
  REVENUE = 'REVENUE',
  VOLUME = 'VOLUME',
  NEW_CUSTOMERS = 'NEW_CUSTOMERS',
  COMPOSITE = 'COMPOSITE'
}

export enum TargetUnit {
  CURRENCY = 'CURRENCY',
  UNITS = 'UNITS',
  COUNT = 'COUNT',
  PERCENTAGE = 'PERCENTAGE'
}

export interface TierConfig {
  tier: IncentiveTier;
  minThreshold: number;
  maxThreshold: number;
  incentiveRate: number;
  incentiveAmount: number;
  description: string;
}
