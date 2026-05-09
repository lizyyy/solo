export enum UserRole {
  ADMIN = 'admin',
  CUSTOMER_SERVICE = 'customer_service',
  NORMAL = 'normal'
}

export enum ReissueStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  STATUS_CHANGE = 'status_change',
  DELETE = 'delete',
  IMPORT = 'import',
  EXPORT = 'export',
  RETRY = 'retry',
  LOGIN = 'login',
  LOGOUT = 'logout'
}

export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface ReissueOrder {
  id: string;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  productName: string;
  productSku: string;
  quantity: number;
  reason: string;
  description: string;
  status: ReissueStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  trackingNo: string | null;
  shippingCompany: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ReissueHistory {
  id: string;
  orderId: string;
  beforeStatus: ReissueStatus | null;
  afterStatus: ReissueStatus;
  changeReason: string | null;
  operatorId: string;
  operatorName: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  operationType: OperationType;
  targetType: string;
  targetId: string | null;
  userId: string;
  userName: string;
  detail: string;
  ip: string;
  userAgent: string;
  createdAt: string;
  success: boolean;
  errorMessage: string | null;
}

export interface FailedOperation {
  id: string;
  operationType: string;
  targetId: string;
  errorMessage: string;
  retryCount: number;
  maxRetries: number;
  lastAttemptAt: string;
  createdAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReissueQueryParams {
  status?: ReissueStatus;
  orderNo?: string;
  customerName?: string;
  customerPhone?: string;
  assigneeId?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
}

export interface Response<T> {
  success: boolean;
  data?: T;
  error?: string;
}
