export enum SaleStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REVERSED = 'reversed'
}

export enum BatchStatus {
  CREATED = 'created',
  SYNCING = 'syncing',
  PARTIAL = 'partial',
  COMPLETED = 'completed',
  HAS_ERRORS = 'has_errors'
}

export enum ExceptionType {
  DUPLICATE_DIFF_CONTENT = 'duplicate_diff_content',
  INVENTORY_SHORTAGE = 'inventory_shortage',
  REFUND_BEFORE_SALE = 'refund_before_sale',
  POINTS_DUPLICATE = 'points_duplicate',
  CONTENT_MISMATCH = 'content_mismatch',
  TIMESTAMP_ANOMALY = 'timestamp_anomaly'
}

export enum PaymentType {
  CASH = 'cash',
  WECHAT = 'wechat',
  ALIPAY = 'alipay',
  MEMBER_CARD = 'member_card',
  COUPON = 'coupon'
}

export interface SaleItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface PaymentRecord {
  paymentId: string;
  type: PaymentType;
  amount: number;
  transactionNo?: string;
  status: 'success' | 'failed' | 'pending';
}

export interface RefundRecord {
  refundId: string;
  saleOrderNo: string;
  amount: number;
  reason: string;
  operator: string;
  refundTime: string;
}

export interface MemberInfo {
  memberId: string;
  phone?: string;
  name?: string;
  pointsEarned: number;
  pointsUsed: number;
}

export interface SaleOrder {
  orderNo: string;
  batchId: string;
  cashierNo: string;
  terminalNo: string;
  saleTime: string;
  syncTime: string;
  items: SaleItem[];
  totalAmount: number;
  discountAmount: number;
  payAmount: number;
  payments: PaymentRecord[];
  refund?: RefundRecord;
  member?: MemberInfo;
  status: SaleStatus;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  errorMessage?: string;
  contentHash: string;
}

export interface SyncBatch {
  batchId: string;
  terminalNo: string;
  startTime: string;
  endTime: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  status: BatchStatus;
  createdAt: string;
  completedAt?: string;
}

export interface Inventory {
  sku: string;
  name: string;
  quantity: number;
  warehouse: string;
  lastUpdated: string;
}

export interface MemberPointsLog {
  logId: string;
  memberId: string;
  orderNo: string;
  points: number;
  type: 'earn' | 'spend';
  createdAt: string;
}

export interface ExceptionOrder {
  exceptionId: string;
  orderNo: string;
  batchId: string;
  type: ExceptionType;
  message: string;
  detail: Record<string, any>;
  createdAt: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface OfflineSyncRequest {
  batchId: string;
  terminalNo: string;
  startTime: string;
  endTime: string;
  orders: Array<{
    orderNo: string;
    cashierNo: string;
    terminalNo: string;
    saleTime: string;
    items: SaleItem[];
    totalAmount: number;
    discountAmount: number;
    payAmount: number;
    payments: PaymentRecord[];
    refund?: RefundRecord;
    member?: MemberInfo;
  }>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  code: string;
  message: string;
  data?: T;
}
