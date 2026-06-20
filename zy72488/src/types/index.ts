export interface ImportBatchRecord {
  batchId: string;
  source: string;
  importedAt: string;
  busCardTime: string;
  isDuplicate: boolean;
  importOrder: number;
}

export interface Point {
  id: string;
  name: string;
  location: string;
  busCardTime: string;
  redLineNote: string;
  importCount: number;
  lastImportSource: string;
  lastImportBatchId: string;
  importBatches: ImportBatchRecord[];
  status: 'normal' | 'pending' | 'conflict' | 'pending-review';
  reviewStatus: 'not-needed' | 'pending' | 'approved' | 'rejected';
  hasConstructionDetour: boolean;
  mapSynced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Conflict {
  id: string;
  pointId: string;
  pointName: string;
  type: 'bus-vs-redline' | 'detour-not-synced' | 'data-inconsistent' | 'duplicate-import';
  source: string;
  batchId?: string;
  batchSource?: string;
  importOrder?: number;
  totalDuplicates?: number;
  conclusion?: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'resolved';
  handler?: string;
  handledAt?: string;
  busCardValue?: string;
  redLineValue?: string;
  evidence?: string;
  createdAt: string;
}

export interface HistoryRecord {
  id: string;
  pointId: string;
  pointName: string;
  action: 'create' | 'update' | 'import' | 'confirm' | 'reject' | 'review' | 'supplement';
  operator: string;
  beforeData: Partial<Point>;
  afterData: Partial<Point>;
  fieldChanges: Array<{ field: string; fieldLabel: string; beforeValue: string; afterValue: string }>;
  changeReason: string;
  remark: string;
  createdAt: string;
}

export interface SelfCheckItem {
  type: string;
  typeName: string;
  source: string;
  status: 'pass' | 'warning' | 'error';
  issues: string[];
  conclusion: string;
}

export interface SelfCheckResult {
  id: string;
  reportName: string;
  overallStatus: 'pass' | 'warning' | 'error';
  summary: string;
  items: SelfCheckItem[];
  checkedAt: string;
  operator: string;
}

export interface WorkflowStepData {
  step1?: {
    busCardTime: string;
    importedAt: string;
    importSource: string;
    isDuplicate: boolean;
    duplicateDetected: boolean;
    batchId?: string;
  };
  step2?: {
    redLineNote: string;
    reviewedAt: string;
    reviewer: string;
    hasConflict: boolean;
    conflictDescription: string;
  };
  step3?: {
    updatedAt: string;
    operator: string;
    pointStatus: string;
    reviewStatus: string;
  };
}

export interface Workflow {
  id: string;
  pointId: string;
  pointName: string;
  currentStep: 1 | 2 | 3;
  status: 'in-progress' | 'completed' | 'pending-review';
  stepData: WorkflowStepData;
  finalReport?: {
    duplicateCheck: { passed: boolean; detail: string; batchId?: string; batchSource?: string; count?: number };
    detourSync: { passed: boolean; detail: string; source?: string };
    supplementRecalc: { passed: boolean; detail: string; hasConflict?: boolean };
    exportConsistent: { passed: boolean; detail: string };
    overallConclusion: string;
    overallStatus?: 'pass' | 'warning' | 'error';
    finalPointStatus?: string;
    finalReviewStatus?: string;
  };
  createdAt: string;
}
