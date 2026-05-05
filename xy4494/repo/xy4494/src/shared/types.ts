export enum ItemStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  APPROVED = 'approved',
  NEED_PROOF = 'need_proof',
  NEED_SUPERVISOR = 'need_supervisor',
  RETURNED = 'returned',
  CLOSED = 'closed',
}

export enum ItemCategory {
  ELECTRONICS = 'electronics',
  DOCUMENTS = 'documents',
  CLOTHING = 'clothing',
  BAGS = 'bags',
  VALUABLES = 'valuables',
  KEYS = 'keys',
  OTHER = 'other',
}

export interface LostItem {
  id: string;
  itemCode: string;
  station: string;
  category: ItemCategory;
  description: string;
  finderName: string;
  finderContact: string;
  foundTime: string;
  foundLocation: string;
  estimatedValue: number;
  specialMarks: string;
  photos: ItemPhoto[];
  lockerRecords: LockerRecord[];
  claimAppointments: ClaimAppointment[];
  status: ItemStatus;
  autoJudgeResult: AutoJudgeResult | null;
  manualReview: ManualReview | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItemPhoto {
  id: string;
  filePath: string;
  fileName: string;
  tags: string[];
  uploadedAt: string;
  description: string;
}

export interface LockerRecord {
  id: string;
  lockerCode: string;
  scannedBy: string;
  scannedAt: string;
  action: 'store' | 'retrieve';
  notes: string;
}

export interface ClaimAppointment {
  id: string;
  claimantName: string;
  claimantContact: string;
  claimantIdType: string;
  claimantIdNumber: string;
  appointmentTime: string;
  description: string;
  proofDocuments: string[];
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes: string;
  createdAt: string;
}

export interface AutoJudgeResult {
  canReturn: boolean;
  needProof: boolean;
  needSupervisor: boolean;
  reasons: string[];
  suggestedActions: string[];
  confidence: number;
}

export interface ManualReview {
  id: string;
  reviewerName: string;
  reviewTime: string;
  notes: string;
  finalDecision: ItemStatus;
  additionalRequirements: string[];
}

export interface ImportData {
  lostItems: Partial<LostItem>[];
  claimAppointments: Partial<ClaimAppointment>[];
  lockerRecords: Partial<LockerRecord>[];
}

export interface ExportOptions {
  format: 'markdown' | 'json';
  includePhotos: boolean;
  includeHistory: boolean;
  stationFilter: string[];
  statusFilter: ItemStatus[];
  dateRange: {
    start: string;
    end: string;
  } | null;
}

export interface AppSettings {
  defaultStation: string;
  autoJudgeEnabled: boolean;
  highValueThreshold: number;
  dataRetentionDays: number;
  exportPath: string;
  photoStoragePath: string;
}
