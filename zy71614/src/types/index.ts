export type TaskStatus = 'draft' | 'processing' | 'pending_material' | 'completed' | 'cancelled';
export type RecordStatus = 'normal' | 'warning' | 'error';

export interface SettlementTask {
  id: string;
  name: string;
  status: TaskStatus;
  periodStart: string;
  periodEnd: string;
  totalGross: number;
  totalRefund: number;
  totalCoupon: number;
  netGross: number;
  totalSettlement: number;
  errorCount: number;
  currentVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoxOfficeRecord {
  id: string;
  ticketNo: string;
  showCode: string;
  filmName: string;
  showTime: string;
  ticketAmount: number;
  refundAmount: number;
  couponAmount: number;
  netAmount: number;
  recordStatus: RecordStatus;
  errorMessage: string | null;
  diffNote: string | null;
  mapped: boolean;
  sessionId: string | null;
  contractId: string | null;
  diffHash: string | null;
  createdAt: string;
}

export interface ShowSession {
  id: string;
  showCode: string;
  filmName: string;
  showTime: string;
  hallName: string;
  isSpecial: boolean;
  specialType: string | null;
  contractId: string | null;
}

export interface FilmContract {
  id: string;
  filmName: string;
  distributor: string;
  shareRatio: number;
  minimumGuarantee: number | null;
  isTiered: boolean;
  tierRules: string | null;
}

export interface SettlementResult {
  id: string;
  filmName: string;
  distributor: string;
  grossAmount: number;
  shareRatio: number;
  settlementAmount: number;
  guaranteeAmount: number;
  finalAmount: number;
  remark: string | null;
}

export interface VersionHistory {
  id: string;
  version: string;
  snapshotJson: string;
  operation: string;
  operator: string | null;
  remark: string | null;
  createdAt: string;
}
