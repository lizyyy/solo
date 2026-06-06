export enum RemittanceStatus {
  NORMAL = 'normal',
  ABNORMAL = 'abnormal',
  PENDING = 'pending'
}

export interface RuleHit {
  id: string;
  ruleName: string;
  ruleDescription: string;
  matchedMaterials: string[];
  confidence: number;
  isCrossSettlement: boolean;
}

export interface ManualNote {
  id: string;
  author: string;
  timestamp: string;
  content: string;
  source: string;
}

export interface EvidenceItem {
  type: string;
  description: string;
  reference: string;
}

export interface CrossSettlementAnalysis {
  originalDate: string;
  refundDate: string;
  settlementDates: string[];
  daysAcross: number;
  evidenceChain: EvidenceItem[];
}

export interface Remittance {
  id: string;
  transactionId: string;
  payer: string;
  payee: string;
  amount: number;
  currency: string;
  transactionDate: string;
  status: RemittanceStatus;
  ruleHits: RuleHit[];
  manualNotes: ManualNote[];
  crossSettlementAnalysis?: CrossSettlementAnalysis;
  createdAt: string;
  updatedAt: string;
}

export interface ScreeningVersion {
  id: string;
  name: string;
  timestamp: string;
  totalCount: number;
  normalCount: number;
  abnormalCount: number;
  pendingCount: number;
  remittances: Remittance[];
}

export type DiffType = 'added' | 'removed' | 'modified' | 'status_changed';

export interface FieldDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface RemittanceDiff {
  transactionId: string;
  diffType: DiffType;
  oldStatus?: RemittanceStatus;
  newStatus?: RemittanceStatus;
  fieldDiffs?: FieldDiff[];
  oldRemittance?: Remittance;
  newRemittance?: Remittance;
}

export interface VersionCompareResult {
  versionA: string;
  versionB: string;
  totalDiffs: number;
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  statusChangedCount: number;
  diffs: RemittanceDiff[];
}
