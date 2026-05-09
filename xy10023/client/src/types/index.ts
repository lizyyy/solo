export enum UserRole {
  ADMIN = 'admin',
  SUPERVISOR = 'supervisor',
  AGENT = 'agent',
}

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthState {
  user: User | null;
  tokens: AuthToken | null;
  isAuthenticated: boolean;
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  PENDING_FOLLOWUP = 'pending_followup',
  COMPLETED = 'completed',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

export enum TicketPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export interface Ticket {
  id: string;
  title: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  assigneeId?: string;
  status: TicketStatus;
  priority: TicketPriority;
  category?: string;
  description?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketDto {
  title: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  category?: string;
  description?: string;
  priority?: TicketPriority;
}

export interface UpdateTicketDto {
  title?: string;
  customerName?: string;
  customerPhone?: string;
  category?: string;
  description?: string;
  priority?: TicketPriority;
  assigneeId?: string;
  version: number;
}

export enum FollowUpType {
  CALL = 'call',
  MESSAGE = 'message',
  EMAIL = 'email',
  COMPENSATION = 'compensation',
  VISIT = 'visit',
  OTHER = 'other',
}

export enum FollowUpStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export interface FollowUp {
  id: string;
  ticketId: string;
  content: string;
  followUpType: FollowUpType;
  promisedAction?: string;
  promisedDeadline?: string;
  status: FollowUpStatus;
  assigneeId?: string;
  createdBy: string;
  completedAt?: string;
  completionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFollowUpDto {
  ticketId: string;
  content: string;
  followUpType: FollowUpType;
  promisedAction?: string;
  promisedDeadline?: string;
  assigneeId?: string;
}

export interface CompleteFollowUpDto {
  completionNote: string;
}

export enum EventType {
  TICKET_CREATED = 'TicketCreated',
  TICKET_UPDATED = 'TicketUpdated',
  TICKET_STATUS_CHANGED = 'TicketStatusChanged',
  TICKET_ASSIGNED = 'TicketAssigned',
  FOLLOW_UP_ADDED = 'FollowUpAdded',
  FOLLOW_UP_UPDATED = 'FollowUpUpdated',
  FOLLOW_UP_COMPLETED = 'FollowUpCompleted',
  COMPENSATION_APPLIED = 'CompensationApplied',
  STATE_RESTORED = 'StateRestored',
  TICKET_DELETED = 'TicketDeleted',
  NOTE_ADDED = 'NoteAdded',
}

export enum AggregateType {
  TICKET = 'ticket',
  FOLLOW_UP = 'followup',
}

export enum OperatorType {
  USER = 'user',
  SYSTEM = 'system',
}

export interface Event {
  id: string;
  aggregateId: string;
  aggregateType: AggregateType;
  eventType: EventType;
  eventData: Record<string, unknown>;
  version: number;
  requestId?: string;
  operatorId: string;
  operatorType: OperatorType;
  createdAt: string;
}

export interface TicketStats {
  total: number;
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
  overdueFollowUps: number;
}

export interface FollowUpStats {
  total: number;
  byStatus: Record<FollowUpStatus, number>;
  byType: Record<FollowUpType, number>;
  overdue: number;
  completedThisWeek: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type ExportFormat = 'excel' | 'markdown' | 'pdf';

export interface ExportRequest {
  format: ExportFormat;
  type: 'tickets' | 'followups' | 'events' | 'comprehensive';
  filters?: {
    status?: string[];
    priority?: string[];
    assigneeId?: string;
    startDate?: string;
    endDate?: string;
    ticketId?: string;
  };
  includeDetails?: boolean;
  includeEvents?: boolean;
}

export interface ExportJob {
  jobId: string;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'delayed';
  progress?: number;
  result?: unknown;
  failedReason?: string;
}
