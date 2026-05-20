import { ReviewStatus, BillingRecord, BillingSummary } from './models';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ImportMeterDataRequest {
  periodStart: string;
  periodEnd: string;
}

export interface ImportMeterDataResponse {
  success: boolean;
  importedCount: number;
  errors: string[];
}

export interface ImportContractRequest {
  contractData: any;
}

export interface CalculateBillingRequest {
  periodStart: string;
  periodEnd: string;
}

export interface CalculateBillingResponse {
  success: boolean;
  recordsGenerated: number;
  records: BillingRecord[];
  summary: BillingSummary;
}

export interface ReviewRecordRequest {
  recordId: string;
  action: 'approve' | 'reject' | 'request_info' | 'modify';
  comment: string;
  userId: string;
  userName: string;
  modifications?: Partial<BillingRecord>;
}

export interface RecalculateRequest {
  recordIds?: string[];
  periodStart?: string;
  periodEnd?: string;
}

export interface GetRecordsRequest {
  periodStart?: string;
  periodEnd?: string;
  tenantId?: string;
  status?: ReviewStatus;
  page?: number;
  pageSize?: number;
}

export interface GetRecordsResponse {
  records: BillingRecord[];
  total: number;
  page: number;
  pageSize: number;
  summary: BillingSummary;
}

export interface DownloadReportRequest {
  periodStart: string;
  periodEnd: string;
  format: 'excel' | 'pdf';
  includeDetails: boolean;
}
