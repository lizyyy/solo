export type LeaseStatus = 'leasing' | 'renewal_pending' | 'renewed' | 'pending_return';

export type ConflictType = 'auto_vs_manual_renewal' | 'payment_overdue' | 'invalid_renewal_rule' | 'asset_unavailable';

export type ConflictStatus = 'detected' | 'pending_resolution' | 'resolved';

export type PaymentStatus = 'paid' | 'pending' | 'overdue';

export type HistoryActionType = 
  | 'lease_created'
  | 'auto_renewal_triggered'
  | 'manual_renewal_submitted'
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'status_changed'
  | 'remark_added'
  | 'import_completed'
  | 'import_failed'
  | 'exported';

export type ErrorCategory = 'data_integrity' | 'business_rule' | 'human_intervention' | 'system_error';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export interface LeaseAsset {
  id: string;
  name: string;
  assetNo: string;
  type: string;
}

export interface RenewalRule {
  id: string;
  name: string;
  autoRenewalDays: number;
  newLeaseTerm: number;
  priceAdjustment: number;
  isActive: boolean;
}

export interface RenewalConflict {
  id: string;
  type: ConflictType;
  status: ConflictStatus;
  severity: 'high' | 'medium' | 'low';
  description: string;
  autoRenewalId?: string;
  manualRenewalId?: string;
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  detectedAt: string;
}

export interface RenewalRecord {
  id: string;
  type: 'auto' | 'manual';
  requestedAt: string;
  requestedBy: string;
  newStartDate: string;
  newEndDate: string;
  newPrice: number;
  status: 'pending' | 'confirmed' | 'cancelled';
}

export interface LeaseRemark {
  id: string;
  content: string;
  createdBy: string;
  createdAt: string;
  conflictId?: string;
}

export interface HistoryRecord {
  id: string;
  leaseId: string;
  actionType: HistoryActionType;
  timestamp: string;
  actor: string;
  description: string;
  details: Record<string, any>;
}

export interface ImportBadRow {
  rowNumber: number;
  rawData: string;
  errorType: string;
  errorMessage: string;
}

export interface Lease {
  id: string;
  leaseNo: string;
  customer: Customer;
  asset: LeaseAsset;
  startDate: string;
  endDate: string;
  price: number;
  status: LeaseStatus;
  paymentStatus: PaymentStatus;
  renewalRule: RenewalRule;
  conflicts: RenewalConflict[];
  renewalRecords: RenewalRecord[];
  remarks: LeaseRemark[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  importBadRows?: ImportBadRow[];
}

export interface ApiError {
  code: string;
  message: string;
  category: ErrorCategory;
  suggestion: string;
  details: Record<string, any>;
  timestamp: string;
}
