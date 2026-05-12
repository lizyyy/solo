export enum OrderStatus {
  PENDING = 'pending',
  WEIGHING = 'weighing',
  WEIGHED = 'weighed',
  OUTBOUND = 'outbound',
  CANCELLED = 'cancelled'
}

export enum WeightRecordStatus {
  DRAFT = 'draft',
  CONFIRMED = 'confirmed',
  SUPERSEDED = 'superseded'
}

export enum RefundStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSED = 'processed'
}

export enum RefundReason {
  WEIGHT_DIFFERENCE = 'weight_difference',
  ITEM_REPLACED = 'item_replaced',
  ITEM_MISSING = 'item_missing',
  QUALITY_ISSUE = 'quality_issue'
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitPrice: number;
  unit: 'kg' | 'g' | 'piece';
  isFresh: boolean;
  tolerancePercentage: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  expectedWeight: number;
  actualWeight: number | null;
  unitPrice: number;
  expectedAmount: number;
  actualAmount: number | null;
  isReplaced: boolean;
  replacedProductId: string | null;
  replacedProductName: string | null;
  weightRecordId: string | null;
  status: 'pending' | 'weighed' | 'cancelled';
}

export interface Order {
  id: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  status: OrderStatus;
  items: OrderItem[];
  totalExpectedAmount: number;
  totalActualAmount: number | null;
  totalWeightDifference: number | null;
  totalRefundAmount: number | null;
  hasRefund: boolean;
  hasReplacement: boolean;
  outboundTime: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WeightRecord {
  id: string;
  orderId: string;
  orderItemId: string;
  batchNo: string;
  actualWeight: number;
  operatorId: string;
  operatorName: string;
  weighTime: Date;
  status: WeightRecordStatus;
  previousRecordId: string | null;
  deviceId: string;
  requestId: string;
}

export interface RefundRecord {
  id: string;
  orderId: string;
  orderItemId: string | null;
  reason: RefundReason;
  reasonDetail: string;
  amount: number;
  status: RefundStatus;
  operatorId: string;
  operatorName: string;
  createdAt: Date;
  processedAt: Date | null;
}

export interface WeightDifferenceSummary {
  orderId: string;
  orderNo: string;
  totalItems: number;
  weighedItems: number;
  pendingItems: number;
  totalExpectedWeight: number;
  totalActualWeight: number;
  totalWeightDifference: number;
  differencePercentage: number;
  totalExpectedAmount: number;
  totalActualAmount: number;
  totalRefundAmount: number;
  hasAbnormalWeight: boolean;
  hasHighValueReplacement: boolean;
  abnormalItems: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  code: number;
  message: string;
  data?: T;
  errors?: string[];
}
