export enum RecordStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RETURNED = 'returned',
  WAITLISTED = 'waitlisted',
  PROCESSED = 'processed'
}

export enum OperationType {
  IMPORT = 'import',
  CREATE_BATCH = 'create_batch',
  MARK_PROCESSED = 'mark_processed',
  RETURN = 'return',
  EXPORT = 'export',
  WAITLIST = 'waitlist',
  CONTRAINDICATION_BLOCK = 'contraindication_block',
  DUPLICATE_BLOCK = 'duplicate_block',
  APPROVE = 'approve',
  REJECT = 'reject'
}

export interface ChildProfile {
  id: string;
  name: string;
  idCard: string;
  birthDate: string;
  gender: 'male' | 'female';
  guardianName: string;
  guardianPhone: string;
  address: string;
  healthConditions: string[];
  vaccineHistory: VaccineHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface VaccineHistoryItem {
  vaccineCode: string;
  vaccineName: string;
  doseNumber: number;
  vaccinationDate: string;
  batchNo: string;
  manufacturer: string;
}

export interface VaccineInventory {
  id: string;
  vaccineCode: string;
  vaccineName: string;
  manufacturer: string;
  batchNo: string;
  expirationDate: string;
  quantity: number;
  availableQuantity: number;
  minimumAgeMonths: number;
  intervalDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentRecord {
  id: string;
  batchId: string;
  childId: string;
  childName: string;
  childIdCard: string;
  vaccineCode: string;
  vaccineName: string;
  doseNumber: number;
  appointmentDate: string;
  status: RecordStatus;
  waitlistOrder?: number;
  waitlistSource?: string;
  blockReason?: string;
  processedBy?: string;
  processedAt?: string;
  notes?: string;
  operationLogs: OperationLog[];
  createdAt: string;
  updatedAt: string;
}

export interface ContraindicationRule {
  id: string;
  vaccineCode: string;
  vaccineName: string;
  condition: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  createdAt: string;
}

export interface OperationLog {
  id: string;
  operationType: OperationType;
  operator: string;
  reason?: string;
  timestamp: string;
  previousStatus?: RecordStatus;
  newStatus?: RecordStatus;
}

export interface Batch {
  id: string;
  batchNo: string;
  name: string;
  vaccineCode: string;
  vaccineName: string;
  totalCount: number;
  processedCount: number;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  createdBy: string;
}

export interface ImportResult<T> {
  success: boolean;
  total: number;
  imported: number;
  failed: number;
  errors: string[];
  data: T[];
}
