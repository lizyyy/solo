export type AlertLevel = 'normal' | 'low' | 'medium' | 'high' | 'critical';
export type BatchStatus = 'active' | 'frozen' | 'disposed';

export interface Product {
  id: string;
  name: string;
  sku: string;
  ownerId: string;
  ownerName: string;
  alertRules: AlertRules;
}

export interface AlertRules {
  lowDays: number;
  mediumDays: number;
  highDays: number;
  criticalDays: number;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
}

export interface Batch {
  id: string;
  batchNumber: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  availableQuantity: number;
  frozenQuantity: number;
  inDate: Date;
  status: BatchStatus;
  lastAlertDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transfer {
  id: string;
  batchId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  transferDate: Date;
  operatorId: string;
  createdAt: Date;
}

export interface Freeze {
  id: string;
  batchId: string;
  quantity: number;
  reason: string;
  freezeDate: Date;
  operatorId: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Unfreeze {
  id: string;
  freezeId: string;
  batchId: string;
  quantity: number;
  unfreezeDate: Date;
  operatorId: string;
  createdAt: Date;
}

export interface InventoryLoss {
  id: string;
  batchId: string;
  quantity: number;
  reason: string;
  lossDate: Date;
  operatorId: string;
  createdAt: Date;
}

export interface Disposal {
  id: string;
  batchId: string;
  quantity: number;
  reason: string;
  disposalDate: Date;
  operatorId: string;
  createdAt: Date;
}

export interface Alert {
  id: string;
  batchId: string;
  level: AlertLevel;
  batchAgeDays: number;
  alertDate: Date;
  isResolved: boolean;
  createdAt: Date;
}

export interface BatchAlertInfo {
  batchId: string;
  batchNumber: string;
  productId: string;
  productName: string;
  sku: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  availableQuantity: number;
  frozenQuantity: number;
  inDate: Date;
  batchAgeDays: number;
  alertLevel: AlertLevel;
  status: BatchStatus;
  ownerId: string;
  ownerName: string;
  lastAlertDate?: Date;
}

export interface OwnerTodoSummary {
  ownerId: string;
  ownerName: string;
  totalPending: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  batches: BatchAlertInfo[];
}

export interface AlertQueryResult {
  pendingAlerts: BatchAlertInfo[];
  ownerSummaries: OwnerTodoSummary[];
  totalPending: number;
}
