export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

export interface Pesticide extends BaseEntity {
  name: string;
  registrationNumber: string;
  manufacturer: string;
  activeIngredient: string;
  concentration: string;
  formulation: string;
  category: PesticideCategory;
  toxicity: ToxicityLevel;
  storageConditions: string;
  usageInstructions: string;
}

export type PesticideCategory = 
  | 'INSECTICIDE'
  | 'FUNGICIDE'
  | 'HERBICIDE'
  | 'INSECTICIDE_FUNGICIDE'
  | 'PLANT_GROWTH_REGULATOR'
  | 'OTHER';

export type ToxicityLevel = 
  | 'EXTREMELY_TOXIC'
  | 'HIGHLY_TOXIC'
  | 'MODERATELY_TOXIC'
  | 'LOW_TOXIC'
  | 'SLIGHTLY_TOXIC'
  | 'PRACTICALLY_NON_TOXIC';

export interface Crop extends BaseEntity {
  name: string;
  scientificName: string;
  category: CropCategory;
  growthCycle: string;
  plantingSeason: string;
}

export type CropCategory = 
  | 'GRAIN'
  | 'VEGETABLE'
  | 'FRUIT'
  | 'OIL_CROP'
  | 'CASH_CROP'
  | 'OTHER';

export interface Plot extends BaseEntity {
  plotNumber: string;
  name: string;
  area: number;
  areaUnit: AreaUnit;
  location: string;
  soilType: string;
  currentCropId: string | null;
  plantingDate: Date | null;
  expectedHarvestDate: Date | null;
  status: PlotStatus;
}

export type AreaUnit = 'MU' | 'HA' | 'ACRE';
export type PlotStatus = 'AVAILABLE' | 'PLANTED' | 'HARVESTED' | 'RESTING';

export interface IntervalRule extends BaseEntity {
  pesticideId: string;
  cropId: string;
  safetyIntervalDays: number;
  maxApplicationsPerSeason: number;
  minIntervalBetweenApplications: number;
  maxDosagePerApplication: string;
  isActive: boolean;
}

export interface PesticideInventory extends BaseEntity {
  pesticideId: string;
  batchNumber: string;
  quantity: number;
  unit: InventoryUnit;
  expiryDate: Date;
  warehouse: string;
  inboundDate: Date;
  supplier: string;
}

export type InventoryUnit = 'KG' | 'L' | 'ML' | 'G' | 'BOTTLE' | 'BAG' | 'BOX';

export interface Requisition extends BaseEntity {
  requisitionNumber: string;
  applicantId: string;
  applicantName: string;
  department: string;
  intendedUseDate: Date;
  status: RequisitionStatus;
  currentStage: ApprovalStage;
  totalItems: number;
  totalQuantity: number;
  rejectionReason: string | null;
  lastProcessedById: string | null;
  lastProcessedAt: Date | null;
}

export type RequisitionStatus = 
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FULFILLED'
  | 'PARTIALLY_FULFILLED';

export type ApprovalStage = 
  | 'DRAFT'
  | 'PLOT_VERIFICATION'
  | 'INTERVAL_CHECK'
  | 'INVENTORY_CHECK'
  | 'SUPERVISOR_APPROVAL'
  | 'FINAL_APPROVAL'
  | 'COMPLETED';

export interface RequisitionItem extends BaseEntity {
  requisitionId: string;
  pesticideId: string;
  pesticideName: string;
  quantity: number;
  unit: InventoryUnit;
  usagePurpose: string;
  dosagePerUnitArea: string;
  plotId: string;
  plotName: string;
  cropId: string;
  cropName: string;
  applicationMethod: string;
  expectedApplicationDate: Date;
}

export interface ApprovalRecord extends BaseEntity {
  requisitionId: string;
  stage: ApprovalStage;
  action: ApprovalAction;
  processorId: string;
  processorName: string;
  processedAt: Date;
  comments: string | null;
  previousStatus: RequisitionStatus;
  newStatus: RequisitionStatus;
  isAutoProcessed: boolean;
  failureReason: string | null;
}

export type ApprovalAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN' | 'CANCEL' | 'COMPLETE';

export interface ViolationRecord extends BaseEntity {
  requisitionId: string;
  requisitionItemId: string;
  violationType: ViolationType;
  severity: ViolationSeverity;
  description: string;
  ruleId: string | null;
  isResolved: boolean;
  resolvedAt: Date | null;
  resolvedById: string | null;
}

export type ViolationType = 
  | 'SAFETY_INTERVAL_VIOLATION'
  | 'MAX_APPLICATIONS_EXCEEDED'
  | 'DOSAGE_EXCEEDED'
  | 'PLOT_MISMATCH'
  | 'CROP_MISMATCH'
  | 'INVENTORY_INSUFFICIENT'
  | 'OTHER';

export type ViolationSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SupervisorLedger extends BaseEntity {
  ledgerNumber: string;
  requisitionId: string;
  applicantName: string;
  pesticideName: string;
  plotName: string;
  cropName: string;
  applicationDate: Date;
  quantity: string;
  isCompliant: boolean;
  violations: string[];
  checkpoints: LedgerCheckpoint[];
}

export interface LedgerCheckpoint {
  name: string;
  passed: boolean;
  details: string;
  checkedAt: Date;
}

export interface ScheduledTask extends BaseEntity {
  name: string;
  cronExpression: string;
  isEnabled: boolean;
  lastRunAt: Date | null;
  lastRunStatus: TaskRunStatus;
  nextRunAt: Date | null;
  retryCount: number;
  maxRetries: number;
}

export type TaskRunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'RETRYING';

export interface TaskExecutionLog extends BaseEntity {
  taskId: string;
  taskName: string;
  startedAt: Date;
  completedAt: Date | null;
  status: TaskRunStatus;
  attemptNumber: number;
  errorMessage: string | null;
  executionDurationMs: number | null;
  nextRetryAt: Date | null;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: Date;
  requestId: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
