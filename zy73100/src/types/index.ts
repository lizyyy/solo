export type MaterialStatus = "待复核" | "已复核" | "异常";
export type SourceRowType = "标准行" | "后补备注行";

export interface MaterialItem {
  id: string;
  code: string;
  name: string;
  spec: string;
  batch: string;
  supplier: string;
  qty: string;
  status: MaterialStatus;
  sourceRowType: SourceRowType;
  remark: string;
  createdAt: string;
}

export type DrawingPointType = "雨水斗" | "立管" | "天沟" | "坡度";

export interface DrawingPoint {
  id: string;
  name: string;
  type: DrawingPointType;
  x: number;
  y: number;
  materialItemId: string;
  zone: "A" | "B" | "C" | "D";
  description?: string;
}

export type AnomalyType = "碰撞" | "坡度异常" | "变更未同步" | "材料不符";
export type AnomalySeverity = "一般" | "严重";
export type AnomalyStatus = "待确认" | "已确认正常" | "已确认异常";

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  drawingPointId: string;
  materialItemId: string;
  status: AnomalyStatus;
  confirmedBy?: string;
  confirmedAt?: string;
  description: string;
}

export interface SupplementNote {
  id: string;
  materialItemId: string;
  content: string;
  author: string;
  createdAt: string;
}

export type ActionType = "确认正常" | "标记异常" | "补录备注" | "状态修改";
export type TargetType = "材料行" | "异常点" | "图纸点位";

export interface ReviewAction {
  id: string;
  type: ActionType;
  targetType: TargetType;
  targetId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  operator: string;
  timestamp: string;
}

export type RouteKey =
  | "dashboard"
  | "material-review"
  | "drawing-review"
  | "export-center"
  | "review-log";
