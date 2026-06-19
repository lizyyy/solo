export type TicketType = 'free' | 'paid';

export type BatchStatus = 'pending' | 'reviewing' | 'authorized' | 'rejected';

export type UserRole = 'recorder' | 'copyright';

export type ImportResultStatus = 'new' | 'duplicate-this-session' | 'duplicate-history' | 'updated';

export type MaterialSource = 'photo' | 'ticket';

export interface ParsedPhotoRow {
  name: string;
  type: TicketType;
  sourcePhotoRef: string;
  remark?: string;
}

export interface ParsedTicketRow {
  ticketNo: string;
  type: TicketType;
  purchaser: string;
  sourceExportRef: string;
}

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
  updatedAt: string;
  importSessionId?: string;
  dedupKey: string;
}

export interface TicketRecord {
  id: string;
  batchId: string;
  ticketNo: string;
  type: TicketType;
  purchaser: string;
  sourceExportRef: string;
  createdAt: string;
  dedupKey: string;
}

export interface NoteHistory {
  id: string;
  batchId: string;
  recordId: string;
  oldContent: string;
  newContent: string;
  modifiedBy: UserRole;
  modifiedAt: string;
  affectedResultFields: string[];
  operatorName: string;
  source: 'manual' | 'import';
  importSessionId?: string;
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
  traceImportSessionId?: string;
  traceRecordIds?: string[];
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

export type ImportSourceType = 'photo' | 'ticket';

export interface ImportDetailItem {
  lineNo: number;
  dedupKey: string;
  displayName: string;
  status: ImportResultStatus;
  existingRecordId?: string;
  newRecordId?: string;
  message: string;
}

export interface ImportSession {
  id: string;
  batchId: string;
  sourceType: ImportSourceType;
  fileName: string;
  fileContent: string;
  materialFingerprint: string;
  importedBy: UserRole;
  importedAt: string;
  totalInputCount: number;
  newCount: number;
  duplicateThisSessionCount: number;
  duplicateHistoryCount: number;
  updatedCount: number;
  details: ImportDetailItem[];
  calcParamsVersion: string;
  isResameMaterialImport: boolean;
  priorSessionId?: string;
}

export interface ExportBundle {
  exportVersion: string;
  exportedAt: string;
  batch: Batch;
  records: AttendanceRecord[];
  tickets: TicketRecord[];
  importSessions: ImportSession[];
  noteHistories: NoteHistory[];
  processStep?: ProcessStep;
  calcParams: CalcParams;
}
