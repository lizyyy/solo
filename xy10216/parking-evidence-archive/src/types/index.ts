export type CaseStatus = 'pending_review' | 'approved' | 'rejected' | 'payment_pending' | 'payment_completed' | 'exported';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type EvidenceType = 'entry_image' | 'exit_record' | 'manual_release' | 'payment_proof' | 'other';
export type ReleaseType = 'manual' | 'automatic';

export interface EvidenceAttachment {
  id: string;
  type: EvidenceType;
  name: string;
  placeholder: boolean;
  url?: string;
  uploadedAt?: string;
  size?: string;
  description?: string;
}

export interface ManualReleaseRecord {
  id: string;
  timestamp: string;
  operator: string;
  reason: string;
  reviewed: boolean;
  reviewer?: string;
  reviewComment?: string;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  timestamp: string;
  method: string;
  transactionId?: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'event' | 'review' | 'payment' | 'export';
  description: string;
  operator?: string;
}

export interface ParkingCase {
  id: string;
  plateNumber: string;
  entryTime: string;
  exitTime: string;
  duration: string;
  feeAmount: number;
  paidAmount: number;
  status: CaseStatus;
  paymentStatus: PaymentStatus;
  evidences: EvidenceAttachment[];
  manualReleases: ManualReleaseRecord[];
  payments: PaymentRecord[];
  timeline: TimelineEvent[];
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseFilter {
  plateNumber?: string;
  status?: CaseStatus;
  dateRange?: {
    start: string;
    end: string;
  };
}
