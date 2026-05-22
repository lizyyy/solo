export enum PreparationStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  REJECTED = 'rejected',
  SECOND_CONFIRM = 'second_confirm',
  AUDIT_ONLY = 'audit_only'
}

export enum UserRole {
  INSPECTOR = 'inspector',
  REPAIR_MANAGER = 'repair_manager',
  FINANCIAL = 'financial',
  AUDITOR = 'auditor',
  ADMIN = 'admin'
}

export enum RecordSource {
  INSPECTION = 'inspection',
  REPAIR_QUOTE = 'repair_quote',
  PHOTO = 'photo',
  EXTERNAL_RECEIPT = 'external_receipt'
}

export interface BaseEntity {
  id: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  updatedBy: string;
}

export interface VehicleIdentification {
  vin: string;
  plateNumber: string;
  brand: string;
  model: string;
  year: number;
  mileage: number;
}

export interface InspectionOrder extends BaseEntity, VehicleIdentification {
  source: RecordSource.INSPECTION;
  requestId: string;
  inspectionDate: number;
  inspectorName: string;
  items: InspectionItem[];
  totalCost: number;
  status: PreparationStatus;
  remarks?: string;
}

export interface InspectionItem {
  code: string;
  name: string;
  description: string;
  severity: 'minor' | 'medium' | 'major';
  estimatedCost: number;
  isRequired: boolean;
}

export interface RepairQuote extends BaseEntity, VehicleIdentification {
  source: RecordSource.REPAIR_QUOTE;
  requestId: string;
  quoteDate: number;
  repairShop: string;
  quoteManager: string;
  items: RepairItem[];
  laborCost: number;
  partsCost: number;
  totalCost: number;
  status: PreparationStatus;
  estimatedDuration: number;
  remarks?: string;
}

export interface RepairItem {
  code: string;
  name: string;
  description: string;
  partsCost: number;
  laborCost: number;
  quantity: number;
}

export interface PhotoInventory extends BaseEntity {
  source: RecordSource.PHOTO;
  requestId: string;
  vin: string;
  plateNumber: string;
  photoDate: number;
  uploader: string;
  photos: PhotoItem[];
  status: PreparationStatus;
  remarks?: string;
}

export interface PhotoItem {
  id: string;
  category: 'damage' | 'interior' | 'exterior' | 'repair_before' | 'repair_after';
  url: string;
  thumbnailUrl?: string;
  description?: string;
  uploadTime: number;
}

export interface AuditLog {
  id: string;
  requestId: string;
  source: RecordSource;
  action: string;
  oldStatus?: PreparationStatus;
  newStatus?: PreparationStatus;
  operatorId: string;
  operatorName: string;
  operatorRole: UserRole;
  changeReason?: string;
  fieldChanges?: FieldChange[];
  timestamp: number;
  ipAddress?: string;
}

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  isSensitive: boolean;
}

export interface FailedRecord {
  id: string;
  requestId: string;
  source: RecordSource;
  rawData: string;
  errorType: string;
  errorMessage: string;
  validationErrors: ValidationError[];
  receivedAt: number;
  operatorId: string;
  resolved: boolean;
  resolvedAt?: number;
  resolutionNote?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  rule: string;
}

export interface PreparationLedger {
  requestId: string;
  vin: string;
  plateNumber: string;
  brand: string;
  model: string;
  inspectionOrder?: InspectionOrder;
  repairQuote?: RepairQuote;
  photoInventory?: PhotoInventory;
  currentStatus: PreparationStatus;
  totalInspectionCost: number;
  totalRepairCost: number;
  photoCount: number;
  responsiblePerson: string;
  lastUpdated: number;
  auditTrail: AuditLog[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ValidationError[];
  requestId?: string;
  timestamp: number;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type SensitiveFieldConfig = Record<string, (value: any) => any>;
