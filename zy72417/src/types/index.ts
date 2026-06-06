export enum ProcessingStatus {
  PENDING = 'pending',
  IMPORTED = 'imported',
  TUNER_REVIEWED = 'tuner_reviewed',
  VERIFICATION_REQUIRED = 'verification_required',
  MANAGER_REVIEWED = 'manager_reviewed',
  WRITE_OFF_UPDATED = 'write_off_updated',
  COMPLETED = 'completed',
  ABNORMAL = 'abnormal'
}

export enum SelfCheckType {
  DUPLICATE_IMPORT = 'duplicate_import',
  MISSING_CITY = 'missing_city',
  RECALCULATION_AFTER_SUPPLEMENT = 'recalculation_after_supplement',
  EXPORT_CONSISTENCY = 'export_consistency'
}

export enum SelfCheckResult {
  PASS = 'pass',
  FAIL = 'fail',
  WARNING = 'warning'
}

export interface AuthorizedCity {
  province: string;
  city: string;
}

export interface AuthorizationTerm {
  id: string;
  originalRowNumber: number;
  importBatchId: string;
  bandName: string;
  equipmentType: string;
  equipmentModel: string;
  authorizationStartDate: string;
  authorizationEndDate: string;
  authorizedCities: AuthorizedCity[];
  originalAuthorizedCitiesText: string;
  repairFee: number;
  originalRepairFee: number;
  status: ProcessingStatus;
  tunerMessageId?: string;
  writeOffId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  version: number;
}

export interface ChangeRecord {
  id: string;
  authorizationTermId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
  changeReason: string;
  version: number;
}

export interface TunerMessage {
  id: string;
  authorizationTermId: string;
  content: string;
  tunerName: string;
  reviewedBy?: string;
  reviewedAt?: string;
  isReviewed: boolean;
  createdAt: string;
}

export interface EquipmentRepairOrder {
  id: string;
  authorizationTermId: string;
  orderNumber: string;
  repairItems: string[];
  repairDate: string;
  technician: string;
  actualCost: number;
  status: ProcessingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WriteOffRecord {
  id: string;
  authorizationTermId: string;
  writeOffNumber: string;
  courseHours: number;
  unitPrice: number;
  totalAmount: number;
  writeOffDate: string;
  operator: string;
  status: ProcessingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SelfCheckRecord {
  id: string;
  checkType: SelfCheckType;
  checkName: string;
  authorizationTermId?: string;
  result: SelfCheckResult;
  description: string;
  detail?: any;
  checkedAt: string;
  checkedBy: string;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  importedBy: string;
  importedAt: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  status: ProcessingStatus;
}

export interface UnifiedDataSource {
  authorizationTerms: AuthorizationTerm[];
  changeRecords: ChangeRecord[];
  tunerMessages: TunerMessage[];
  repairOrders: EquipmentRepairOrder[];
  writeOffRecords: WriteOffRecord[];
  selfCheckRecords: SelfCheckRecord[];
  importBatches: ImportBatch[];
}

export type ViewMode = 'detail' | 'list' | 'export';
