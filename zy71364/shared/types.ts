export interface Artwork {
  id: string;
  name: string;
  era: string;
  material: string;
  dimensions: string;
  accessionNumber: string;
  status: "pending" | "in_progress" | "completed" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface Restoration {
  id: string;
  artworkId: string;
  restorerName: string;
  status: "draft" | "in_progress" | "under_review" | "approved" | "rejected";
  startDate: string;
  endDate: string | null;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RestorationStep {
  id: string;
  restorationId: string;
  stepOrder: number;
  type: "cleaning" | "color_correction" | "reinforcement" | "other";
  description: string;
  notes: string;
  performedAt: string;
  createdAt: string;
}

export interface MaterialBatch {
  id: string;
  stepId: string;
  batchNumber: string;
  name: string;
  supplier: string;
  expiryDate: string;
  status: "normal" | "expired" | "batch_error";
  createdAt: string;
}

export interface Photo {
  id: string;
  stepId: string;
  url: string;
  version: number;
  phase: "before" | "during" | "after";
  uploadedAt: string;
}

export type AnomalyType = "missing_photo" | "batch_number_error" | "step_order_inverted" | "material_expired";

export interface Anomaly {
  id: string;
  restorationId: string;
  stepId?: string;
  materialId?: string;
  type: AnomalyType;
  severity: "warning" | "error";
  description: string;
  detectedAt: string;
  status: "open" | "corrected" | "confirmed";
}

export interface Correction {
  id: string;
  anomalyId: string;
  correctedBy: string;
  correctionType: string;
  beforeValue: string;
  afterValue: string;
  reason: string;
  correctedAt: string;
}

export interface Signature {
  id: string;
  restorationId: string;
  signerName: string;
  signerRole: "restorer" | "reviewer";
  signatureData: string;
  signedAt: string;
}

export interface TraceChainItem {
  anomaly: Anomaly;
  corrections: Correction[];
  confirmationSignature?: Signature;
}

export const STEP_TYPE_LABELS: Record<RestorationStep["type"], string> = {
  cleaning: "清洁",
  color_correction: "补色",
  reinforcement: "加固",
  other: "其他",
};

export const ARTWORK_STATUS_LABELS: Record<Artwork["status"], string> = {
  pending: "待处理",
  in_progress: "修复中",
  completed: "已完成",
  archived: "已归档",
};

export const RESTORATION_STATUS_LABELS: Record<Restoration["status"], string> = {
  draft: "草稿",
  in_progress: "进行中",
  under_review: "审核中",
  approved: "已批准",
  rejected: "已退回",
};

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  missing_photo: "照片缺失",
  batch_number_error: "材料批号错误",
  step_order_inverted: "步骤顺序倒置",
  material_expired: "材料过期",
};

export const PHOTO_PHASE_LABELS: Record<Photo["phase"], string> = {
  before: "修复前",
  during: "修复中",
  after: "修复后",
};
