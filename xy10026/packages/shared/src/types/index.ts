export enum MessageType {
  CHAT = 'chat',
  GIFT = 'gift',
  LIKE = 'like',
  FOLLOW = 'follow',
  SYSTEM = 'system',
  ANNOUNCEMENT = 'announcement'
}

export enum MessageStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

export enum OperationType {
  CREATE_MESSAGE = 'create_message',
  UPDATE_MESSAGE = 'update_message',
  DELETE_MESSAGE = 'delete_message',
  PUSH_MESSAGE = 'push_message',
  RETRY_MESSAGE = 'retry_message',
  ROLLBACK_MESSAGE = 'rollback_message'
}

export enum EventType {
  MESSAGE_CREATED = 'message_created',
  MESSAGE_UPDATED = 'message_updated',
  MESSAGE_DELETED = 'message_deleted',
  MESSAGE_PUSHED = 'message_pushed',
  MESSAGE_FAILED = 'message_failed',
  MESSAGE_ROLLBACKED = 'message_rollbacked',
  CONFLICT_OCCURRED = 'conflict_occurred'
}

export interface LiveMessage {
  id: string;
  roomId: string;
  type: MessageType;
  content: string;
  senderId: string;
  senderName: string;
  metadata?: Record<string, unknown>;
  sequence: number;
  status: MessageStatus;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date;
  version: number;
}

export interface Operation {
  id: string;
  messageId: string;
  type: OperationType;
  operatorId: string;
  operatorName: string;
  beforeState?: Partial<LiveMessage>;
  afterState?: Partial<LiveMessage>;
  reason?: string;
  timestamp: Date;
  traceId: string;
  ip?: string;
  userAgent?: string;
}

export interface Event {
  id: string;
  type: EventType;
  aggregateId: string;
  data: Partial<LiveMessage> | Operation;
  version: number;
  timestamp: Date;
  traceId: string;
  metadata?: Record<string, unknown>;
}

export interface ConflictResolution {
  id: string;
  messageId: string;
  baseVersion: number;
  currentVersion: number;
  proposedVersion: number;
  resolved: boolean;
  winner: 'current' | 'proposed' | 'merged';
  mergedData?: Partial<LiveMessage>;
  resolvedAt: Date;
}

export interface PushTask {
  id: string;
  messageId: string;
  roomId: string;
  partitionKey: string;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
}

export interface AuditLog {
  id: string;
  traceId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export interface ReportData {
  roomId: string;
  period: {
    start: Date;
    end: Date;
  };
  totalMessages: number;
  messagesByType: Record<MessageType, number>;
  messagesByStatus: Record<MessageStatus, number>;
  averageDelay: number;
  p95Delay: number;
  p99Delay: number;
  failedMessages: number;
  retryCount: number;
  conflicts: number;
  topSenders: Array<{ senderId: string; senderName: string; count: number }>;
  operations: Operation[];
}

export interface KafkaMessage {
  key: string;
  value: {
    traceId: string;
    message: LiveMessage;
    timestamp: number;
    sequence: number;
  };
  headers?: Record<string, string>;
}

export interface CacheOptions {
  key: string;
  ttl?: number;
  namespace?: string;
}

export interface DistributedLockOptions {
  key: string;
  ttl: number;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

export interface IdempotencyRecord {
  idempotencyKey: string;
  traceId: string;
  messageId: string;
  createdAt: Date;
  expiresAt: Date;
  response?: Record<string, unknown>;
}
