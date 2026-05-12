export type TicketStatus = 
  | 'CREATED'
  | 'PAID'
  | 'TRANSFERRED'
  | 'REFUNDED'
  | 'PARTIALLY_USED'
  | 'USED'
  | 'EXPIRED'
  | 'CANCELLED';

export type TransferStatus = 
  | 'PENDING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export type RefundStatus = 
  | 'REQUESTED'
  | 'APPROVED'
  | 'COMPLETED'
  | 'REJECTED';

export type ValidationSource = 
  | 'ONLINE'
  | 'OFFLINE';

export type ValidationStatus = 
  | 'SUCCESS'
  | 'FAILED'
  | 'DUPLICATE'
  | 'PENDING_OFFLINE';

export interface Ticket {
  id: string;
  ticketCode: string;
  eventId: string;
  eventName: string;
  holderId: string;
  holderName: string;
  originalHolderId: string;
  originalHolderName: string;
  ticketType: 'SINGLE' | 'PACKAGE_PARENT' | 'PACKAGE_CHILD';
  packageId: string | null;
  packageName: string | null;
  packageSequence: number | null;
  packageTotal: number | null;
  price: number;
  status: TicketStatus;
  createdAt: number;
  updatedAt: number;
  validFrom: number;
  validUntil: number;
}

export interface TicketTransfer {
  id: string;
  ticketId: string;
  fromHolderId: string;
  fromHolderName: string;
  toHolderId: string;
  toHolderName: string;
  status: TransferStatus;
  requestTime: number;
  completedTime: number | null;
  reason: string | null;
}

export interface TicketRefund {
  id: string;
  ticketId: string;
  holderId: string;
  status: RefundStatus;
  requestTime: number;
  completedTime: number | null;
  reason: string;
  refundAmount: number;
}

export interface ValidationRecord {
  id: string;
  ticketId: string;
  ticketCode: string;
  holderId: string;
  holderName: string;
  source: ValidationSource;
  gateId: string;
  gateName: string;
  offlinePackageId: string | null;
  validationTime: number;
  serverTime: number;
  status: ValidationStatus;
  failureReason: string | null;
  requestId: string;
}

export interface OfflinePackage {
  id: string;
  packageId: string;
  gateId: string;
  gateName: string;
  operatorId: string;
  validFrom: number;
  validUntil: number;
  uploadedAt: number | null;
  uploadStatus: 'PENDING' | 'UPLOADED' | 'EXPIRED';
  validationCount: number;
  successCount: number;
  failedCount: number;
}

export interface OfflineValidationItem {
  id: string;
  packageId: string;
  ticketCode: string;
  gateId: string;
  validationTime: number;
  processed: boolean;
  processedResult: ValidationStatus | null;
  failureReason: string | null;
}

export interface AuditLog {
  id: string;
  ticketId: string | null;
  transferId: string | null;
  refundId: string | null;
  validationId: string | null;
  operatorId: string;
  operatorName: string;
  action: string;
  beforeState: Record<string, any> | null;
  afterState: Record<string, any> | null;
  diff: string[];
  reason: string;
  timestamp: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  requestId: string;
  timestamp: number;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IdempotentRequest {
  id: string;
  key: string;
  endpoint: string;
  requestBody: Record<string, any>;
  responseBody: Record<string, any> | null;
  createdAt: number;
  completedAt: number | null;
}
