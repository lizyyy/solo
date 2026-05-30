export interface LeaseContract {
  id: string;
  contractNo: string;
  customerName: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  interestRate: number;
  leaseTerm: number;
  paymentFrequency: 'monthly' | 'quarterly' | 'yearly';
  status: 'active' | 'completed' | 'terminated';
  createdAt: string;
}

export interface RentPlanItem {
  id: string;
  periodNo: number;
  dueDate: string;
  principal: number;
  interest: number;
  totalAmount: number;
  status: 'pending' | 'paid' | 'overdue' | 'adjusted';
  paidAmount?: number;
  paidDate?: string;
}

export interface RentPlan {
  id: string;
  contractId: string;
  version: number;
  items: RentPlanItem[];
  createdAt: string;
  createdBy: string;
  isActive: boolean;
}

export interface PaymentFlow {
  id: string;
  contractId: string;
  paymentDate: string;
  amount: number;
  paymentType: 'normal' | 'prepayment' | 'overdue';
  remark?: string;
  matchedPeriods?: string[];
  createdAt: string;
}

export interface Invoice {
  id: string;
  contractId: string;
  invoiceNo: string;
  invoiceDate: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  status: 'issued' | 'received' | 'voided';
  periodNos?: number[];
  createdAt: string;
}

export interface GracePeriod {
  id: string;
  contractId: string;
  periodNos: number[];
  graceDays: number;
  newDueDate: string;
  reason: string;
  approvedBy: string;
  approvedAt: string;
}

export interface Prepayment {
  id: string;
  contractId: string;
  prepaymentDate: string;
  amount: number;
  principalOffset: number;
  interestOffset: number;
  penaltyOffset: number;
  appliedPeriods: number[];
  status: 'pending' | 'applied' | 'partially_applied';
  remark?: string;
}

export interface RescheduleRequest {
  id?: string;
  contractId: string;
  requestType: 'grace' | 'prepayment' | 'both' | 'other';
  gracePeriods?: number[];
  graceDays?: number;
  prepaymentAmount?: number;
  prepaymentDate?: string;
  reason: string;
  requestedBy: string;
  requestedAt: string;
}

export interface RescheduleResult {
  id: string;
  contractId: string;
  requestId: string;
  status: 'draft' | 'processed' | 'reviewed' | 'approved' | 'rejected';
  originalPlan: RentPlan;
  newPlan: RentPlan;
  adjustments: AdjustmentRecord[];
  calculationDetails: CalculationDetail[];
  inconsistencies: InconsistencyRecord[];
  eventTimeline: EventTimelineItem[];
  processedBy?: string;
  processedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComments?: string;
}

export interface AdjustmentRecord {
  id: string;
  type: 'grace' | 'prepayment' | 'invoice_delay' | 'other';
  periodNo: number;
  field: 'dueDate' | 'principal' | 'interest' | 'totalAmount' | 'status';
  oldValue: string | number;
  newValue: string | number;
  reason: string;
  timestamp: string;
}

export interface CalculationDetail {
  id: string;
  step: string;
  description: string;
  formula: string;
  inputs: Record<string, number>;
  result: number;
  timestamp: string;
}

export interface InconsistencyRecord {
  id: string;
  type: 'contract_plan_mismatch' | 'prepayment_missing_offset' | 'grace_overlap' | 'invoice_delay';
  severity: 'high' | 'medium' | 'low';
  description: string;
  evidence: {
    source: string;
    data: any;
  }[];
  resolved: boolean;
  resolution?: string;
}

export interface EventTimelineItem {
  id: string;
  timestamp: string;
  eventType: 'grace_applied' | 'prepayment_applied' | 'invoice_issued' | 'plan_version_created' | 'payment_received';
  description: string;
  details: any;
  sequence: number;
}

export interface ExportData {
  contract: LeaseContract;
  rescheduleResult: RescheduleResult;
  paymentFlows: PaymentFlow[];
  invoices: Invoice[];
  exportedAt: string;
  exportedBy: string;
}
