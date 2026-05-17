export enum ArrivalStatus {
  PENDING_ARRIVAL = '待到货',
  DIFF_PENDING_CONFIRM = '差异待确认',
  CONFIRMED = '已确认',
  STOCKED = '已入库'
}

export interface PurchaseOrder {
  id: string;
  orderNo: string;
  supplierId: string;
  supplierName: string;
  materialId: string;
  materialName: string;
  orderQuantity: number;
  unit: string;
  createdAt: Date;
}

export interface ArrivalDiffRecord {
  id: string;
  orderNo: string;
  arrivalQuantity: number;
  inspectionQuantity: number;
  diffQuantity: number;
  diffDescription: string;
  status: ArrivalStatus;
  supplierId: string;
  supplierName: string;
  materialId: string;
  materialName: string;
  unit: string;
  orderQuantity: number;
  remarks: string;
  isResupplied: boolean;
  originalRecordId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HistoryRecord {
  id: string;
  recordId: string;
  action: string;
  previousStatus?: ArrivalStatus;
  newStatus?: ArrivalStatus;
  changedFields?: string[];
  operator: string;
  remark?: string;
  createdAt: Date;
}

export interface CreateDiffRecordDto {
  orderNo: string;
  arrivalQuantity: number;
  inspectionQuantity: number;
  diffDescription: string;
  supplierId: string;
  supplierName: string;
  materialId: string;
  materialName: string;
  unit: string;
  orderQuantity: number;
  remarks?: string;
  isResupplied?: boolean;
  originalRecordId?: string;
}

export interface UpdateDiffRecordDto {
  arrivalQuantity?: number;
  inspectionQuantity?: number;
  diffDescription?: string;
  status?: ArrivalStatus;
  remarks?: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  data: Record<string, any>;
  errors: string[];
}

export type ConflictType = 'OPEN_RECORD_EXISTS' | 'QUANTITY_MISMATCH' | 'STATUS_NOT_ALLOWED';

export interface ConflictCheckResult {
  hasConflict: boolean;
  type?: ConflictType;
  message: string;
  existingRecord?: ArrivalDiffRecord;
}
