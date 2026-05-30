export type FileSourceType =
  | 'customer'
  | 'guarantee'
  | 'credit'
  | 'counterGuarantee'
  | 'approval'
  | 'exposureReport';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type NodeType = 'customer' | 'guarantee' | 'credit';
export type RelationType = 'directGuarantee' | 'counterGuarantee' | 'creditLine';

export interface DataImportWarning {
  id: string;
  batchId: string;
  sourceFile: string;
  rowNumber: number;
  objectId?: string;
  objectName?: string;
  warningType: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestion: string;
  rawData: Record<string, any>;
}

export interface Customer {
  id: string;
  name: string;
  customerType: 'enterprise' | 'group' | 'individual';
  creditRating: string;
  industry: string;
  attributes: Record<string, any>;
  version: string;
  sourceFile: string;
  sourceBatch: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GuaranteeContract {
  id: string;
  guarantorId: string;
  guaranteedId: string;
  amount: number;
  currency: string;
  startDate: string;
  endDate: string;
  contractNumber: string;
  isCounterGuarantee: boolean;
  counterGuaranteeId?: string;
  attributes: Record<string, any>;
  version: string;
  sourceFile: string;
  sourceRow: number;
  sourceBatch: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreditLine {
  id: string;
  customerId: string;
  totalAmount: number;
  usedAmount: number;
  availableAmount: number;
  asOfDate: string;
  currency: string;
  attributes: Record<string, any>;
  version: string;
  sourceFile: string;
  sourceRow: number;
  sourceBatch: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CounterGuarantee {
  id: string;
  guaranteeId: string;
  providerId: string;
  type: string;
  amount: number;
  coverageRatio: number;
  attributes: Record<string, any>;
  version: string;
  sourceFile: string;
  sourceRow: number;
  sourceBatch: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  riskLevel: RiskLevel;
  data: Customer | GuaranteeContract | CreditLine;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationType: RelationType;
  amount?: number;
  riskLevel: RiskLevel;
}

export interface RiskFactor {
  code: string;
  name: string;
  severity: RiskLevel;
  description: string;
  relatedObjects: string[];
}

export interface RiskAnalysisResult {
  id?: string;
  customerId: string;
  customerName?: string;
  totalExposure: number;
  guaranteeChainRisk: RiskLevel;
  crossGuaranteeRisk: RiskLevel;
  counterGuaranteeCoverage: number;
  creditConcentration: number;
  overallRiskLevel: RiskLevel;
  riskFactors: RiskFactor[];
  riskScore: number;
  calculationVersion: string;
  calculationTime: string;
  version: string;
}

export interface VersionSnapshot {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  createdBy: string;
  dataVersion: string;
  calculationVersion: string;
  dataFiles: string[];
  isActive: boolean;
  canRollback: boolean;
}

export interface OperationLog {
  id: string;
  operationType: string;
  operator: string;
  timestamp: string;
  description: string;
  affectedObjects: string[];
  previousSnapshotId?: string;
  canUndo: boolean;
}

export interface ImportBatch {
  id: string;
  name: string;
  uploadTime: string;
  uploader: string;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'partial';
  totalRows: number;
  validRows: number;
  errorRows: number;
  version: string;
  warnings?: DataImportWarning[];
}

export interface FailedItem {
  index: number;
  objectId: string;
  objectName: string;
  sourceFile?: string;
  rowNumber?: number;
  errorMessage: string;
  errorCode: string;
  rawData: Record<string, any>;
}

export interface BatchTask {
  id: string;
  type: 'import' | 'recalculate' | 'export';
  status: 'pending' | 'running' | 'completed' | 'partial' | 'failed';
  totalCount: number;
  successCount: number;
  failedCount: number;
  progress: number;
  startedAt: string;
  completedAt?: string;
  failedItems: FailedItem[];
}

export interface ImportRequest {
  files: { name: string; sourceType: FileSourceType; content: string }[];
  createNewVersion: boolean;
  versionName: string;
  versionDescription?: string;
}

export interface ImportResponse {
  batchId: string;
  taskId: string;
}

export interface ImportPreviewResponse {
  batchId: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  warnings: DataImportWarning[];
  sampleData: Record<string, any>[];
}

export interface GraphRequest {
  centerCustomerId?: string;
  maxDepth: number;
  minAmount?: number;
  riskLevels?: RiskLevel[];
  version?: string;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  riskSummary: {
    totalCustomers: number;
    totalGuarantees: number;
    highRiskCount: number;
    criticalRiskCount: number;
    totalExposure: number;
  };
}

export interface RiskAnalysisRequest {
  customerIds?: string[];
  version?: string;
  batch?: boolean;
}

export interface RiskAnalysisResponse {
  results: RiskAnalysisResult[];
  taskId?: string;
}

export interface AnomalyDetectionRequest {
  batchId: string;
}

export interface AnomalyDetectionResponse {
  anomalies: DataImportWarning[];
  duplicateGuarantees: GuaranteeContract[][];
  dateAnomalies: { type: string; objects: any[]; message: string }[];
  missingCounterGuarantees: { guaranteeId: string; guaranteeAmount: number; coverageRatio: number; message: string }[];
  cycleGuarantees: { path: string[]; totalAmount: number; message: string }[];
}

export interface RollbackRequest {
  snapshotId: string;
  reason: string;
}

export interface RollbackResponse {
  success: boolean;
  newSnapshotId: string;
  affectedCount: number;
}

export interface ReportRequest {
  type: 'single' | 'batch';
  customerIds: string[];
  format: 'excel' | 'pdf';
  includeSections: string[];
}

export interface ReportResponse {
  reportId: string;
  downloadUrl: string;
  expiresAt: string;
}

export interface BatchTaskResponse {
  taskId: string;
  status: BatchTask['status'];
  progress: number;
}

export interface DashboardStats {
  totalCustomers: number;
  totalGuarantees: number;
  totalExposure: number;
  highRiskCount: number;
  criticalRiskCount: number;
  pendingTasks: number;
  recentOperations: OperationLog[];
  recentAnomalies: DataImportWarning[];
}
