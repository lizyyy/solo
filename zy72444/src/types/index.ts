export type TicketType = 'free' | 'paid';

export type BatchStatus = 'pending' | 'reviewing' | 'authorized' | 'rejected';

export type UserRole = 'recorder' | 'copyright';

export interface Batch {
  id: string;
  name: string;
  date: string;
  status: BatchStatus;
  hasMixedType: boolean;
  totalCount: number;
  freeTicketCount: number;
  paidTicketCount: number;
  attendancePhotoHash: string;
  ticketExportHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  batchId: string;
  name: string;
  type: TicketType;
  sourcePhotoRef: string;
  remark?: string;
  createdAt: string;
}

export interface TicketRecord {
  id: string;
  batchId: string;
  ticketNo: string;
  type: TicketType;
  purchaser: string;
  sourceExportRef: string;
  createdAt: string;
}

export interface NoteHistory {
  id: string;
  batchId: string;
  recordId: string;
  oldContent: string;
  newContent: string;
  modifiedBy: UserRole;
  modifiedAt: string;
}

export interface AuthorizationAlert {
  id: string;
  batchId: string;
  title: string;
  reason: string;
  missingMaterials: string[];
  nextStep: string;
  assignee: UserRole;
  isResolved: boolean;
  createdAt: string;
}

export interface ProcessStep {
  id: string;
  batchId: string;
  currentStep: 1 | 2 | 3;
  step1Completed: boolean;
  step2Completed: boolean;
  step3Completed: boolean;
  step1At?: string;
  step2At?: string;
  step3At?: string;
}

export interface CalcParams {
  id: string;
  version: string;
  modelName: string;
  parameters: Record<string, any>;
  tradeOffReason: string;
  createdAt: string;
}

export interface DiffSegment {
  type: 'same' | 'added' | 'removed';
  content: string;
}
