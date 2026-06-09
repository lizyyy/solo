export type RouteStatus = 'normal' | 'gap_pending_review' | 'deleted' | 'supplement_pending_recalc' | 'reviewed_resolved';

export type ActionType = 'import' | 'delete' | 'supplement' | 'recalculate' | 'status_update' | 'gap_review';

export type VersionStatus = 'draft' | 'pending_review' | 'published';

export type GapResolutionType = 'supplement_fill' | 'renumber' | 'accept_gap' | 'other';

export interface GapReviewInfo {
  reviewedBy: string;
  reviewedAt: string;
  originalGap: {
    beforeLineNo: number;
    afterLineNo: number;
    missingCount: number;
  };
  resolutionType: GapResolutionType;
  resolutionRemark: string;
  nextHandler: string | null;
  beforeFixValues?: any;
  afterFixValues?: any;
}

export interface GapRecord {
  id: string;
  beforeLineNo: number;
  afterLineNo: number;
  missingCount: number;
  beforeRouteId: string | null;
  afterRouteId: string | null;
  status: 'open' | 'reviewed';
  detectedAt: string;
  reviewInfo: GapReviewInfo | null;
}

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
  gapReviewInfo: GapReviewInfo | null;
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

export interface GapReviewRequest {
  gapId: string;
  reviewedBy: string;
  resolutionType: GapResolutionType;
  resolutionRemark: string;
  nextHandler?: string;
}

export interface GapReviewResponse {
  success: boolean;
  gapRecord?: GapRecord;
  affectedRoutes?: PickingRoute[];
  message: string;
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
      openGapCount: number;
      reviewedGapCount: number;
      gaps: { gapId: string; beforeLineNo: number; afterLineNo: number; missingCount: number; status: string }[];
    };
  };
  supplementRecalc: {
    passed: boolean;
    details: {
      supplementCount: number;
      pendingRecalcCount: number;
      items: { id: string; originalLineNo: number; status: string; orderNo?: string; sku?: string }[];
    };
  };
  exportConsistency: {
    passed: boolean;
    details: {
      pageCount: number;
      exportCount: number;
      apiCount: number;
      dbCount: number;
      isConsistent: boolean;
    };
  };
}

export const STATUS_LABELS: Record<RouteStatus, string> = {
  normal: '正常',
  gap_pending_review: '编号断档-待复核',
  deleted: '已删除',
  supplement_pending_recalc: '补录待重算',
  reviewed_resolved: '断档已复核',
};

export const VERSION_STATUS_LABELS: Record<VersionStatus, string> = {
  draft: '草稿',
  pending_review: '待复核',
  published: '已发布',
};

export const GAP_RESOLUTION_LABELS: Record<GapResolutionType, string> = {
  supplement_fill: '补录填充断档',
  renumber: '重排编号',
  accept_gap: '接受断档不修正',
  other: '其他方式',
};
