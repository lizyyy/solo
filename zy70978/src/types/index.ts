export type OrderStatus = 'pending' | 'approved' | 'rejected' | 'need_more_info';
export type DiscrepancyType = 'overdue_rent' | 'repair_responsibility' | 'duplicate_deduction' | 'deposit_mismatch' | 'other';
export type RepairLiability = 'tenant' | 'owner' | 'natural_wear' | 'pending';

export interface RentalOrder {
  id: string;
  orderNo: string;
  tenantName: string;
  tenantId: string;
  equipmentSerialNo: string;
  equipmentName: string;
  startDate: string;
  endDate: string;
  actualReturnDate?: string;
  monthlyRent: number;
  depositAmount: number;
  actualDepositPaid: number;
  status: OrderStatus;
  createdAt: string;
  notes?: string;
}

export interface RepairRecord {
  id: string;
  repairNo: string;
  equipmentSerialNo: string;
  reportDate: string;
  repairDate: string;
  repairContent: string;
  repairCost: number;
  liability: RepairLiability;
  reporter: string;
  isBoundToOrder: boolean;
  boundOrderNo?: string;
  notes?: string;
}

export interface DepositRule {
  id: string;
  ruleName: string;
  equipmentType: string;
  depositRate: number;
  minDeposit: number;
  maxDeposit: number;
  isActive: boolean;
  overduePenaltyRate: number;
  overdueGraceDays: number;
}

export interface Discrepancy {
  id: string;
  type: DiscrepancyType;
  orderNo: string;
  equipmentSerialNo?: string;
  description: string;
  detail: string;
  expectedAmount: number;
  actualAmount: number;
  difference: number;
  sourceRecords: string[];
  status: 'open' | 'resolved' | 'pending_review';
  resolution?: string;
  createdAt: string;
}

export interface ReviewRecord {
  id: string;
  orderNo: string;
  reviewer: string;
  reviewDate: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  comments: string;
  modifiedFields: string[];
}

export interface ReconciliationResult {
  orderNo: string;
  equipmentSerialNo: string;
  tenantName: string;
  summary: {
    totalRent: number;
    overdueRent: number;
    totalRepairCost: number;
    tenantLiabilityRepairCost: number;
    totalDeductions: number;
    depositRefund: number;
  };
  discrepancies: Discrepancy[];
  breakdown: {
    rentDetails: RentDetail[];
    repairDetails: RepairDetail[];
    deductionDetails: DeductionDetail[];
  };
  status: OrderStatus;
  reviewRecords: ReviewRecord[];
  lastUpdated: string;
}

export interface RentDetail {
  period: string;
  startDate: string;
  endDate: string;
  days: number;
  amount: number;
  isOverdue: boolean;
  explanation: string;
}

export interface RepairDetail {
  repairNo: string;
  repairDate: string;
  content: string;
  cost: number;
  liability: RepairLiability;
  boundToSerialNo: string;
  explanation: string;
}

export interface DeductionDetail {
  type: 'overdue' | 'repair' | 'other';
  amount: number;
  source: string;
  basis: string;
  evidence: string[];
}

export interface ImportSummary {
  totalRecords: number;
  successful: number;
  failed: number;
  errors: { row: number; message: string }[];
}
