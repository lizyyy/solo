export enum TicketType {
  PAID = 'paid',
  COMP = 'complimentary'
}

export enum DataSource {
  SOUND_ENGINEER = 'sound_engineer',
  REHEARSAL_GROUP = 'rehearsal_group'
}

export enum BatchStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
  NEEDS_AUDIO_ENGINEER_REVIEW = 'needs_audio_engineer_review'
}

export enum ConflictType {
  TICKET_COUNT_MISMATCH = 'ticket_count_mismatch',
  TICKET_TYPE_MISMATCH = 'ticket_type_mismatch',
  ATTENDEE_MISMATCH = 'attendee_mismatch',
  REVENUE_MISMATCH = 'revenue_mismatch'
}

export interface ShowBatch {
  id: number;
  batchDate: string;
  showName: string;
  status: BatchStatus;
  createdAt: string;
  updatedAt: string;
  hasMixedTickets: boolean;
  needsReview: boolean;
}

export interface TicketRecord {
  id: number;
  batchId: number;
  source: DataSource;
  ticketType: TicketType;
  ticketNumber?: string;
  attendeeName?: string;
  price: number;
  quantity: number;
  notes?: string;
  importedAt: string;
}

export interface ConflictEvidence {
  id: number;
  batchId: number;
  conflictType: ConflictType;
  soundEngineerValue: string;
  rehearsalGroupValue: string;
  description: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  resolution?: 'confirm_sound_engineer' | 'confirm_rehearsal_group' | 'custom';
  customValue?: string;
}

export interface RevenueSplitResult {
  id: number;
  batchId: number;
  totalTickets: number;
  totalPaidTickets: number;
  totalCompTickets: number;
  totalRevenue: number;
  barRevenue: number;
  venueSplit: number;
  artistSplit: number;
  calculatedAt: string;
  version: number;
}

export interface SelfCheckResult {
  checkType: string;
  passed: boolean;
  message: string;
  details?: any;
}

export interface ImportResult {
  batchId: number;
  recordsImported: number;
  duplicatesFound: number;
  warnings: string[];
  conflicts: ConflictEvidence[];
}
