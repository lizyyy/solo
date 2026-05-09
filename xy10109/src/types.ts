export type CertificateType = 'store_license' | 'health_certificate' | 'supplier_qualification';

export type CertificateStatus = 'pending' | 'valid' | 'expired' | 'expiring_soon' | 'invalid';

export type ReviewStatus = 'not_reviewed' | 'under_review' | 'approved' | 'rejected';

export interface Certificate {
  id: string;
  certificateNumber: string;
  type: CertificateType;
  name: string;
  holder: string;
  issueDate: string;
  expiryDate: string;
  status: CertificateStatus;
  reviewStatus: ReviewStatus;
  reviewComments?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryRecord {
  id: string;
  certificateId: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
  duplicates: string[];
}

export interface FieldConflict {
  field: string;
  existingValue: string;
  newValue: string;
}
