export type DifferenceType = 'profit' | 'loss' | 'not_counted' | 'over_counted' | 'matched';

export interface BookInventory {
  auditId: string;
  location: string;
  sku: string;
  quantity: number;
}

export interface ActualCount {
  auditId: string;
  location: string;
  sku: string;
  quantity: number;
  countedAt: string;
}

export interface LocationOwner {
  location: string;
  owner: string;
}

export interface Difference {
  id: string;
  auditId: string;
  location: string;
  sku: string;
  bookQuantity: number;
  actualQuantity: number;
  differenceQuantity: number;
  differenceType: DifferenceType;
  owner: string;
  reviewReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  adjustmentQuantity?: number;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditSession {
  id: string;
  name: string;
  status: 'importing' | 'calculated' | 'reviewing' | 'adjusting' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface AdjustmentHistory {
  id: string;
  auditId: string;
  differenceId: string;
  location: string;
  sku: string;
  oldQuantity: number;
  newQuantity: number;
  adjustmentQuantity: number;
  approvedBy: string;
  approvedAt: string;
}

export interface AuditReport {
  auditId: string;
  auditName: string;
  generatedAt: string;
  summary: {
    totalItems: number;
    matchedItems: number;
    profitItems: number;
    lossItems: number;
    notCountedItems: number;
    overCountedItems: number;
    pendingApproval: number;
    approved: number;
    rejected: number;
  };
  adjustments: {
    before: {
      sku: string;
      location: string;
      quantity: number;
    }[];
    after: {
      sku: string;
      location: string;
      quantity: number;
    }[];
  };
  pendingApprovalItems: Difference[];
  completedItems: Difference[];
}

export interface ValidationError {
  type: 'sku_missing' | 'location_mismatch' | 'adjustment_exceeds_difference' | 'duplicate_audit';
  message: string;
  details?: any;
}
