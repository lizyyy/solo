export interface MeterReading {
  id: string;
  meterId: string;
  zoneId: string;
  timestamp: Date;
  reading: number;
  consumption: number;
  isPeak: boolean;
  sourceFile: string;
}

export interface TenantContract {
  id: string;
  tenantId: string;
  tenantName: string;
  zoneIds: string[];
  startDate: Date;
  endDate: Date;
  baseMultiplier: number;
  overtimeMultiplier: number;
  ratePerKwh: number;
  baseRent: number;
  overtimeHours: {
    date: Date;
    hours: number;
    reason: string;
  }[];
  status: 'active' | 'terminated' | 'pending';
}

export interface TemperatureZone {
  id: string;
  name: string;
  type: 'frozen' | 'chilled' | 'ambient';
  targetTemp: number;
  multiplier: number;
  tenantId?: string;
  isVacant: boolean;
  vacantStartDate?: Date;
}

export interface MultiplierChange {
  id: string;
  zoneId: string;
  effectiveDate: Date;
  oldMultiplier: number;
  newMultiplier: number;
  reason: string;
}

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  NEEDS_MORE_INFO = 'needs_more_info'
}

export interface BillingRecord {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  tenantId: string;
  tenantName: string;
  zoneId: string;
  zoneName: string;
  baseConsumption: number;
  overtimeConsumption: number;
  totalConsumption: number;
  baseMultiplier: number;
  overtimeMultiplier: number;
  appliedMultiplier: number;
  ratePerKwh: number;
  electricityCost: number;
  baseRent: number;
  overtimeSurcharge: number;
  totalAmount: number;
  anomalies: Anomaly[];
  reviewStatus: ReviewStatus;
  reviewNotes: ReviewNote[];
  calculationDetails: CalculationDetail[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Anomaly {
  id: string;
  type: 'multiplier_change' | 'vacant_period' | 'spike' | 'contract_mismatch' | 'overtime';
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
  description: string;
  explanation: string;
  affectedAmount: number;
  resolved: boolean;
  resolution?: string;
}

export interface ReviewNote {
  id: string;
  userId: string;
  userName: string;
  timestamp: Date;
  action: 'approve' | 'reject' | 'request_info' | 'modify' | 'comment';
  comment: string;
  changes?: Record<string, { old: any; new: any }>;
}

export interface CalculationDetail {
  step: string;
  description: string;
  formula: string;
  inputs: Record<string, any>;
  result: number;
}

export interface BillingSummary {
  periodStart: Date;
  periodEnd: Date;
  totalTenants: number;
  totalConsumption: number;
  totalElectricityCost: number;
  totalBaseRent: number;
  totalOvertimeSurcharge: number;
  grandTotal: number;
  recordsByStatus: Record<ReviewStatus, number>;
  anomalyCount: number;
}
