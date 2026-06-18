export type UserRole = "operator" | "analyst";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  roleLabel: string;
}

export type VersionLayer = "legacy" | "note" | "latest";

export type RecordKind = "smooth" | "supplement" | "anomaly";

export type AnomalyType = "temperature" | "salinity" | "pressure" | "oxygen";

export type ReadingStatus = "normal" | "warning" | "blocked";

export interface Station {
  id: string;
  name: string;
  code: string;
  position: [number, number, number];
  depth: number;
}

export interface Reading {
  id: string;
  timeLabel: string;
  timestamp: string;
  value: number;
  avg: number;
  max: number;
  min: number;
  status: ReadingStatus;
  drift: number;
}

export interface DriftEvent {
  id: string;
  readingTimeLabel: string;
  timestamp: string;
  drift: number;
  threshold: number;
  reason: string;
  reasonKey: "over-limit" | "spike" | "missing";
  blocked: boolean;
  blockedReason: string;
}

export interface HistoryVersion {
  id: string;
  layer: VersionLayer;
  layerLabel: string;
  createdAt: string;
  changedBy: string;
  changedByRole: string;
  manualEdited: boolean;
  changedField?: string;
  valueBefore?: number;
  valueAfter?: number;
  note: string;
  summary: string;
}

export interface Sample {
  id: string;
  stationId: string;
  label: string;
  code: string;
  kind: RecordKind;
  kindLabel: string;
  anomalyType: AnomalyType;
  anomalyTypeLabel: string;
  unit: string;
  depth: number;
  readings: Reading[];
  versions: HistoryVersion[];
  driftEvents: DriftEvent[];
}

export interface FilterState {
  anomalyTypes: AnomalyType[];
  kinds: RecordKind[];
  stationIds: string[];
  depthRange: [number, number];
  onlyAnomaly: boolean;
}

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  temperature: "温度异常",
  salinity: "盐度异常",
  pressure: "压力异常",
  oxygen: "溶解氧异常",
};

export const VERSION_LAYER_META: Record<
  VersionLayer,
  { label: string; short: string; color: string; dot: string; desc: string }
> = {
  legacy: {
    label: "旧处理",
    short: "旧",
    color: "text-glow-blue",
    dot: "bg-glow-blue",
    desc: "首次自动处理的快照",
  },
  note: {
    label: "后补备注",
    short: "补",
    color: "text-warn-amber",
    dot: "bg-warn-amber",
    desc: "人工补录或修订的备注",
  },
  latest: {
    label: "最新导出",
    short: "新",
    color: "text-ok-emerald",
    dot: "bg-ok-emerald",
    desc: "当前最新一次导出结果",
  },
};

export const READING_STATUS_META: Record<
  ReadingStatus,
  { label: string; color: string; dot: string; ring: string }
> = {
  normal: {
    label: "正常",
    color: "text-ok-emerald",
    dot: "bg-ok-emerald",
    ring: "shadow-glow",
  },
  warning: {
    label: "预警",
    color: "text-warn-amber",
    dot: "bg-warn-amber",
    ring: "shadow-glow-amber",
  },
  blocked: {
    label: "拦截",
    color: "text-block-rose",
    dot: "bg-block-rose",
    ring: "shadow-glow-rose",
  },
};

export const RECORD_KIND_META: Record<
  RecordKind,
  { label: string; color: string; bg: string }
> = {
  smooth: {
    label: "顺利记录",
    color: "text-ok-emerald",
    bg: "bg-ok-emerald/10 border-ok-emerald/30",
  },
  supplement: {
    label: "补录记录",
    color: "text-warn-amber",
    bg: "bg-warn-amber/10 border-warn-amber/30",
  },
  anomaly: {
    label: "异常记录",
    color: "text-block-rose",
    bg: "bg-block-rose/10 border-block-rose/30",
  },
};
