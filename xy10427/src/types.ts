export type ShiftType = 'day' | 'night';
export type AbnormalType = 'duplicate_swipe' | 'non_workday' | 'exceed_limit' | 'shift_ambiguous';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type SubsidyStatus = 'normal' | 'suspended' | 'adjusted';

export interface Employee {
  employeeId: string;
  name: string;
  department: string;
}

export interface Shift {
  employeeId: string;
  date: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  isWorkDay: boolean;
}

export interface Consumption {
  transactionId: string;
  employeeId: string;
  swipeTime: string;
  amount: number;
  merchant: string;
}

export interface SubsidyRule {
  ruleId: string;
  name: string;
  dayShiftAmount: number;
  nightShiftAmount: number;
  dailyLimit: number;
  mealTimes: {
    breakfast?: { start: string; end: string };
    lunch?: { start: string; end: string };
    dinner?: { start: string; end: string };
    nightMeal?: { start: string; end: string };
  };
  nonWorkDayAllowed: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface AbnormalRecord {
  abnormalId: string;
  employeeId: string;
  transactionId?: string;
  type: AbnormalType;
  description: string;
  detectedAt: string;
}

export interface SubsidyCalculation {
  calculationId: string;
  employeeId: string;
  date: string;
  originalAmount: number;
  adjustedAmount: number;
  status: SubsidyStatus;
  abnormalIds: string[];
  approvalStatus: ApprovalStatus;
  calculatedAt: string;
}

export interface ApprovalRecord {
  approvalId: string;
  calculationId: string;
  employeeId: string;
  operator: string;
  action: 'approve' | 'reject' | 'adjust';
  newAmount?: number;
  reason: string;
  createdAt: string;
}

export interface CalculationBatch {
  batchId: string;
  periodStart: string;
  periodEnd: string;
  ruleId: string;
  status: 'calculating' | 'completed' | 'regenerating';
  createdAt: string;
  completedAt?: string;
}
