export enum CleaningStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  NEEDS_REWORK = 'needs_rework',
  CLOSED = 'closed'
}

export enum ComplaintStatus {
  OPEN = 'open',
  PROCESSING = 'processing',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated'
}

export enum ReworkStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  COMPLETED = 'completed',
  VERIFIED = 'verified'
}

export interface RoomState {
  id?: number;
  roomNumber: string;
  date: string;
  status: 'occupied' | 'vacant' | 'reserved' | 'maintenance';
  guestName?: string;
  guestPhone?: string;
  checkInDate?: string;
  checkOutDate?: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CleaningRecord {
  id?: number;
  roomNumber: string;
  cleanerName: string;
  cleanerPhone?: string;
  scheduledDate: string;
  startTime?: string;
  endTime?: string;
  status: CleaningStatus;
  photos?: string[];
  qualityScore?: number;
  remarks?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Complaint {
  id?: number;
  roomNumber: string;
  guestName?: string;
  guestPhone?: string;
  complaintDate: string;
  category: 'cleanliness' | 'facility' | 'service' | 'noise' | 'other';
  description: string;
  status: ComplaintStatus;
  handler?: string;
  resolution?: string;
  resolutionDate?: string;
  deductionAmount?: number;
  relatedCleaningId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReworkRecord {
  id?: number;
  relatedCleaningId: number;
  roomNumber: string;
  reworkReason: string;
  reworkDate: string;
  reworkerName: string;
  status: ReworkStatus;
  photos?: string[];
  verificationRemarks?: string;
  deductionAmount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeductionRule {
  id?: number;
  category: string;
  subCategory?: string;
  description: string;
  amount: number;
  isPercentage: boolean;
  enabled: boolean;
  createdAt?: string;
}

export interface ImportRecord<T = any> {
  id?: number;
  batchId: string;
  sourceType: 'csv' | 'json' | 'photo_list';
  sourceFileName: string;
  rowNumber: number;
  rawData: T;
  isValid: boolean;
  errors?: string[];
  suggestions?: string[];
  importedId?: number;
  createdAt?: string;
}

export interface ImportBatch {
  id?: string;
  type: 'room_state' | 'cleaning' | 'photo';
  fileName: string;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt?: string;
}

export interface SensitiveFieldConfig {
  entity: string;
  field: string;
  maskPattern: string;
  roles: string[];
}
