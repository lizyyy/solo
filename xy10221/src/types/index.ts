export type Size = '110' | '120' | '130' | '140' | '150' | '160' | '170' | '180' | '190';

export type UniformType = '夏装' | '秋装' | '冬装' | '礼服';

export type ExchangeStatus = 
  | 'pending_validation'
  | 'validation_passed'
  | 'validation_failed'
  | 'inventory_checking'
  | 'inventory_available'
  | 'inventory_unavailable'
  | 'processing'
  | 'shipped'
  | 'completed'
  | 'cancelled';

export type ValidationStatus = 'passed' | 'failed' | 'retry';

export interface SchoolClass {
  id: string;
  name: string;
  grade: string;
  teacherName: string;
  teacherPhone: string;
}

export interface Student {
  id: string;
  classId: string;
  studentNo: string;
  name: string;
  gender: '男' | '女';
  registeredSize: Record<UniformType, Size>;
  isSizeActive: boolean;
}

export interface DistributionRecord {
  id: string;
  studentId: string;
  classId: string;
  uniformType: UniformType;
  distributedSize: Size;
  distributionDate: string;
  distributor: string;
  recipientSignature: boolean;
  notes: string;
}

export interface InventoryItem {
  id: string;
  uniformType: UniformType;
  size: Size;
  quantity: number;
  location: string;
}

export interface ExchangeRequest {
  id: string;
  studentId: string;
  classId: string;
  createdBy: string;
  createdAt: string;
  uniformType: UniformType;
  originalSize: Size;
  requestedSize: Size;
  reason: string;
  relatedDistributionId: string;
  status: ExchangeStatus;
  validationHistory: ValidationHistory[];
  currentValidationResult: ValidationResult | null;
  retryCount: number;
}

export interface ValidationHistory {
  id: string;
  timestamp: string;
  operator: string;
  result: ValidationStatus;
  checks: ValidationCheck[];
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  overallStatus: ValidationStatus;
  checks: ValidationCheck[];
  needsManualReview: boolean;
  manualReviewReason?: string;
  canRetry: boolean;
  retryInstructions?: string;
}

export interface ExportConfig {
  format: 'excel' | 'csv';
  includeValidation: boolean;
  dateRange: { start: string; end: string };
}

export interface FilterCriteria {
  classId?: string;
  status?: ExchangeStatus;
  uniformType?: UniformType;
  validationStatus?: ValidationStatus;
  keyword?: string;
}

export interface Statistics {
  totalRequests: number;
  byStatus: Record<ExchangeStatus, number>;
  byUniformType: Record<UniformType, number>;
  byValidationStatus: Record<ValidationStatus, number>;
  pendingManualReview: number;
}
