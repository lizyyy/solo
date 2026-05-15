export enum EventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  RETRYING = 'retrying',
  CANCELLED = 'cancelled'
}

export enum CallbackMethod {
  POST = 'POST',
  GET = 'GET',
  PUT = 'PUT'
}

export interface Ticket {
  id: string;
  ticketId: string;
  title: string;
  content: string;
  status: string;
  priority: string;
  assignee?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SLARule {
  id: string;
  name: string;
  description?: string;
  priority: string;
  timeoutMinutes: number;
  warningMinutes?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CallbackTarget {
  id: string;
  name: string;
  description?: string;
  url: string;
  method: CallbackMethod;
  headers?: Record<string, string>;
  timeoutMs: number;
  maxRetries: number;
  retryIntervalMs: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeoutEvent {
  id: string;
  eventKey: string;
  ticketId: string;
  slaRuleId: string;
  status: EventStatus;
  triggeredAt: Date;
  nextRetryAt?: Date;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetryBatch {
  id: string;
  eventIds: string[];
  triggeredBy: string;
  reason: string;
  status: EventStatus;
  startedAt?: Date;
  completedAt?: Date;
  successCount: number;
  failedCount: number;
  createdAt: Date;
}

export interface ResponseSummary {
  id: string;
  eventId: string;
  targetId: string;
  status: EventStatus;
  statusCode?: number;
  responseBody?: string;
  errorMessage?: string;
  durationMs: number;
  requestedAt: Date;
  respondedAt: Date;
}

export interface CreateEventRequest {
  ticketId: string;
  slaRuleId: string;
  eventKey: string;
  ticketData?: Partial<Ticket>;
}

export interface ManualRetryRequest {
  eventIds: string[];
  reason: string;
  triggeredBy: string;
}

export interface QueryParams {
  status?: EventStatus;
  ticketId?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  pageSize?: number;
}
