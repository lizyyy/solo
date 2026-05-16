export interface DependencyConfig {
  id: string;
  name: string;
  type: 'http' | 'tcp' | 'dns';
  host: string;
  port?: number;
  path?: string;
  timeout?: number;
}

export interface ProbeResult {
  id: string;
  dependencyId: string;
  dependencyName: string;
  status: 'success' | 'failure';
  errorType?: 'dns' | 'port' | 'business';
  errorMessage?: string;
  responseTime?: number;
  timestamp: number;
  rawData?: any;
}

export interface PurchaseInquiry {
  id: string;
  inquiryNo: string;
  supplier: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: 'pending' | 'approved' | 'rejected';
  permissionTicket?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProcessingConclusion {
  id: string;
  inquiryId: string;
  conclusion: 'pass' | 'fail' | 'review';
  reason: string;
  operator?: string;
  isManualCorrection: boolean;
  correctionRemark?: string;
  previousConclusion?: string;
  previousReason?: string;
  previousPermissionTicket?: string;
  newPermissionTicket?: string;
  createdAt: number;
}

export interface MaterialSummary {
  id: string;
  inquiryId: string;
  summary: string;
  permissionTicketChanges?: {
    before: string;
    after: string;
    exception: string;
    correction: string;
    conclusion: string;
  };
  createdAt: number;
  updatedAt: number;
}

export interface QueryFilter {
  status?: 'success' | 'failure' | 'all';
  startTime?: number;
  endTime?: number;
  dependencyId?: string;
  inquiryId?: string;
}
