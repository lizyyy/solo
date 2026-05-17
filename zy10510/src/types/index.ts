export enum ArbitrationStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  ARBITRATED = 'arbitrated',
  EFFECTIVE = 'effective',
  REJECTED = 'rejected'
}

export interface ReportCaliber {
  reportName: string;
  calculation: string;
  description?: string;
}

export interface ArbitrationRecord {
  id: string;
  fieldName: string;
  sourceReports: ReportCaliber[];
  disputeDescription: string;
  arbitrationOpinion?: string;
  effectiveVersion?: string;
  status: ArbitrationStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  arbitratedBy?: string;
  history: StatusHistory[];
  rawInput: any;
  handlingBasis?: string;
  corrections: Correction[];
}

export interface StatusHistory {
  status: ArbitrationStatus;
  changedAt: Date;
  changedBy: string;
  remark?: string;
}

export interface Correction {
  id: string;
  correctedBy: string;
  correctedAt: Date;
  field: string;
  oldValue: any;
  newValue: any;
  reason: string;
}

export interface CreateArbitrationRequest {
  fieldName: string;
  sourceReports: ReportCaliber[];
  disputeDescription: string;
  createdBy: string;
  rawInput?: any;
}

export interface UpdateStatusRequest {
  status: ArbitrationStatus;
  updatedBy: string;
  remark?: string;
  arbitrationOpinion?: string;
  effectiveVersion?: string;
  handlingBasis?: string;
}

export interface CorrectionRequest {
  field: string;
  newValue: any;
  reason: string;
  correctedBy: string;
}

export interface QueryParams {
  fieldName?: string;
  status?: ArbitrationStatus;
  createdBy?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}
