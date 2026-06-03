export type RouteStatus = 'normal' | 'gap_pending_review' | 'deleted' | 'supplement_pending_recalc';

export type ActionType = 'import' | 'delete' | 'supplement' | 'recalculate' | 'status_update';

export type VersionStatus = 'draft' | 'pending_review' | 'published';

export interface RouteOptimizationResult {
  orderNo: string;
  sku: string;
  quantity: number;
  warehouseZone: string;
  pickingSequence: number;
  distance: number;
  estimatedTime: number;
}

export interface ChangeRecord {
  timestamp: string;
  operator: string;
  action: ActionType;
  beforeValue?: any;
  afterValue?: any;
  remark: string;
}

export interface PickingRoute {
  id: string;
  originalLineNo: number;
  currentLineNo: number;
  routeData: RouteOptimizationResult;
  status: RouteStatus;
  statusLabel: string;
  sourceBatch: string;
  operator: string;
  createdAt: string;
  updatedAt: string;
  changeLog: ChangeRecord[];
}

export interface ImportBatch {
  id: string;
  fileHash: string;
  contentFingerprint: string;
  fileName: string;
  totalRows: number;
  operator: string;
  createdAt: string;
  isForceReimport: boolean;
}

export interface ScoreWeight {
  id: string;
  dimension: string;
  weight: number;
  description: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ParameterVersion {
  id: string;
  versionNo: string;
  status: VersionStatus;
  weightBatchId: string;
  hasGap: boolean;
  createdBy: string;
  createdAt: string;
  publishedAt: string | null;
}

export interface ImportRequest {
  operator: string;
  forceReimport?: boolean;
}

export interface ImportResponse {
  batchId: string;
  totalRows: number;
  importedRows: number;
  isDuplicate: boolean;
  duplicateInfo?: {
    previousImportTime: string;
    previousOperator: string;
  };
  warnings: string[];
}

export interface DuplicateCheckRequest {
  fileHash: string;
  contentFingerprint: string;
}

export interface DuplicateCheckResponse {
  isDuplicate: boolean;
  duplicateInfo?: {
    batchId: string;
    createdAt: string;
    operator: string;
    fileName: string;
  };
}

export interface SupplementRouteRequest {
  routeData: Partial<RouteOptimizationResult>;
  operator: string;
}

export interface RecalculateRequest {
  operator: string;
}

export interface WeightReviewRequest {
  operator: string;
  remark?: string;
}

export interface CreateVersionRequest {
  versionNo: string;
  createdBy: string;
}

export interface SelfCheckResult {
  duplicateImport: {
    passed: boolean;
    details: {
      totalBatches: number;
      duplicateCount: number;
      duplicates: { batchId: string; time: string; operator: string; fileName: string }[];
    };
  };
  numberGap: {
    passed: boolean;
    details: {
      gapCount: number;
      gaps: { beforeLineNo: number; afterLineNo: number; missingCount: number }[];
    };
  };
  supplementRecalc: {
    passed: boolean;
    details: {
      supplementCount: number;
      pendingRecalcCount: number;
      items: { id: string; originalLineNo: number; status: string }[];
    };
  };
  exportConsistency: {
    passed: boolean;
    details: {
      pageCount: number;
      exportCount: number;
      apiCount: number;
      isConsistent: boolean;
    };
  };
}

export const STATUS_LABELS: Record<RouteStatus, string> = {
  normal: '正常',
  gap_pending_review: '编号断档-待复核',
  deleted: '已删除',
  supplement_pending_recalc: '补录待重算',
};

export const VERSION_STATUS_LABELS: Record<VersionStatus, string> = {
  draft: '草稿',
  pending_review: '待复核',
  published: '已发布',
};
