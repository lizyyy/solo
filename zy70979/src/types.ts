export type MaterialStatus = 'normal' | 'pending' | 'blocked';

export interface Batch {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  status: 'processing' | 'completed';
  totalCount: number;
  normalCount: number;
  pendingCount: number;
  blockedCount: number;
}

export interface Material {
  id: string;
  batchId: string;
  orderNo: string;
  equipmentSerial: string;
  customerName: string;
  rentalStartDate: string;
  rentalEndDate: string;
  depositAmount: number;
  actualReturnDate?: string;
  repairCost?: number;
  overdueDays?: number;
  overdueFee?: number;
  deductionAmount?: number;
  status: MaterialStatus;
  statusReason: string;
  nextAction: string;
  processedBy?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Equipment {
  serialNumber: string;
  name: string;
  model: string;
  currentStatus: 'rented' | 'available' | 'repairing' | 'retired';
  currentRentalId?: string;
  totalRentalCount: number;
  totalRepairCost: number;
  lastMaintenanceDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RentalOrder {
  id: string;
  orderNo: string;
  equipmentSerial: string;
  customerName: string;
  startDate: string;
  endDate: string;
  actualReturnDate?: string;
  depositAmount: number;
  status: 'active' | 'returned' | 'closed';
  createdAt: string;
  closedAt?: string;
}

export interface ProcessingRecord {
  id: string;
  materialId: string;
  previousStatus: MaterialStatus;
  newStatus: MaterialStatus;
  previousReason: string;
  newReason: string;
  previousDeduction?: number;
  newDeduction?: number;
  changedBy: string;
  changeReason: string;
  createdAt: string;
}

export interface DeductionRecord {
  id: string;
  materialId: string;
  orderNo: string;
  equipmentSerial: string;
  deductionType: 'overdue' | 'repair' | 'damage' | 'other';
  amount: number;
  reason: string;
  processedBy: string;
  isDuplicate: boolean;
  duplicateOf?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  entityType: 'material' | 'batch' | 'deduction';
  entityId: string;
  action: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  operator: string;
  reason: string;
  createdAt: string;
}

export interface CreateBatchRequest {
  name: string;
  createdBy: string;
}

export interface RegisterMaterialRequest {
  batchId: string;
  orderNo: string;
  equipmentSerial: string;
  customerName: string;
  rentalStartDate: string;
  rentalEndDate: string;
  depositAmount: number;
  actualReturnDate?: string;
  repairCost?: number;
  equipmentName?: string;
  equipmentModel?: string;
}

export interface ReclassifyRequest {
  materialId: string;
  newStatus: MaterialStatus;
  newReason: string;
  newDeduction?: number;
  operator: string;
  changeReason: string;
}

export interface ExportFilter {
  batchId?: string;
  status?: MaterialStatus;
  startDate?: string;
  endDate?: string;
}
