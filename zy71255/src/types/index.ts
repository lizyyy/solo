export interface Enterprise {
  id: string;
  name: string;
  industry: string;
  position: [number, number, number];
  color: string;
  totalQuota: number;
  usedQuota: number;
}

export interface Transaction {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  price: number;
  date: string;
  periodId: string;
}

export interface Gap {
  id: string;
  enterpriseId: string;
  periodId: string;
  required: number;
  actual: number;
  gap: number;
}

export type IssueType = 'duplicate_deduction' | 'period_misalignment' | 'flow_occlusion';
export type IssueSeverity = 'low' | 'medium' | 'high';
export type IssueStatus = 'open' | 'explained' | 'fixed';

export interface Issue {
  id: string;
  type: IssueType;
  description: string;
  severity: IssueSeverity;
  status: IssueStatus;
  fixNote?: string;
  enterpriseId?: string;
  transactionId?: string;
}

export type PeriodStatus = 'upcoming' | 'active' | 'completed';

export interface Period {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
}

export interface DiffResult {
  added: {
    enterprises: Enterprise[];
    transactions: Transaction[];
    gaps: Gap[];
    issues: Issue[];
  };
  removed: {
    enterprises: Enterprise[];
    transactions: Transaction[];
    gaps: Gap[];
    issues: Issue[];
  };
  modified: {
    enterprises: Enterprise[];
    transactions: Transaction[];
    gaps: Gap[];
    issues: Issue[];
  };
}

export interface Snapshot {
  id: string;
  timestamp: number;
  description: string;
  data: {
    enterprises: Enterprise[];
    transactions: Transaction[];
    gaps: Gap[];
    issues: Issue[];
  };
  diffFromPrev?: DiffResult;
}

export interface FilterState {
  selectedEnterprises: string[];
  selectedPeriod: string | null;
  showOnlyWithGap: boolean;
  gapThreshold: number;
  showIssues: boolean;
  showFlows: boolean;
  timePosition: number;
  isPlaying: boolean;
}

export interface SelectionState {
  selectedEnterprise: string | null;
  selectedTransaction: string | null;
  highlightedTransactions: string[];
}

export interface AppState {
  periods: Period[];
  currentSnapshot: Snapshot;
  snapshots: Snapshot[];
  isCompareMode: boolean;
  compareSnapshotId: string | null;
}
