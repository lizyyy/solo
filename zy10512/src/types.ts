export enum AppealStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  UNDER_REVIEW = 'under_review',
  CORRECTED = 'corrected',
  REJECTED = 'rejected',
  CLOSED = 'closed'
}

export interface ReportSnapshot {
  id: string;
  reportName: string;
  snapshotDate: string;
  metricValues: Record<string, number>;
  rawData?: any;
  createdAt: string;
}

export interface CorrectionRecord {
  id: string;
  appealId: string;
  correctedBy: string;
  correctedAt: string;
  originalValues: Record<string, number>;
  correctedValues: Record<string, number>;
  correctionReason: string;
}

export interface ExplanationReport {
  id: string;
  appealId: string;
  content: string;
  generatedBy?: string;
  generatedAt: string;
  attachments?: string[];
}

export interface Appeal {
  id: string;
  reportName: string;
  snapshotDate: string;
  snapshotId: string;
  appellant: string;
  appellantContact?: string;
  appealReason: string;
  status: AppealStatus;
  metricValues: Record<string, number>;
  rawInput?: any;
  processingBasis?: string;
  createdAt: string;
  updatedAt: string;
  assignee?: string;
  comments?: string[];
}

export interface CreateAppealRequest {
  reportName: string;
  snapshotDate: string;
  metricValues: Record<string, number>;
  appellant: string;
  appellantContact?: string;
  appealReason: string;
  rawData?: any;
}

export interface UpdateStatusRequest {
  status: AppealStatus;
  operator: string;
  comment?: string;
  processingBasis?: string;
}

export interface ManualCorrectionRequest {
  correctedValues: Record<string, number>;
  correctedBy: string;
  correctionReason: string;
}

export interface QueryParams {
  reportName?: string;
  snapshotDate?: string;
  status?: AppealStatus;
  appellant?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}
