export interface CriticalValueRecord {
  id?: string;
  batchId: string;
  patientId: string;
  patientName: string;
  testItem: string;
  testValue: string;
  unit: string;
  referenceRange: string;
  testTime: string;
  reportTime?: string;
  department: string;
  ward: string;
  bedNo: string;
  status: 'normal' | 'pending' | 'failed';
  failureReason?: string;
  suggestion?: string;
  source: 'csv' | 'manual';
  createdAt?: string;
  updatedAt?: string;
}

export interface CallbackRecord {
  id?: string;
  batchId: string;
  criticalValueId?: string;
  patientId: string;
  patientName: string;
  callbackTime: string;
  callbackPerson: string;
  callbackPhone: string;
  receiver: string;
  receiverPhone: string;
  callbackContent: string;
  callbackResult: 'success' | 'failed';
  failureReason?: string;
  source: 'json' | 'manual';
  createdAt?: string;
}

export interface DutyRecord {
  id?: string;
  batchId: string;
  date: string;
  shift: 'day' | 'night';
  department: string;
  doctorName: string;
  doctorPhone: string;
  startTime: string;
  endTime: string;
  isOnDuty: boolean;
  source: 'csv' | 'manual';
  createdAt?: string;
}

export interface ConfirmRecord {
  id?: string;
  batchId?: string;
  criticalValueId: string;
  confirmTime: string;
  confirmer: string;
  confirmerPhone: string;
  confirmResult: 'confirmed' | 'rejected';
  confirmNote?: string;
  source?: string;
  originalData?: any;
  createdAt?: string;
}

export interface Batch {
  id: string;
  batchNo: string;
  type: 'critical_value' | 'callback' | 'duty' | 'confirm';
  fileName: string;
  fileHash: string;
  recordCount: number;
  processedCount: number;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  processedAt?: string;
}

export type ProcessResult = {
  normal: CriticalValueRecord[];
  pending: CriticalValueRecord[];
  failed: FailedRecord[];
  batchId: string;
  statistics: {
    total: number;
    normal: number;
    pending: number;
    failed: number;
  };
};

export interface FailedRecord extends CriticalValueRecord {
  originalData: Record<string, any>;
  failureReason: string;
  suggestion: string;
  ruleViolations: string[];
}
