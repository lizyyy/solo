export type MessageStatus = 'dead' | 'pending' | 'replaying' | 'success' | 'failed' | 'skipped';

export type DeadReason = 'timeout' | 'exception' | 'validation_error' | 'business_error' | 'unknown';

export interface DeadLetterMessage {
  id: string;
  topic: string;
  deadReason: DeadReason;
  deadReasonDesc: string;
  payloadSummary: string;
  payload: Record<string, any>;
  originalQueue: string;
  status: MessageStatus;
  createdAt: number;
  updatedAt: number;
  batchId?: string;
  responsibleNode: string;
  retryCount: number;
  lastError?: string;
  history: HistoryRecord[];
}

export interface HistoryRecord {
  timestamp: number;
  action: string;
  status: MessageStatus;
  operator: string;
  note?: string;
}

export interface ReplayBatch {
  id: string;
  name: string;
  topic: string;
  messageIds: string[];
  status: 'created' | 'running' | 'paused' | 'completed' | 'failed';
  rateLimit: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  operator: string;
}

export interface SkipRule {
  id: string;
  name: string;
  topic?: string;
  deadReason?: DeadReason;
  payloadPattern?: string;
  enabled: boolean;
  createdAt: number;
}
