export interface Loan {
  id: string;
  customerName: string;
  loanNo: string;
  principal: number;
  industryCode: string;
  maturityBucketCode: string;
  riskRatingCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface IndustryTag {
  code: string;
  name: string;
  displayOrder: number;
}

export interface MaturityBucket {
  code: string;
  name: string;
  monthFrom: number;
  monthTo: number;
  displayOrder: number;
}

export interface RiskRating {
  code: string;
  name: string;
  riskLevel: number;
  color: string;
}

export type GuaranteeType = 'mortgage' | 'pledge' | 'guarantee' | 'credit';

export interface Guarantee {
  id: string;
  loanId: string;
  type: GuaranteeType;
  amount: number;
  guarantor: string;
  isRepeated: boolean;
}

export interface RiskReport {
  id: string;
  loanId: string;
  rawValue: string;
  adjustedValue: string;
  conclusion: string;
  adjustReason: string;
  createdAt: string;
  createdBy: string;
}

export type AnomalyType = 'maturity_mismatch' | 'guarantee_repeat' | 'rating_override';

export interface AnomalyMark {
  id: string;
  loanId: string;
  type: AnomalyType;
  description: string;
  severity: 1 | 2 | 3;
  resolved: boolean;
  createdAt: string;
}

export interface DataSnapshot {
  id: string;
  name: string;
  createdAt: string;
  data: {
    loans: Loan[];
    reports: RiskReport[];
    anomalies: AnomalyMark[];
  };
  createdBy: string;
}

export interface AuditLog {
  id: string;
  loanId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changeReason: string;
  changedAt: string;
  changedBy: string;
}

export interface TerrainDataPoint {
  industryCode: string;
  maturityCode: string;
  riskRatingCode: string;
  totalPrincipal: number;
  loanCount: number;
  avgRiskLevel: number;
  anomalyCount: number;
  loans: string[];
}

export interface FilterConditions {
  industries: string[];
  maturityBuckets: string[];
  riskRatings: string[];
  guaranteeTypes: GuaranteeType[];
  hasAnomaly: boolean | null;
  principalRange: [number, number];
}

export type ViewMode = 'terrain' | 'heatmap' | 'bar3d';

export interface AppState {
  loans: Loan[];
  industryTags: IndustryTag[];
  maturityBuckets: MaturityBucket[];
  riskRatings: RiskRating[];
  guarantees: Guarantee[];
  reports: RiskReport[];
  anomalies: AnomalyMark[];
  snapshots: DataSnapshot[];
  auditLogs: AuditLog[];
  filters: FilterConditions;
  selectedLoanId: string | null;
  selectedSnapshotId: string | null;
  compareSnapshotId: string | null;
  viewMode: ViewMode;
}
