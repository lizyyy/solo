export interface Enterprise {
  id: string;
  name: string;
  industry: string;
  quota: number;
  usedQuota: number;
  position?: { x: number; y: number; z: number };
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  enterpriseId: string;
  enterpriseName: string;
  fromEnterpriseId?: string;
  toEnterpriseId?: string;
  periodId?: string;
  description?: string;
}

export interface PerformancePeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface AnomalyRecord {
  type: 'duplicate_deduction' | 'period_misalignment' | 'flow_occlusion';
  severity: 'low' | 'medium' | 'high';
  description: string;
  relatedIds: string[];
  details: Record<string, unknown>;
}

export interface DetectionData {
  transactions: Transaction[];
  periods?: PerformancePeriod[];
  enterprises?: Enterprise[];
}

export interface DiffResult {
  added: Record<string, unknown>;
  removed: Record<string, unknown>;
  modified: Record<string, { oldValue: unknown; newValue: unknown }>;
  unchanged: Record<string, unknown>;
}

export interface Snapshot {
  version: string;
  timestamp: number;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ReportData {
  enterprises: Enterprise[];
  transactions: Transaction[];
  gaps: Array<{
    enterpriseId: string;
    enterpriseName: string;
    gapAmount: number;
    quota: number;
    usedQuota: number;
  }>;
  anomalies: AnomalyRecord[];
  summary: {
    totalEnterprises: number;
    totalTransactions: number;
    totalAmount: number;
    totalAnomalies: number;
  };
}

export type RGB = { r: number; g: number; b: number };
