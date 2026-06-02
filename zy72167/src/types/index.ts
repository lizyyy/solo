export type SourceType = 'street_form' | 'inspection_photo' | 'approval_record' | 'manual_supplement';

export type RecordStatus = 
  | 'pending_review'
  | 'auto_merged'
  | 'review_confirmed'
  | 'needs_confirmation'
  | 'rejected'
  | 'split';

export interface Location {
  lat: number;
  lng: number;
  mapX?: number;
  mapY?: number;
}

export interface AuditTrail {
  id: string;
  recordId: string;
  actionType: 'import' | 'merge' | 'confirm' | 'reject' | 'split' | 'supplement' | 'remark';
  actionReason: string;
  operator: string;
  timestamp: string;
  beforeState: Partial<CarbonRecord> | null;
  afterState: Partial<CarbonRecord> | null;
  remark?: string;
}

export interface CarbonRecord {
  id: string;
  pointName: string;
  originalName: string;
  sourceType: SourceType;
  address: string;
  carbonAmount: number;
  unit: string;
  recordDate: string;
  status: RecordStatus;
  mergeGroupId: string | null;
  auditTrail: AuditTrail[];
  location: Location;
  dataQuality: 'good' | 'normal' | 'poor';
  remark: string;
  operator: string;
  createdAt: string;
  updatedAt: string;
  isOldCaliber?: boolean;
  oldCaliberNote?: string;
}

export interface MergeGroup {
  id: string;
  canonicalName: string;
  standardAddress: string;
  totalCarbon: number;
  recordCount: number;
  confidenceScore: number;
  mergeReason: string;
  status: 'pending' | 'confirmed' | 'needs_review' | 'rejected';
  mergedRecordIds: string[];
  operator: string;
  createdAt: string;
  matchDetails: MatchDetail[];
}

export interface MatchDetail {
  recordIdA: string;
  recordIdB: string;
  nameA: string;
  nameB: string;
  editDistanceScore: number;
  pinyinScore: number;
  keywordScore: number;
  locationScore: number;
  totalScore: number;
  reason: string;
}

export interface SupplementDiff {
  field: string;
  oldValue: string | number;
  newValue: string | number;
  isDiff: boolean;
}

export interface AppState {
  records: CarbonRecord[];
  mergeGroups: MergeGroup[];
  currentOperator: string;
  lastSaved: string | null;
}

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  street_form: '街道表格',
  inspection_photo: '现场照片',
  approval_record: '审批记录',
  manual_supplement: '人工补录',
};

export const STATUS_LABELS: Record<RecordStatus, string> = {
  pending_review: '待审核',
  auto_merged: '自动归并待确认',
  review_confirmed: '审核通过',
  needs_confirmation: '需要人工确认',
  rejected: '已驳回',
  split: '已拆分',
};

export const STATUS_COLORS: Record<RecordStatus, string> = {
  pending_review: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  auto_merged: 'bg-blue-100 text-blue-800 border-blue-300',
  review_confirmed: 'bg-green-100 text-green-800 border-green-300',
  needs_confirmation: 'bg-orange-100 text-orange-800 border-orange-300',
  rejected: 'bg-red-100 text-red-800 border-red-300',
  split: 'bg-gray-100 text-gray-800 border-gray-300',
};

export const MERGE_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500',
  confirmed: 'bg-green-600',
  needs_review: 'bg-orange-500',
  rejected: 'bg-red-600',
};
