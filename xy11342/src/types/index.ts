export interface BaseEntity {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  createdRole?: string;
}

export type PickupStatus = 'pending' | 'picked' | 'returned' | 'abnormal';
export type RepairStatus = 'pending' | 'processing' | 'completed' | 'abnormal';
export type ClaimStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
export type OldPartReturned = 'yes' | 'no' | 'partial';
export type ImportType = 'pickup' | 'repair' | 'claim-rule';
export type ErrorStatus = 'pending' | 'fixed' | 'ignored';
export type UserRole = 'admin' | 'engineer' | 'claim-specialist';

export interface PickupOrder extends BaseEntity {
  orderNo: string;
  engineerId?: string;
  engineerName: string;
  partCode?: string;
  partName: string;
  quantity: number;
  pickupDate: string;
  status: PickupStatus;
  remark?: string;
}

export interface RepairOrder extends BaseEntity {
  repairNo: string;
  pickupOrderId?: string;
  customerName: string;
  customerPhone?: string;
  faultType: string;
  faultDescription?: string;
  repairDate?: string;
  engineerId?: string;
  engineerName: string;
  oldPartReturned: OldPartReturned;
  status: RepairStatus;
}

export interface ClaimOrder extends BaseEntity {
  claimNo: string;
  repairOrderId: string;
  ruleId: string;
  claimAmount: number;
  status: ClaimStatus;
  submitDate?: string;
  approveDate?: string;
  rejectReason?: string;
}

export interface ClaimRule {
  id: string;
  ruleName: string;
  faultType: string;
  amount: number;
  conditions: string;
  isActive: boolean;
  createdAt?: string;
}

export interface ImportError {
  id: string;
  importType: ImportType;
  rowNumber: number;
  originalData: Record<string, any>;
  errorReason: string;
  suggestion: string;
  status: ErrorStatus;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  module: string;
  action: string;
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  operateTime: string;
  detail: Record<string, any>;
}

export interface BatchResult<T> {
  success: number;
  failed: number;
  total: number;
  successItems: T[];
  failedItems: { item: Record<string, any>; error: string; suggestion?: string }[];
}

export interface FilterParams {
  operator?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  abnormalType?: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
}
