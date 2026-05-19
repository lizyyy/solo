export enum InspectionStatus {
  IMPORTED = 'imported',
  SCANNED = 'scanned',
  PENDING_REVIEW = 'pending_review',
  REVIEW_PASSED = 'review_passed',
  REVIEW_REJECTED = 'review_rejected',
  EXPORTED = 'exported'
}

export enum IssueType {
  MISSING_APOLOGY = 'missing_apology',
  MISSING_REFUND_PROMISE = 'missing_refund_promise',
  SENSITIVE_WORD = 'sensitive_word'
}

export interface Issue {
  type: IssueType;
  description: string;
  severity: 'low' | 'medium' | 'high';
  position?: {
    start: number;
    end: number;
  };
  matchedText?: string;
}

export interface TranscriptionRecord {
  id: string;
  externalId?: string;
  customerName: string;
  customerPhone: string;
  customerIdCard?: string;
  agentName: string;
  agentId: string;
  callTime: string;
  duration: number;
  transcription: string;
  sensitiveFields: string[];
}

export interface InspectionRecord extends TranscriptionRecord {
  status: InspectionStatus;
  scanTime?: string;
  issues: Issue[];
  hasApology: boolean;
  hasRefundPromise: boolean;
  reviewTime?: string;
  reviewer?: string;
  reviewNotes?: string;
  exportTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SensitiveWord {
  id: string;
  word: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
  enabled: boolean;
  createdAt: string;
}

export interface InspectionSummary {
  totalRecords: number;
  scannedCount: number;
  pendingReviewCount: number;
  passedCount: number;
  rejectedCount: number;
  issueBreakdown: {
    missingApology: number;
    missingRefundPromise: number;
    sensitiveWord: number;
  };
  topSensitiveWords: { word: string; count: number }[];
}

export interface ReviewRequest {
  reviewer: string;
  notes?: string;
  action: 'pass' | 'reject';
}
