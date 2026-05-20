export enum RecordStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RETURNED = 'returned'
}

export enum BoundaryType {
  CROSS_DAY = 'cross_day',
  SUBSIDY_LIMIT = 'subsidy_limit',
  REFUND_DEDUCTION = 'refund_deduction'
}

export interface Showtime {
  id: string;
  batchId: string;
  filmName: string;
  hallName: string;
  startTime: string;
  endTime: string;
  date: string;
  seats: number;
  price: number;
  isCrossDay: boolean;
}

export interface BoxOffice {
  id: string;
  batchId: string;
  showtimeId: string;
  filmName: string;
  date: string;
  ticketsSold: number;
  grossAmount: number;
  refundAmount: number;
  subsidyAmount: number;
  netAmount: number;
}

export interface Contract {
  id: string;
  filmName: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  subsidyRate: number;
  subsidyMaxAmount: number;
  refundDeductionRate: number;
  settlementCycle: string;
  createdAt: string;
}

export interface BoundaryLog {
  type: BoundaryType;
  reason: string;
  handler: string;
  timestamp: string;
  details: Record<string, any>;
}

export interface ProcessingRecord {
  id: string;
  batchId: string;
  showtimeId: string;
  boxOfficeId?: string;
  contractId?: string;
  filmName: string;
  hallName?: string;
  date: string;
  status: RecordStatus;
  boundaryLogs: BoundaryLog[];
  currentHandler: string;
  createdAt: string;
  updatedAt: string;
  remarks?: string;
}

export interface Batch {
  id: string;
  name: string;
  status: RecordStatus;
  showtimeCount: number;
  boxOfficeCount: number;
  recordCount: number;
  createdAt: string;
  createdBy: string;
  processedAt?: string;
  processedBy?: string;
  settlementPeriod?: string;
}

export interface QueryParams {
  filmName?: string;
  hallName?: string;
  settlementPeriod?: string;
  startDate?: string;
  endDate?: string;
  status?: RecordStatus;
  contractId?: string;
}

export interface ExportOptions {
  includeBoundaryDetails: boolean;
  format: 'csv' | 'json';
}
