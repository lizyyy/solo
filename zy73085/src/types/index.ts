export type MinutesStatus = "pending" | "processing" | "resolved" | "suspended";
export type StructuralImportance = "critical" | "normal" | "minor";
export type AnomalyType = "material_missing" | "location_mismatch" | "status_conflict" | "unlinked_minutes";
export type AnomalySeverity = "critical" | "warning" | "info";
export type AnomalyStatus = "open" | "processing" | "resolved" | "suspended" | "released";
export type HoldDecision = "hold" | "release" | "evaluate" | null;

export interface FieldMapping {
  originalName: string;
  canonicalName: string;
  confidence: number;
  matchRound: "exact" | "alias" | "fuzzy" | "fallback";
}

export interface MeetingMinutes {
  id: string;
  source: string;
  status: MinutesStatus;
  rawContent: string;
  rawData: Record<string, unknown>;
  parsedData: Record<string, unknown>;
  fieldMappings: FieldMapping[];
  title?: string;
  meetingDate?: string;
  participant?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModelAnnotation {
  id: string;
  minutesId: string | null;
  locationCode: string;
  posX: number;
  posY: number;
  floor: string;
  area: string;
  highlightColor: string;
  description: string;
  structuralImportance: StructuralImportance;
  status: "normal" | "abnormal" | "suspended";
  createdAt: string;
  updatedAt: string;
}

export interface MaterialBatch {
  id: string;
  annotationId: string;
  materialType: string;
  batchNumber: string;
  testReport: string;
  isMissing: boolean;
  createdAt: string;
}

export interface Anomaly {
  id: string;
  annotationId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  status: AnomalyStatus;
  holdDecision: HoldDecision;
  holdReason: string;
  conclusionBefore?: string;
  conclusionAfter?: string;
  isRerunGenerated: boolean;
  runId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Snapshot {
  id: string;
  anomalyId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  operator: string;
  note: string;
  createdAt: string;
}

export interface Note {
  id: string;
  anomalyId: string;
  content: string;
  author: string;
  isProtected: boolean;
  createdAt: string;
}

export interface RerunTracker {
  runId: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "finished" | "failed";
  anomaliesCountBefore: number;
  anomaliesCountAfter: number;
  preservedNoteIds: string[];
}

export interface MaterialDecision {
  decision: HoldDecision;
  reason: string;
  impactLevel: "blocking" | "warning" | "none";
}

export interface FieldCompatRule {
  canonicalName: string;
  aliases: string[];
  confidenceThreshold: number;
}

export const FIELD_COMPAT_RULES: FieldCompatRule[] = [
  {
    canonicalName: "source",
    aliases: ["来源", "纪要来源", "会议来源", "出处", "文件来源", "source", "origin", "from"],
    confidenceThreshold: 0.7,
  },
  {
    canonicalName: "status",
    aliases: ["处理状态", "状态", "审核状态", "流程状态", "status", "state", "progress"],
    confidenceThreshold: 0.7,
  },
  {
    canonicalName: "title",
    aliases: ["标题", "会议标题", "主题", "纪要标题", "title", "subject", "topic"],
    confidenceThreshold: 0.7,
  },
  {
    canonicalName: "meetingDate",
    aliases: ["会议日期", "日期", "开会时间", "纪要时间", "date", "meetingTime", "时间"],
    confidenceThreshold: 0.7,
  },
  {
    canonicalName: "participant",
    aliases: ["参会人", "参与人", "出席人", "与会人员", "participant", "attendee"],
    confidenceThreshold: 0.7,
  },
  {
    canonicalName: "content",
    aliases: ["内容", "正文", "纪要内容", "会议内容", "content", "body", "detail"],
    confidenceThreshold: 0.7,
  },
  {
    canonicalName: "location",
    aliases: ["位置", "地点", "区域", "楼层位置", "location", "place", "area"],
    confidenceThreshold: 0.7,
  },
  {
    canonicalName: "description",
    aliases: ["描述", "变更描述", "问题描述", "说明", "description", "desc", "remark"],
    confidenceThreshold: 0.7,
  },
];

export const STATUS_ENUM_VALUES: Record<string, MinutesStatus> = {
  待处理: "pending",
  未处理: "pending",
  pending: "pending",
  处理中: "processing",
  复核中: "processing",
  审核中: "processing",
  processing: "processing",
  已解决: "resolved",
  已完成: "resolved",
  已关闭: "resolved",
  resolved: "resolved",
  done: "resolved",
  已挂起: "suspended",
  暂停: "suspended",
  suspended: "suspended",
  hold: "suspended",
};
