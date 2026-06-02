export type PointStatus = "processed" | "pending" | "field_review";

export interface Point {
  id: string;
  standardName: string;
  schoolName: string;
  status: PointStatus;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Feedback {
  id: string;
  pointId: string;
  originalText: string;
  content: string;
  sourceType: "resident_form" | "field_photo" | "approval_record";
  sourceDetail: string;
  rawRemark: string;
  feedbackDate: string;
  createdAt: string;
}

export interface PlanVersion {
  id: string;
  pointId: string;
  versionNumber: number;
  description: string;
  changedBy: string;
  changeNote: string;
  createdAt: string;
}

export interface JudgmentLog {
  id: string;
  pointId: string;
  fromStatus: PointStatus | null;
  toStatus: PointStatus;
  reason: string;
  operator: string;
  createdAt: string;
}

export interface AliasName {
  id: string;
  pointId: string;
  alias: string;
  source: string;
  createdAt: string;
}

export interface MergeSuggestion {
  id: string;
  sourcePointId: string;
  targetPointId: string;
  similarity: number;
  status: "pending" | "confirmed" | "rejected";
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export const STATUS_LABELS: Record<PointStatus, string> = {
  processed: "已处理",
  pending: "待核实",
  field_review: "需现场复看",
};

export const SOURCE_TYPE_LABELS: Record<Feedback["sourceType"], string> = {
  resident_form: "居民反馈表",
  field_photo: "现场照片",
  approval_record: "审批记录",
};
