export enum EquipmentBrand {
  BURTON = 'BURTON',
  SALOMON = 'SALOMON',
  ROSSIGNOL = 'ROSSIGNOL',
  HEAD = 'HEAD',
  NITRO = 'NITRO',
  CAPITA = 'CAPITA',
  RIDE = 'RIDE',
  K2 = 'K2'
}

export enum EquipmentType {
  SNOWBOARD = 'SNOWBOARD',
  SKI = 'SKI',
  BOOTS = 'BOOTS',
  BINDINGS = 'BINDINGS',
  HELMET = 'HELMET',
  GOGGLES = 'GOGGLES'
}

export enum SnowboardLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT'
}

export enum RentalStatus {
  AVAILABLE = 'AVAILABLE',
  RENTED = 'RENTED',
  MAINTENANCE = 'MAINTENANCE',
  RETIRED = 'RETIRED',
  LOST = 'LOST'
}

export enum AdjustmentStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum AdjustmentType {
  SIZE_EXCHANGE = 'SIZE_EXCHANGE',
  EQUIPMENT_EXCHANGE = 'EQUIPMENT_EXCHANGE',
  DAMAGE_REPLACEMENT = 'DAMAGE_REPLACEMENT',
  CUSTOMER_REQUEST = 'CUSTOMER_REQUEST'
}

export enum ReconciliationStatus {
  MATCHED = 'MATCHED',
  UNMATCHED = 'UNMATCHED',
  PENDING = 'PENDING'
}

export interface SnowboardEquipment {
  id: string;
  equipmentCode: string;
  rfidTag: string;
  brand: EquipmentBrand;
  model: string;
  type: EquipmentType;
  size: string;
  sizeCm: number;
  level: SnowboardLevel;
  color: string;
  purchaseDate: string;
  purchasePrice: number;
  currentStatus: RentalStatus;
  location: string;
  lastMaintenanceDate?: string;
  rentalCount: number;
  damageDescription?: string;
  isNewArrival: boolean;
  warehouseZone: string;
  shelfNumber: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  phone: string;
  idCard: string;
  memberLevel: string;
  heightCm?: number;
  weightKg?: number;
  shoeSize?: number;
  snowboardLevel?: SnowboardLevel;
  totalRentalCount: number;
  createdAt: string;
}

export interface RentalRecord {
  id: string;
  rentalNo: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  equipmentId: string;
  equipmentCode: string;
  equipmentType: EquipmentType;
  equipmentBrand: EquipmentBrand;
  equipmentSize: string;
  equipmentSizeCm: number;
  rentalDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  dailyRate: number;
  depositAmount: number;
  totalAmount?: number;
  status: 'RENTING' | 'RETURNED' | 'OVERDUE';
  rentalPointCode: string;
  rentalPointName: string;
  operatorId: string;
  operatorName: string;
  hasAdjustment: boolean;
  adjustmentCount: number;
  damageFoundOnReturn?: string;
  reconciliationStatus: ReconciliationStatus;
  reconciliationRemarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdjustmentRecord {
  id: string;
  adjustmentNo: string;
  rentalRecordId: string;
  rentalNo: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  adjustmentType: AdjustmentType;
  oldEquipmentId: string;
  oldEquipmentCode: string;
  oldEquipmentType: EquipmentType;
  oldEquipmentBrand: EquipmentBrand;
  oldEquipmentSize: string;
  oldEquipmentSizeCm: number;
  oldEquipmentReturnStatus: 'NOT_RETURNED' | 'RETURNED' | 'PARTIAL_RETURN';
  oldEquipmentReturnDate?: string;
  newEquipmentId: string;
  newEquipmentCode: string;
  newEquipmentType: EquipmentType;
  newEquipmentBrand: EquipmentBrand;
  newEquipmentSize: string;
  newEquipmentSizeCm: number;
  newEquipmentIssueDate: string;
  adjustmentReason: string;
  adjustmentDate: string;
  additionalCharge: number;
  depositAdjustment: number;
  status: AdjustmentStatus;
  rentalPointCode: string;
  rentalPointName: string;
  operatorId: string;
  operatorName: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewDate?: string;
  reviewRemarks?: string;
  oldEquipmentInventoryVerified: boolean;
  reconciliationVerified: boolean;
  reconciliationRemarks?: string;
  requiredMaterials: string[];
  nextActionItems: NextActionItem[];
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NextActionItem {
  action: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  requiredMaterial?: string;
  deadline?: string;
}

export interface InventoryLog {
  id: string;
  equipmentId: string;
  equipmentCode: string;
  actionType: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  quantity: number;
  referenceNo: string;
  referenceType: string;
  location: string;
  operatorId: string;
  operatorName: string;
  remarks?: string;
  createdAt: string;
}

export interface ReconciliationRecord {
  id: string;
  reconciliationDate: string;
  rentalPointCode: string;
  rentalPointName: string;
  systemRentalCount: number;
  physicalRentalCount: number;
  systemReturnCount: number;
  physicalReturnCount: number;
  differenceCount: number;
  status: ReconciliationStatus;
  mismatchedRecords: string[];
  remarks?: string;
  operatorId: string;
  operatorName: string;
  createdAt: string;
}

export interface BatchImportResult {
  successCount: number;
  failCount: number;
  totalCount: number;
  errors: ImportError[];
  batchNo: string;
}

export interface ImportError {
  rowNumber: number;
  field: string;
  value: string;
  errorMessage: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message: string;
  errorCode?: string;
  nextActions?: NextActionItem[];
  requiredMaterials?: string[];
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
