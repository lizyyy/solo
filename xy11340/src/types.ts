export interface PartOrder {
  id?: number;
  orderNo: string;
  engineerId: string;
  engineerName: string;
  partCode: string;
  partName: string;
  quantity: number;
  unit: string;
  receiveDate: string;
  workOrderNo: string;
  customerName: string;
  customerPhone: string;
  status: 'pending' | 'used' | 'returned' | 'lost';
  createdAt?: string;
  updatedAt?: string;
}

export interface RepairOrder {
  id?: number;
  repairNo: string;
  workOrderNo: string;
  engineerId: string;
  engineerName: string;
  faultType: string;
  faultDescription: string;
  repairDate: string;
  partsUsed: PartUsage[];
  oldPartsReturned: OldPartReturn[];
  status: 'pending' | 'completed' | 'rejected';
  createdAt?: string;
  updatedAt?: string;
}

export interface PartUsage {
  partCode: string;
  partName: string;
  quantity: number;
}

export interface OldPartReturn {
  partCode: string;
  partName: string;
  quantity: number;
  returnDate: string;
  condition: 'good' | 'damaged' | 'incomplete';
}

export interface ClaimRule {
  id?: number;
  ruleCode: string;
  ruleName: string;
  partCode: string;
  partName: string;
  faultType: string;
  claimAmount: number;
  requiresOldPart: boolean;
  effectiveDate: string;
  expiryDate: string;
  status: 'active' | 'inactive';
  createdAt?: string;
}

export interface ClaimRecord {
  id?: number;
  claimNo: string;
  repairNo: string;
  workOrderNo: string;
  ruleCode: string;
  partCode: string;
  claimAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt?: string;
}

export interface ImportError {
  id?: number;
  importBatch: string;
  importType: 'parts' | 'repair' | 'rules';
  sourceFile: string;
  rowNumber: number;
  rawData: string;
  errorType: string;
  errorMessage: string;
  suggestion: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt?: string;
}

export interface ImportHistory {
  id?: number;
  importBatch: string;
  importType: 'parts' | 'repair' | 'rules';
  sourceFile: string;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  importedBy: string;
  createdAt?: string;
}

export interface ReviewRecord {
  id?: number;
  claimId: number;
  claimNo: string;
  reviewer: string;
  action: 'approve' | 'reject';
  reason?: string;
  createdAt?: string;
}
