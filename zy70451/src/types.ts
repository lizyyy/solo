export enum ServiceStatus {
  PENDING = 'pending',
  NORMAL = 'normal',
  ABNORMAL = 'abnormal',
  MANUAL_FIXED = 'manual_fixed'
}

export enum RecordStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  PARTIAL_SUCCESS = 'partial_success'
}

export interface ServiceVersion {
  serviceName: string;
  expectedVersion: string;
  actualVersion: string;
  isMatch: boolean;
}

export interface MaterialSummary {
  id: string;
  type: string;
  content: string;
  createdAt: string;
}

export interface Remark {
  id: string;
  content: string;
  operator: string;
  createdAt: string;
}

export interface ServiceRecord {
  id: string;
  serviceName: string;
  status: ServiceStatus;
  versions: ServiceVersion[];
  materialSummaries: MaterialSummary[];
  remarks: Remark[];
  systemConclusion: string;
  manualConclusion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HandoverForm {
  id: string;
  formNo: string;
  tenantId: string;
  tenantName: string;
  handler: string;
  status: RecordStatus;
  serviceRecords: ServiceRecord[];
  conclusion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryRecord {
  id: string;
  resourceType: string;
  resourceId: string;
  resourceRange: string;
  action: string;
  reason: string;
  operator: string;
  beforeChange?: any;
  afterChange?: any;
  createdAt: string;
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  errors?: string[];
}

export interface CreateHandoverFormServiceRecord {
  serviceName: string;
  status?: ServiceStatus;
  versions: ServiceVersion[];
  materialSummaries?: MaterialSummary[];
  remarks?: Remark[];
  systemConclusion?: string;
  manualConclusion?: string;
}

export interface CreateHandoverFormRequest {
  tenantId: string;
  tenantName: string;
  handler: string;
  serviceRecords: CreateHandoverFormServiceRecord[];
}

export interface ProcessHandoverFormRequest {
  conclusion: string;
  operator: string;
}

export interface ManualFixRequest {
  serviceRecordId: string;
  manualConclusion: string;
  remark: string;
  operator: string;
}

export interface AddMaterialSummaryRequest {
  serviceRecordId: string;
  type: string;
  content: string;
}

export interface HistoryQuery {
  resourceRange?: string;
  resourceType?: string;
  operator?: string;
}
