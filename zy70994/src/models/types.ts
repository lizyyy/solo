export type RecordStatus = 'pending' | 'matched' | 'discrepancy' | 'reviewed' | 'approved' | 'rejected';
export type DiscrepancyType = 'subsidy_limit_exceeded' | 'duplicate_claim' | 'refund_return' | 'no_subsidy_record' | 'no_swipe_record' | 'amount_mismatch' | 'date_out_of_range';
export type ReviewAction = 'approve' | 'reject' | 'adjust' | 'require_materials';

export interface Student {
  studentId: string;
  name: string;
  grade: string;
  class: string;
}

export interface SubsidyRecord extends Student {
  id: string;
  subsidyType: string;
  monthlyLimit: number;
  effectiveMonth: string;
  status: 'active' | 'inactive';
  remarks?: string;
  createdAt: Date;
}

export interface SwipeRecord extends Student {
  id: string;
  swipeTime: Date;
  amount: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'other';
  merchantName: string;
  terminalNo: string;
  isSubsidyUsed: boolean;
}

export interface RefundRecord extends Student {
  id: string;
  refundDate: Date;
  refundAmount: number;
  reason: string;
  relatedSwipeId?: string;
  operator: string;
  status: 'pending' | 'processed' | 'cancelled';
}

export interface Discrepancy {
  type: DiscrepancyType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  detailedExplanation: string;
  expectedValue?: number;
  actualValue?: number;
  difference?: number;
}

export interface ReviewRecord {
  id: string;
  reviewer: string;
  reviewTime: Date;
  action: ReviewAction;
  comments: string;
  adjustedAmount?: number;
  requiresFollowUp: boolean;
  followUpDeadline?: Date;
}

export interface ReconciliationDetail {
  id: string;
  batchId: string;
  studentId: string;
  studentName: string;
  
  subsidyRecord?: SubsidyRecord;
  swipeRecords: SwipeRecord[];
  refundRecords: RefundRecord[];
  
  totalSubsidyLimit: number;
  totalSwipeAmount: number;
  totalRefundAmount: number;
  netAmount: number;
  eligibleAmount: number;
  ineligibleAmount: number;
  
  status: RecordStatus;
  discrepancies: Discrepancy[];
  reviewRecords: ReviewRecord[];
  
  manualAdjustment?: {
    adjustedBy: string;
    adjustedAmount: number;
    reason: string;
    adjustedAt: Date;
  };
  
  finalAmount: number;
  finalExplanation: string;
}

export interface ReconciliationBatch {
  id: string;
  name: string;
  month: string;
  status: 'importing' | 'processing' | 'reviewing' | 'completed';
  createdAt: Date;
  createdBy: string;
  processedAt?: Date;
  completedAt?: Date;
  
  totalRecords: number;
  matchedRecords: number;
  discrepancyRecords: number;
  reviewedRecords: number;
  
  totalSubsidyAmount: number;
  totalSwipeAmount: number;
  totalRefundAmount: number;
  totalEligibleAmount: number;
  totalIneligibleAmount: number;
  
  subsidyFileInfo?: FileInfo;
  swipeFileInfo?: FileInfo;
  refundFileInfo?: FileInfo;
}

export interface FileInfo {
  originalName: string;
  storedName: string;
  uploadTime: Date;
  recordCount: number;
  fileSize: number;
}

export interface ReconciliationSummary {
  batchId: string;
  month: string;
  
  statistics: {
    totalStudents: number;
    withSubsidy: number;
    withoutSubsidy: number;
    matched: number;
    withDiscrepancy: number;
    reviewed: number;
  };
  
  amounts: {
    totalSubsidyLimit: number;
    totalSwipe: number;
    totalRefund: number;
    totalEligible: number;
    totalIneligible: number;
    toBePaid: number;
    toBeReturned: number;
  };
  
  discrepancyBreakdown: {
    type: DiscrepancyType;
    count: number;
    totalAmount: number;
  }[];
}
