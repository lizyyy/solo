export interface Point {
  id: string;
  name: string;
  location: string;
  busCardTime: string;
  redLineNote: string;
  status: 'normal' | 'pending' | 'conflict';
  hasConstructionDetour: boolean;
  mapSynced: boolean;
  reviewStatus: 'not-needed' | 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface Conflict {
  id: string;
  pointId: string;
  pointName: string;
  type: 'bus-vs-redline' | 'detour-not-synced' | 'data-inconsistent';
  busCardValue: string;
  redLineValue: string;
  evidence: string;
  status: 'pending' | 'confirmed' | 'rejected';
  handler?: string;
  handledAt?: string;
}

export interface HistoryRecord {
  id: string;
  pointId: string;
  pointName: string;
  action: 'create' | 'update' | 'import' | 'confirm' | 'reject' | 'review';
  operator: string;
  beforeData: Partial<Point>;
  afterData: Partial<Point>;
  remark: string;
  createdAt: string;
}

export interface SelfCheckResult {
  id: string;
  type: 'duplicate-import' | 'detour-sync' | 'recalculate' | 'export-consistent';
  typeName: string;
  status: 'pass' | 'warning' | 'error';
  issues: string[];
  checkedAt: string;
}

export interface Workflow {
  id: string;
  pointId: string;
  pointName: string;
  currentStep: 1 | 2 | 3;
  status: 'in-progress' | 'completed' | 'pending-review';
  stepData: {
    step1?: { busCardTime: string; importedAt: string };
    step2?: { redLineNote: string; reviewedAt: string };
    step3?: { updatedAt: string };
  };
  createdAt: string;
}
