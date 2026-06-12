export enum ComplaintStatus {
  IMPORTED = 'imported',
  COMPLAINT_LINKED = 'complaint_linked',
  HEATMAP_PENDING_REVIEW = 'heatmap_pending_review',
  HEATMAP_NORMAL = 'heatmap_normal',
  REVIEWED_NORMAL = 'reviewed_normal',
  REVIEWED_ABNORMAL = 'reviewed_abnormal',
  ARCHIVED = 'archived'
}

export enum OperationType {
  IMPORT = 'import',
  LINK_COMPLAINT = 'link_complaint',
  UPDATE_HEATMAP = 'update_heatmap',
  REVIEW_HEATMAP = 'review_heatmap',
  ROLLBACK = 'rollback',
  MANUAL_EDIT = 'manual_edit'
}

export interface SamplingPoint {
  pointId: string;
  name: string;
  address: string;
  district: string;
  street: string;
  lng: number;
  lat: number;
}

export interface ComplaintInfo {
  complaintId: string;
  complaintTime: string;
  complaintContent: string;
  complainant: string;
  complainantPhone: string;
  remark?: string;
}

export interface HeatmapInfo {
  odorLevel: number;
  samplingTime: string;
  isMissingSampling: boolean;
  isLowDueToMissing: boolean;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface FieldDiff {
  before: unknown;
  after: unknown;
}

export interface StatusChangeLog {
  id: string;
  recordId: string;
  fromStatus: ComplaintStatus | null;
  toStatus: ComplaintStatus;
  operationType: OperationType;
  operator: string;
  operationTime: string;
  remark?: string;
  snapshotBefore: Record<string, unknown>;
  fieldsChanged: string[];
  diff: Record<string, FieldDiff>;
}

export interface ComplaintRecord {
  id: string;
  originalRowNumber: number;
  samplingPoint: SamplingPoint;
  complaint?: ComplaintInfo;
  heatmap?: HeatmapInfo;
  currentStatus: ComplaintStatus;
  statusLogs: StatusChangeLog[];
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface ImportRowData {
  rowNumber: number;
  pointId: string;
  pointName: string;
  address: string;
  district: string;
  street: string;
  lng: string;
  lat: string;
  [key: string]: string | number;
}

export interface UnifiedQueryParams {
  status?: ComplaintStatus;
  district?: string;
  street?: string;
  isMissingSampling?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface ExportField {
  key: string;
  label: string;
  getter: (record: ComplaintRecord) => string | number | undefined;
}
