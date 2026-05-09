export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  requestId?: string;
  timestamp: string;
  errors?: any;
}

export interface PaginationData<T> {
  [key: string]: any;
  items: T[];
  total: number;
}

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';
  storeId?: string;
  lastLogin?: string;
}

export interface Store {
  id: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  manager?: string;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  barcode?: string;
  category?: string;
  unit: string;
  spec?: string;
  basePrice: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Inventory {
  id: string;
  storeId: string;
  productId: string;
  quantity: number;
  availableQty: number;
  lockedQty: number;
  price: number;
  version: number;
  isActive: boolean;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
  product?: Product;
  store?: Store;
}

export interface InventoryRecord {
  id: string;
  inventoryId: string;
  storeId: string;
  productId: string;
  operationType: string;
  quantityBefore: number;
  quantityAfter: number;
  changeQuantity: number;
  priceBefore?: number;
  priceAfter?: number;
  referenceId?: string;
  referenceType?: string;
  operatorId: string;
  operatorName: string;
  remark?: string;
  createdAt: string;
  product?: Product;
}

export interface TransferOrder {
  id: string;
  orderNo: string;
  sourceStoreId: string;
  targetStoreId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REVERTED' | 'FAILED';
  totalQuantity: number;
  totalAmount: number;
  operatorId?: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  sourceStore?: Store;
  targetStore?: Store;
  items?: TransferItem[];
  operator?: { id: string; name: string };
}

export interface TransferItem {
  id: string;
  transferOrderId: string;
  productId: string;
  quantity: number;
  price: number;
  amount: number;
  createdAt: string;
  product?: Product;
}

export interface AuditLog {
  id: string;
  requestId?: string;
  operation: string;
  entity: string;
  entityId?: string;
  entityName?: string;
  beforeSnapshot?: any;
  afterSnapshot?: any;
  changedFields?: string[];
  userId?: string;
  operatorName?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  remark?: string;
  parentLogId?: string;
}
