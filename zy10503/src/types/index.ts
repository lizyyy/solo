export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  IN_APP = 'in_app',
  WEBHOOK = 'webhook',
  WECHAT = 'wechat'
}

export enum ReceiptStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  RESENT = 'resent'
}

export enum BatchStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  PARTIAL_FAILED = 'partial_failed',
  FAILED = 'failed'
}

export enum ResendStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed'
}

export interface NotificationBatch {
  id: string;
  batchNo: string;
  title: string;
  content: string;
  channel: NotificationChannel;
  totalCount: number;
  successCount: number;
  failedCount: number;
  confirmedCount: number;
  status: BatchStatus;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  remark?: string;
}

export interface TenantAccount {
  id: string;
  tenantId: string;
  tenantName: string;
  contact: string;
  phone?: string;
  email?: string;
  webhookUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface NotificationReceipt {
  id: string;
  batchId: string;
  tenantId: string;
  channel: NotificationChannel;
  target: string;
  status: ReceiptStatus;
  sentAt?: number;
  deliveredAt?: number;
  confirmedAt?: number;
  failedAt?: number;
  failReason?: string;
  retryCount: number;
  maxRetry: number;
  receiptIdempotentKey: string;
  originalInput: Record<string, any>;
  processingBasis: string;
  finalConclusion?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ResendRecord {
  id: string;
  receiptId: string;
  batchId: string;
  tenantId: string;
  channel: NotificationChannel;
  target: string;
  status: ResendStatus;
  resendCount: number;
  maxResend: number;
  lastResendAt?: number;
  nextResendAt?: number;
  originalReceiptId: string;
  failReason?: string;
  originalInput: Record<string, any>;
  processingBasis: string;
  createdAt: number;
  updatedAt: number;
}

export interface ReachSummary {
  id: string;
  batchId: string;
  channel: NotificationChannel;
  totalSent: number;
  totalDelivered: number;
  totalConfirmed: number;
  totalFailed: number;
  totalTimeout: number;
  totalResent: number;
  deliveryRate: number;
  confirmationRate: number;
  failureRate: number;
  calculatedAt: number;
}

export interface CreateBatchRequest {
  title: string;
  content: string;
  channel: NotificationChannel;
  tenants: Array<{
    tenantId: string;
    tenantName: string;
    target: string;
    contact?: string;
  }>;
  createdBy: string;
  remark?: string;
  maxRetry?: number;
  confirmTimeout?: number;
}

export interface QueryReceiptRequest {
  batchId?: string;
  tenantId?: string;
  status?: ReceiptStatus;
  channel?: NotificationChannel;
  page?: number;
  pageSize?: number;
  startAt?: number;
  endAt?: number;
}

export interface ReceiptConfirmRequest {
  receiptId: string;
  confirmedBy?: string;
  confirmedAt?: number;
}

export interface ManualCorrectRequest {
  receiptId: string;
  targetStatus: ReceiptStatus;
  reason: string;
  operator: string;
}

export interface ResendRequest {
  receiptIds: string[];
  channel?: NotificationChannel;
  target?: string;
  operator: string;
  remark?: string;
}
