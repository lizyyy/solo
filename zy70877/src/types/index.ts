export interface Mentor {
  id: string;
  name: string;
  department: string;
  major: string;
  direction: string;
  quota: number;
  usedQuota: number;
}

export interface Application {
  id: string;
  batchId: string;
  studentId: string;
  studentName: string;
  studentMajor: string;
  mentorId: string;
  mentorName: string;
  priority: number;
  isTransfer: boolean;
  status: 'pending' | 'normal' | 'confirmed' | 'failed';
  createdAt: Date;
}

export interface TransferRecord {
  id: string;
  batchId: string;
  studentId: string;
  studentName: string;
  fromMajor: string;
  toMajor: string;
  reason: string;
  status: 'pending' | 'normal' | 'confirmed' | 'failed';
  createdAt: Date;
}

export interface ProcessingResult<T> {
  normal: ProcessedItem<T>[];
  pending: ProcessedItem<T>[];
  failed: FailedItem<T>[];
}

export interface ProcessedItem<T> {
  data: T;
  message: string;
}

export interface FailedItem<T> {
  original: T;
  error: string;
  suggestion: string;
}

export interface BatchImportRequest {
  batchId: string;
  mentors?: Mentor[];
  applications?: Application[];
  transfers?: TransferRecord[];
}

export type ValidationRule = 'quota' | 'cross_major' | 'duplicate' | 'mentor_exists';

export interface ValidationError {
  rule: ValidationRule;
  message: string;
  suggestion: string;
}
