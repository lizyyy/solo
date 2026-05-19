export enum PrescriptionStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  REVIEWING = 'reviewing',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  BLOCKED = 'blocked',
  DISPENSED = 'dispensed'
}

export enum InventoryStatus {
  IN_STOCK = 'in_stock',
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
  EXPIRED = 'expired'
}

export enum AuditAction {
  SUBMIT = 'submit',
  REVIEW = 'review',
  APPROVE = 'approve',
  REJECT = 'reject',
  BLOCK = 'block',
  DISPENSE = 'dispense',
  IMPORT = 'import',
  UPDATE = 'update',
  DELETE = 'delete'
}

export interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  weight: number;
  weightUnit: 'kg' | 'g' | 'lb';
  age?: number;
  ownerId: string;
}

export interface Medicine {
  id: string;
  code: string;
  name: string;
  genericName?: string;
  category: string;
  unit: string;
  manufacturer: string;
  isControlled: boolean;
  requiresPrescription: boolean;
  minDose?: number;
  maxDose?: number;
  doseUnit?: string;
  dosePerWeight?: number;
  createdAt: number;
  updatedAt: number;
}

export interface InventoryBatch {
  id: string;
  medicineId: string;
  batchNumber: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  manufactureDate: string;
  expiryDate: string;
  status: InventoryStatus;
  location?: string;
  supplier?: string;
  importedAt: number;
}

export interface DosageRule {
  id: string;
  medicineId: string;
  species: string;
  minWeight: number;
  maxWeight: number;
  weightUnit: 'kg' | 'g' | 'lb';
  dosageAmount: number;
  dosageUnit: string;
  frequency: string;
  duration?: string;
  notes?: string;
  createdAt: number;
}

export interface PrescriptionItem {
  id: string;
  prescriptionId: string;
  medicineId: string;
  medicineName: string;
  batchId?: string;
  batchNumber?: string;
  requestedQuantity: number;
  dispensedQuantity: number;
  unit: string;
  dosage: string;
  dosageCalculation?: {
    weight: number;
    weightUnit: string;
    baseDose: number;
    calculatedDose: number;
    doseUnit: string;
    ruleId?: string;
  };
  notes?: string;
}

export interface Prescription {
  id: string;
  prescriptionNumber: string;
  doctorId: string;
  doctorName: string;
  petId: string;
  petName: string;
  petSpecies: string;
  petWeight: number;
  petWeightUnit: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  diagnosis: string;
  items: PrescriptionItem[];
  status: PrescriptionStatus;
  totalAmount: number;
  notes?: string;
  rejectionReason?: string;
  blockReason?: string;
  submittedAt?: number;
  reviewedAt?: number;
  approvedAt?: number;
  dispensedAt?: number;
  createdAt: number;
  updatedAt: number;
  importId?: string;
}

export interface AuditLog {
  id: string;
  entityType: 'prescription' | 'inventory' | 'medicine' | 'dosage_rule';
  entityId: string;
  action: AuditAction;
  operatorId: string;
  operatorName: string;
  oldValue?: string;
  newValue?: string;
  notes?: string;
  timestamp: number;
}

export interface BadRecord {
  id: string;
  importId: string;
  importType: 'prescription' | 'inventory' | 'dosage_rule';
  sourceFile: string;
  rowNumber: number;
  columnName?: string;
  originalData: string;
  failureReason: string;
  suggestedFix: string;
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
  createdAt: number;
}

export interface ImportSession {
  id: string;
  importType: 'prescription' | 'inventory' | 'dosage_rule';
  sourceFile: string;
  fileHash: string;
  totalRecords: number;
  successCount: number;
  failureCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  operatorId: string;
  operatorName: string;
}

export interface SensitiveFieldConfig {
  entity: string;
  field: string;
  maskType: 'phone' | 'idcard' | 'name' | 'email' | 'custom';
  maskPattern?: string;
  exportMasked: boolean;
  logMasked: boolean;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}