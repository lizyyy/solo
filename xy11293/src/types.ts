export enum EquipmentType {
  TRUSS = 'truss',
  LIGHT = 'light',
  SCREEN = 'screen'
}

export enum RecordStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  RETURNED = 'returned',
  DAMAGED = 'damaged',
  LOST = 'lost'
}

export enum OperationType {
  IMPORT = 'import',
  OCCUPY = 'occupy',
  TRANSFER = 'transfer',
  RETURN = 'return',
  DAMAGE = 'damage',
  ADJUST = 'adjust'
}

export interface SensitiveFieldConfig {
  fields: string[];
  maskPattern: string;
  roles: string[];
}

export interface Equipment {
  id: string;
  type: EquipmentType;
  name: string;
  spec: string;
  totalQuantity: number;
  availableQuantity: number;
  unit: string;
  pricePerDay?: number;
  supplier?: string;
  lastUpdated: string;
}

export interface Booth {
  id: string;
  boothNumber: string;
  companyName: string;
  contactPerson?: string;
  contactPhone?: string;
  area?: number;
  notes?: string;
  createdAt: string;
}

export interface RentalRecordItem {
  equipmentId: string;
  equipmentType: EquipmentType;
  equipmentName: string;
  quantity: number;
  unit: string;
}

export interface RentalRecord {
  id: string;
  requestId: string;
  boothId: string;
  boothNumber: string;
  items: RentalRecordItem[];
  status: RecordStatus;
  operationType: OperationType;
  requestedBy: string;
  requestedAt: string;
  confirmedAt?: string;
  returnedAt?: string;
  expectedReturnDate?: string;
  actualReturnDate?: string;
  transferFromBoothId?: string;
  transferToBoothId?: string;
  damageType?: string;
  damageDescription?: string;
  damageQuantity?: number;
  notes?: string;
  rejectionReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  operationType: OperationType;
  recordId?: string;
  boothId?: string;
  equipmentId?: string;
  operator: string;
  operatorRole: string;
  timestamp: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  ipAddress?: string;
  userAgent?: string;
}

export interface InventorySnapshot {
  id: string;
  timestamp: string;
  equipment: Equipment[];
  totalValue: number;
  createdBy: string;
}

export interface Database {
  version: string;
  lastModified: string;
  equipment: Equipment[];
  booths: Booth[];
  rentalRecords: RentalRecord[];
  auditLogs: AuditLog[];
  snapshots: InventorySnapshot[];
  requestIds: string[];
}

export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
  requestId: string;
  isDuplicate: boolean;
}

export interface UserContext {
  userId: string;
  userName: string;
  role: string;
  permissions: string[];
}
