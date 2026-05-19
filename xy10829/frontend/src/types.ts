export enum EventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  RETRYING = 'retrying',
  CANCELLED = 'cancelled'
}

export interface TimeoutEvent {
  id: string;
  eventKey: string;
  ticketId: string;
  slaRuleId: string;
  status: EventStatus;
  triggeredAt: string;
  nextRetryAt?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
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
  requestedAt: string;
  respondedAt: string;
}

export interface RetryBatch {
  id: string;
  eventIds: string[];
  triggeredBy: string;
  reason: string;
  status: EventStatus;
  startedAt?: string;
  completedAt?: string;
  successCount: number;
  failedCount: number;
  createdAt: string;
}

export interface SLARule {
  id: string;
  name: string;
  description?: string;
  priority: string;
  timeoutMinutes: number;
  warningMinutes?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CallbackTarget {
  id: string;
  name: string;
  description?: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  timeoutMs: number;
  maxRetries: number;
  retryIntervalMs: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Statistics {
  total: number;
  success: number;
  failed: number;
  pending: number;
  today: number;
}

export interface CreateEventRequest {
  ticketId: string;
  slaRuleId: string;
  eventKey: string;
  ticketData?: {
    title: string;
    content: string;
    priority: string;
  };
}
