export interface Order {
  orderNo: string;
  trackingNo: string;
  amount: number;
  shippedAt: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'returned' | 'closed';
  product: string;
  customer: string;
}

export interface SignRecord {
  trackingNo: string;
  signedAt: string;
  signedBy: string;
  hasPhoto: boolean;
  photoUrl?: string;
  batchId: string;
  status: 'success' | 'failed' | 'refused';
}

export interface RefuseRecord {
  trackingNo: string;
  refusedAt: string;
  reason: string;
  operator: string;
  batchId: string;
}

export interface ClaimRecord {
  claimId: string;
  trackingNo: string;
  amount: number;
  appliedAt: string;
  approvedAt?: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  batchId: string;
}

export type AbnormalType =
  | 'closed_without_sign'
  | 'sign_without_proof'
  | 'delivered_after_refuse'
  | 'duplicate_claim';

export type IssueType =
  | 'missing_tracking_no'
  | 'sign_before_ship'
  | 'claim_exceeds_order';

export interface Abnormal {
  id: string;
  type: AbnormalType;
  trackingNo: string;
  orderNo: string;
  description: string;
  detectedAt: string;
  reviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  matchedData: {
    order?: Order;
    signRecords?: SignRecord[];
    refuseRecords?: RefuseRecord[];
    claimRecords?: ClaimRecord[];
  };
}

export interface Issue {
  id: string;
  type: IssueType;
  trackingNo?: string;
  description: string;
  source: string;
  detectedAt: string;
}

export interface Review {
  abnormalId: string;
  trackingNo: string;
  reviewer: string;
  note: string;
  reviewedAt: string;
}

export interface DataStore {
  orders: Order[];
  signRecords: SignRecord[];
  refuseRecords: RefuseRecord[];
  claimRecords: ClaimRecord[];
  abnormals: Abnormal[];
  issues: Issue[];
  reviews: Review[];
  processedBatches: string[];
}

export interface ImportResult {
  success: boolean;
  ordersImported: number;
  signRecordsImported: number;
  refuseRecordsImported: number;
  claimRecordsImported: number;
  newAbnormals: number;
  newIssues: number;
  duplicateBatches: string[];
}
