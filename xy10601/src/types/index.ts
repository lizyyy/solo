export enum OrderStatus {
  CREATED = 'CREATED',
  CONFIRMED = 'CONFIRMED',
  PAID = 'PAID',
  PICKING = 'PICKING',
  PICKED = 'PICKED',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDING = 'REFUNDING',
  REFUNDED = 'REFUNDED',
  OUT_OF_STOCK = 'OUT_OF_STOCK'
}

export enum TimelineEventType {
  ORDER_CREATED = 'ORDER_CREATED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  REPLACEMENT_CONFIRMED = 'REPLACEMENT_CONFIRMED',
  REFUND_REQUESTED = 'REFUND_REQUESTED',
  REFUND_CALLBACK = 'REFUND_CALLBACK',
  INVENTORY_BLOCKED = 'INVENTORY_BLOCKED',
  INVENTORY_RELEASED = 'INVENTORY_RELEASED',
  PICKING_STARTED = 'PICKING_STARTED',
  PICKING_COMPLETED = 'PICKING_COMPLETED',
  PICKING_RECORD = 'PICKING_RECORD',
  OUT_OF_STOCK_DETECTED = 'OUT_OF_STOCK_DETECTED',
  ORDER_MODIFIED = 'ORDER_MODIFIED',
  REPORT_GENERATED = 'REPORT_GENERATED'
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  availableStock: number;
  blockedStock: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  price: number;
  amount: number;
  status: 'NORMAL' | 'REPLACED' | 'REFUNDED' | 'OUT_OF_STOCK';
  replacementProductId?: string;
  replacementProductName?: string;
  refundAmount?: number;
}

export interface Order {
  id: string;
  orderNo: string;
  communityId: string;
  communityName: string;
  groupLeaderId: string;
  groupLeaderName: string;
  userId: string;
  userName: string;
  phone: string;
  address: string;
  items: OrderItem[];
  totalAmount: number;
  actualAmount: number;
  refundAmount: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  modifiedHistory: ModifiedRecord[];
}

export interface ModifiedRecord {
  id: string;
  orderId: string;
  type: 'ORDER' | 'REPLACEMENT' | 'REFUND';
  field: string;
  oldValue: string;
  newValue: string;
  operatorId: string;
  operatorName: string;
  reason?: string;
  timestamp: string;
}

export interface TimelineEvent {
  id: string;
  orderId: string;
  eventType: TimelineEventType;
  eventName: string;
  description: string;
  operatorId?: string;
  operatorName?: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface RefundCallback {
  id: string;
  orderId: string;
  orderItemId?: string;
  callbackId: string;
  refundAmount: number;
  status: 'SUCCESS' | 'FAILED';
  processed: boolean;
  processedAt?: string;
  receivedAt: string;
}

export interface OutOfStockItem {
  id: string;
  orderId: string;
  orderItemId: string;
  productId: string;
  productName: string;
  sku: string;
  requestedQuantity: number;
  availableQuantity: number;
  shortageQuantity: number;
  detectedAt: string;
  resolved: boolean;
  resolution?: 'REPLACEMENT' | 'REFUND' | 'WAIT';
}

export interface PickingRecord {
  id: string;
  orderId: string;
  orderItemId: string;
  productId: string;
  productName: string;
  sku: string;
  pickedQuantity: number;
  operatorId: string;
  operatorName: string;
  pickedAt: string;
  notes?: string;
}

export interface ReportData {
  orderId: string;
  orderNo: string;
  communityName: string;
  groupLeaderName: string;
  events: {
    eventType: TimelineEventType;
    eventName: string;
    description: string;
    operatorId?: string;
    operatorName?: string;
    timestamp: string;
    responsiblePerson: string;
    responsibleRole: string;
  }[];
  totalAmount: number;
  refundAmount: number;
  outOfStockCount: number;
  generatedAt: string;
}

export interface ReportFilter {
  operatorId?: string;
  operatorName?: string;
  startTime?: string;
  endTime?: string;
  eventType?: TimelineEventType;
}
