export interface Influencer {
  id?: number;
  influencerId: string;
  name: string;
  platform: string;
  followers: number;
  category: string;
  contact: string;
  createdAt?: string;
}

export interface Sample {
  id?: number;
  sampleId: string;
  name: string;
  brand: string;
  category: string;
  value: number;
  deposit: number;
  createdAt?: string;
}

export interface Batch {
  id?: number;
  batchId: string;
  brand: string;
  sendDate: string;
  expectedReturnDate: string;
  status: 'pending' | 'processing' | 'completed' | 'returned';
  handler?: string;
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SampleRecord {
  id?: number;
  recordId: string;
  batchId: string;
  sampleId: string;
  sampleName: string;
  influencerId: string;
  influencerName: string;
  sendDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  status: 'pending' | 'sent' | 'received' | 'overdue' | 'damaged' | 'returned' | 'deducted' | 'duplicate' | 'rejected';
  deposit: number;
  deductionAmount?: number;
  deductionReason?: string;
  photos?: string;
  handler?: string;
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OperationLog {
  id?: number;
  recordId: string;
  operation: 'created' | 'processed' | 'returned' | 'deducted' | 'modified' | 'approved' | 'duplicate' | 'rejected';
  operator: string;
  reason?: string;
  remark?: string;
  createdAt?: string;
}

export type RecordStatus = SampleRecord['status'];
export type BatchStatus = Batch['status'];
