export type MaterialType = 'truss' | 'light' | 'screen';

export type OperationType = 
  | 'import' 
  | 'occupy' 
  | 'transfer' 
  | 'return' 
  | 'damage' 
  | 'rollback';

export type AuditResult = 'approved' | 'rejected' | 'duplicate';

export interface Operator {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'operator';
  phone?: string;
}

export interface Material {
  id: string;
  code: string;
  type: MaterialType;
  name: string;
  specs: string;
  totalQuantity: number;
  availableQuantity: number;
  status: 'normal' | 'damaged' | 'maintenance';
  createdAt: number;
  updatedAt: number;
}

export interface Booth {
  id: string;
  code: string;
  name: string;
  exhibitor: string;
  contact?: string;
  createdAt: number;
}

export interface BorrowRecord {
  id: string;
  requestId: string;
  materialId: string;
  materialCode: string;
  fromBoothId: string | null;
  toBoothId: string;
  quantity: number;
  status: 'pending' | 'approved' | 'returned' | 'damaged' | 'rolled_back';
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  operationType: OperationType;
  reason: string;
  createdAt: number;
  updatedAt: number;
  returnedAt?: number;
  damagedQuantity?: number;
}

export interface AuditLog {
  id: string;
  requestId: string;
  operationType: OperationType;
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  result: AuditResult;
  reason: string;
  requestData: string;
  responseData: string;
  timestamp: number;
}

export interface IdempotentRequest {
  requestId: string;
  operationType: OperationType;
  operatorId: string;
  status: 'processing' | 'completed' | 'failed';
  resultData: string;
  createdAt: number;
  completedAt?: number;
}

export interface DamageReport {
  id: string;
  recordId: string;
  materialId: string;
  boothId: string;
  quantity: number;
  damageType: 'broken' | 'lost' | 'worn';
  description: string;
  deductionAmount: number;
  operatorId: string;
  createdAt: number;
}
