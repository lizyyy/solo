export type ContractStatus = 'active' | 'rolled' | 'matured' | 'cancelled';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';
export type PaymentType = 'settlement' | 'margin' | 'fee';
export type MatchStatus = 'unmatched' | 'matched' | 'duplicate';
export type PointsDirection = 'premium' | 'discount';
export type ValidationType = 'link' | 'points' | 'match';
export type ValidationSeverity = 'error' | 'warning' | 'info';
export type OperationType = 'create' | 'update' | 'delete' | 'manual_correct' | 'supplement';
export type OverallStatus = 'pass' | 'warning' | 'error';

export interface ForwardContract {
  id: string;
  contractNo: string;
  currencyPair: string;
  notionalAmount: number;
  tradeDate: Date;
  valueDate: Date;
  forwardRate: number;
  counterparty: string;
  status: ContractStatus;
  rolloverFrom?: string;
  rolloverTo?: string;
  createdAt: Date;
  updatedAt: Date;
  isManuallyModified: boolean;
}

export interface RolloverApplication {
  id: string;
  applicationNo: string;
  originalContractId: string;
  newContractId?: string;
  rolloverDate: Date;
  newValueDate: Date;
  spotRate: number;
  swapPoints: number;
  rolloverPoints: number;
  pointsDirection: PointsDirection;
  status: ApplicationStatus;
  applicationMaterial: string;
  spotRateMaterial?: string;
  createdAt: Date;
  updatedAt: Date;
  hasSupplementalData: boolean;
}

export interface PaymentRecord {
  id: string;
  voucherNo: string;
  contractId?: string;
  amount: number;
  currency: string;
  paymentDate: Date;
  paymentType: PaymentType;
  matchedStatus: MatchStatus;
  matchedContractIds: string[];
  materialRef: string;
  createdAt: Date;
}

export interface CalculationStep {
  stepNo: number;
  description: string;
  formula: string;
  input: any;
  output: number;
  isError: boolean;
  impact: number;
}

export interface ValidationError {
  id: string;
  type: ValidationType;
  severity: ValidationSeverity;
  contractNo?: string;
  voucherNo?: string;
  fieldName: string;
  fieldValue?: any;
  expectedValue?: any;
  errorMessage: string;
  relatedMaterial?: string;
  suggestion: string;
  impactOnResult: number;
  isHistoricalJudgment: boolean;
  timestamp: Date;
}

export interface LinkValidationResult {
  contractId: string;
  isComplete: boolean;
  hasCoverageGap: boolean;
  coverageGapAmount?: number;
  chain: string[];
  errors: ValidationError[];
}

export interface PointsValidationResult {
  applicationId: string;
  calculationSteps: CalculationStep[];
  directionCorrect: boolean;
  calculatedPoints: number;
  actualPoints: number;
  deviation: number;
  errors: ValidationError[];
}

export interface MatchValidationResult {
  paymentId: string;
  isDuplicate: boolean;
  matchedContractCount: number;
  errors: ValidationError[];
}

export interface FieldChange {
  fieldName: string;
  oldValue: any;
  newValue: any;
  isManuallyModified: boolean;
}

export interface HistoryRecord {
  id: string;
  operator: string;
  operationType: OperationType;
  contractId?: string;
  paymentId?: string;
  applicationId?: string;
  fieldChanges: FieldChange[];
  reason: string;
  timestamp: Date;
  batchNo?: string;
}

export interface ReportSummary {
  totalContracts: number;
  rolloverCount: number;
  errorCount: number;
  warningCount: number;
  passRate: number;
  coverageRate: number;
  matchAccuracy: number;
}

export interface ReportContent {
  summary: ReportSummary;
  contractDetails: ForwardContract[];
  validationErrors: ValidationError[];
  operationHistory: HistoryRecord[];
  watermark: string;
}

export interface BatchReport {
  id: string;
  batchNo: string;
  period: [Date, Date];
  createdAt: Date;
  createdBy: string;
  contractCount: number;
  rolloverCount: number;
  errorCount: number;
  warningCount: number;
  passRate: number;
  fileName: string;
  content: ReportContent;
}

export interface FilterState {
  contractNo: string;
  counterparty: string;
  currency: string;
  dateRange: [Date, Date] | null;
  status: ValidationSeverity[];
}
