export interface Participant {
  userId: string;
  userName: string;
  shareAmount: number;
  paidAmount: number;
}

export interface BillState {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  totalAmount: number;
  currency: string;
  date: string;
  category?: string;
  participants: Participant[];
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  version: number;
  isDeleted: boolean;
}

export interface Transfer {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED';
}

export interface SettlementState {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  transfers: Transfer[];
  createdBy: string;
  createdAt: string;
  version: number;
}

export interface EventMetadata {
  operatorId: string;
  operatorName: string;
  commandId: string;
  ip?: string;
  userAgent?: string;
  reason?: string;
  groupId?: string;
}

export interface BillEvent {
  id?: string;
  type: BillEventType;
  payload: Record<string, any>;
  metadata: EventMetadata;
  version?: number;
  sequenceNumber?: number;
  createdAt?: string;
}

export type BillEventType = 
  | 'BillCreated'
  | 'BillUpdated'
  | 'BillDeleted'
  | 'ParticipantAdded'
  | 'ParticipantRemoved';

export interface CreateBillCommand {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  totalAmount: number;
  currency: string;
  date: string;
  category?: string;
  participants: Participant[];
}

export interface UpdateBillCommand {
  id: string;
  title: string;
  description?: string;
  totalAmount: number;
  currency: string;
  date: string;
  category?: string;
  participants: Participant[];
  expectedVersion: number;
}

export interface DeleteBillCommand {
  id: string;
  expectedVersion: number;
  reason?: string;
}

export interface CommandMetadata {
  commandId: string;
  operatorId: string;
  operatorName: string;
  ip?: string;
  userAgent?: string;
}

export interface CommandResult {
  success: boolean;
  billId?: string;
  version?: number;
  events?: Array<{
    id: string;
    type: string;
    sequenceNumber?: number;
  }>;
}

export interface ConflictDetails {
  currentState: {
    title: string;
    totalAmount: number;
    participants: Participant[];
  };
  changes: Array<{
    eventType: string;
    operator: string;
    operatorName: string;
    timestamp: string;
    changes: DiffEntry[];
  }>;
}

export interface DiffEntry {
  field: string;
  from: any;
  to: any;
  type: 'ADD' | 'REMOVE' | 'CHANGE';
}

export interface AuditEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  version: number;
  payload: Record<string, any>;
  metadata: {
    operatorId?: string;
    operatorName?: string;
    commandId?: string;
    ip?: string;
    userAgent?: string;
    reason?: string;
  };
  sequenceNumber: number;
  createdAt: string;
}

export interface BalanceChange {
  eventId: string;
  eventType: string;
  billId: string;
  billTitle: string;
  shareAmount: number;
  paidAmount: number;
  change: number;
  runningBalance: number;
  operatorId?: string;
  operatorName?: string;
  timestamp: string;
  sequenceNumber: number;
}

export interface ReplayResult {
  state: BillState | SettlementState;
  eventsApplied: number;
  finalVersion: number;
  timeline: TimelineEntry[];
}

export interface TimelineEntry {
  eventId: string;
  eventType: string;
  version: number;
  timestamp?: string;
  operatorId?: string;
  operatorName?: string;
  previousState: Record<string, any>;
  newState: Record<string, any>;
  changes: DiffEntry[];
}

export interface DiffResult {
  fromVersion: number;
  toVersion: number;
  events: Array<{
    id: string;
    type: string;
    version: number;
    payload: Record<string, any>;
    metadata: EventMetadata;
    createdAt: string;
  }>;
  diff: DiffEntry[];
}

export interface RebuildResult {
  processed: number;
  fromSequence: number;
  toSequence: number;
}

export interface CachedBill {
  id: string;
  groupId: string;
  title: string;
  totalAmount: number;
  currency: string;
  date: string;
  participants: Participant[];
  version: number;
  lastEventId: string;
}

export interface CachedBalance {
  userId: string;
  userName: string;
  balance: number;
  lastSequence: number;
}
