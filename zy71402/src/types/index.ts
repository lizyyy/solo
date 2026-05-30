export type MaterialType = 'product_terms' | 'customer_position' | 'underlying_price';

export type BatchStatus = 'draft' | 'importing' | 'parsing' | 'calculating' | 'validating' | 'has_issues' | 'ready' | 'completed' | 'archived';

export type IssueSeverity = 'error' | 'warning' | 'info';

export type IssueType = 'boundary_error' | 'tier_mismatch' | 'early_termination_missing' | 'data_missing' | 'logic_conflict';

export type MaterialStatus = 'new' | 'duplicate' | 'updated' | 'supplementary';

export interface EvidenceRef {
  materialId: string;
  filename: string;
  location: string;
  value: string;
}

export interface Batch {
  id: string;
  name: string;
  status: BatchStatus;
  createdAt: Date;
  updatedAt: Date;
  currentVersion: number;
  issueCount: number;
  errorCount: number;
  warningCount: number;
}

export interface Material {
  id: string;
  batchId: string;
  type: MaterialType;
  filename: string;
  content: Record<string, any>;
  rawContent?: string;
  dataHash: string;
  importedAt: Date;
  source: string;
  version: number;
  status: MaterialStatus;
  duplicateOf?: string;
  previousVersion?: string;
}

export interface ObservationInterval {
  id: string;
  startDate: string;
  endDate: string;
  lowerBound: number;
  upperBound: number;
  lowerInclusive: boolean;
  upperInclusive: boolean;
}

export interface ReturnTier {
  id: string;
  lowerBound: number;
  upperBound: number;
  lowerInclusive: boolean;
  upperInclusive: boolean;
  returnRate: number;
  description: string;
}

export interface EarlyTermination {
  enabled: boolean;
  observationDates: string[];
  triggerCondition: string;
  triggerLevel: number;
  returnRate: number;
}

export interface ParsedTerms {
  id: string;
  batchId: string;
  productCode: string;
  productName: string;
  underlying: string;
  underlyingCode: string;
  currency: string;
  termDays: number;
  observationIntervals: ObservationInterval[];
  returnTiers: ReturnTier[];
  earlyTermination: EarlyTermination | null;
  evidenceRef: Record<string, EvidenceRef>;
  parsedAt: Date;
  manuallyModified: boolean;
}

export interface CustomerPosition {
  id: string;
  batchId: string;
  customerId: string;
  customerName: string;
  productCode: string;
  principal: number;
  startDate: string;
  endDate: string;
  evidenceRef: EvidenceRef;
}

export interface UnderlyingPrice {
  id: string;
  batchId: string;
  date: string;
  price: number;
  source?: string;
}

export interface CalculationStep {
  step: string;
  description: string;
  value: string | number;
  evidence?: EvidenceRef;
}

export interface CalculationResult {
  id: string;
  batchId: string;
  positionId: string;
  customerName: string;
  principal: number;
  matchedTierId: string | null;
  matchedTierDescription: string;
  observationPrice: number;
  observationDate: string;
  returnRate: number;
  calculatedReturn: number;
  payoutAmount: number;
  calculationSteps: CalculationStep[];
  earlyTerminated: boolean;
  terminationDate?: string;
  calculatedAt: Date;
}

export interface ValidationIssue {
  id: string;
  batchId: string;
  severity: IssueSeverity;
  type: IssueType;
  description: string;
  triggeredBy: string;
  blockedAt: string;
  suggestion: string;
  evidence: EvidenceRef[];
  resolved: boolean;
  resolvedAt?: Date;
  resolutionNote?: string;
}

export interface PayoutPlan {
  id: string;
  batchId: string;
  name: string;
  description: string;
  totalPrincipal: number;
  totalPayout: number;
  totalReturn: number;
  averageReturnRate: number;
  details: CalculationResult[];
  isSelected: boolean;
  createdAt: Date;
}

export interface OperationLog {
  id: string;
  batchId: string;
  action: string;
  operator: string;
  beforeValue?: any;
  afterValue?: any;
  evidenceRef?: EvidenceRef;
  timestamp: Date;
}

export interface BatchVersion {
  id: string;
  batchId: string;
  version: number;
  changeSummary: string;
  changedMaterials: string[];
  createdAt: Date;
}

export interface UpdateDetectionResult {
  status: MaterialStatus;
  existingMaterialId?: string;
  diff?: Record<string, any>;
  changes: string[];
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
  warnings: string[];
}

export interface MaterialImportResult {
  material: Material;
  detectionResult: UpdateDetectionResult;
}
