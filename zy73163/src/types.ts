// 来源类型：评分备注旧版 / 正常记录 / 口头备注
export type NoteSourceType = "oldVersion" | "normal" | "verbal";

// 计算口径（每次 run）
export interface CalcSpec {
  id: string;
  runId: string;
  name: string; // 如 "2026-06 矩阵分解 v3"
  basis: string; // 计算口径说明
  factors: number; // k
  regularization: number;
  iterations: number;
  learningRate: number;
  createdAt: string;
}

// 矩阵单元
export interface MatrixCell {
  userId: string;
  itemId: string;
  itemIdFull?: string; // 带名称的完整标识（如 "I01 镜头模组"）
  actualRating?: number; // 观测评分（可能缺失）
  predictedRating: number; // 分解预测
  error: number; // |actual - predicted|，无观测时为 0
  hasUnit: boolean; // 单位是否缺失
  sourceType: NoteSourceType;
  anomaly: boolean; // 误差超阈值或被标记
  anomalyReason?: string;
}

// 评分备注
export interface ScoringNote {
  id: string;
  cellKey?: string; // userId:itemId
  boundarySampleId?: string;
  content: string;
  sourceType: NoteSourceType;
  sourceLabel: string;
  calcSpecId: string;
  influencesConclusion: boolean;
  author: string;
  createdAt: string;
  version: number; // 旧版=低版本号
}

// 边界样本
export interface BoundarySample {
  id: string;
  label: string;
  description: string;
  intuitionBased: boolean; // 凭感觉
  noteIds: string[];
}

// 单位缺失隔离记录
export interface UnitMissingRecord {
  id: string;
  cellKey: string;
  userId: string;
  itemId: string;
  reason: string; // 为何判定单位缺失
  quarantinedAt: string;
  restored: boolean;
  restoreReason?: string;
}

// 导出快照
export interface ExportSnapshot {
  id: string;
  createdAt: string;
  summary: PageSummary;
  calcSpecId: string;
  calcSpecName: string;
  noteCount: number;
}

// 材料
export interface Material {
  id: string;
  title: string;
  content: string;
  calcSpecId: string;
  createdAt: string;
}

// 页面摘要（交叉印证用）
export interface PageSummary {
  totalCells: number;
  observedCells: number;
  anomalyCount: number;
  unitMissingCount: number;
  unitMissingActiveCount: number;
  notesBySource: Record<NoteSourceType, number>;
  conclusionInfluencingBySource: Record<NoteSourceType, number>;
  currentCalcSpecId: string;
  lastSavedAt: string;
}

export const SOURCE_META: Record<
  NoteSourceType,
  { label: string; short: string; colorVar: string; softVar: string; desc: string }
> = {
  oldVersion: {
    label: "评分备注旧版",
    short: "旧版",
    colorVar: "var(--old-version)",
    softVar: "var(--old-version-soft)",
    desc: "沿用上一版本的评分备注，需甄别是否仍适用本次口径",
  },
  normal: {
    label: "正常记录",
    short: "正常",
    colorVar: "var(--normal)",
    softVar: "var(--normal-soft)",
    desc: "本次口径下的标准记录，计入正常结果",
  },
  verbal: {
    label: "口头备注",
    short: "口头",
    colorVar: "var(--verbal)",
    softVar: "var(--verbal-soft)",
    desc: "未落文档的口头说明，需注明说话人与时间",
  },
};
