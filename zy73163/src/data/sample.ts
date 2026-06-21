import type {
  BoundarySample,
  CalcSpec,
  MatrixCell,
  NoteSourceType,
  ScoringNote,
  UnitMissingRecord,
  Material,
} from "@/types";

// ---- 用户与物品 ----
export const USERS = ["U01", "U02", "U03", "U04", "U05", "U06"] as const;
export const ITEMS = [
  "I01 镜头模组",
  "I02 主板",
  "I03 电池",
  "I04 屏幕",
  "I05 外壳",
  "I06 充电IC",
  "I07 摄像座",
  "I08 连接器",
] as const;

// 确定性伪随机（保证示例可复现）
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260619);

// 预测评分基准（模拟矩阵分解 U·V 的重建值，1~5 分）
function basePredict(u: number, i: number): number {
  const userBias = [0.2, -0.1, 0.4, -0.3, 0.1, 0.0][u] ?? 0;
  const itemBias = [0.3, -0.2, 0.1, 0.5, -0.4, 0.2, 0.0, -0.1][i] ?? 0;
  const latent = 3.2 + userBias + itemBias + (rand() - 0.5) * 0.3;
  return Math.max(1, Math.min(5, latent));
}

// 叙事性覆盖：指定格的观测评分 / 异常 / 单位缺失 / 来源
interface CellOverride {
  u: number;
  i: number;
  actual?: number;
  predicted?: number;
  hasUnit?: boolean;
  source?: NoteSourceType;
  anomaly?: boolean;
  reason?: string;
}

const OVERRIDES: CellOverride[] = [
  // 异常：预测与观测严重偏离（单位缺失被揉进正常结果的典型）
  { u: 0, i: 3, actual: 4.8, predicted: 2.1, anomaly: true, source: "oldVersion", reason: "旧版口径把屏幕良率口径当 0~1，本版应为 0~5，预测被压低" },
  { u: 2, i: 5, actual: 1.2, predicted: 4.6, anomaly: true, source: "verbal", reason: "口头备注说充电IC 改用新供应商，旧因子矩阵未更新" },
  { u: 4, i: 0, actual: 2.5, predicted: 4.9, anomaly: true, source: "normal", reason: "正常记录但样本极少（边界样本），靠直觉补的评分" },
  // 单位缺失：明确隔离
  { u: 1, i: 4, predicted: 3.3, hasUnit: false, source: "normal", anomaly: true, reason: "外壳评分缺少量纲（百分比 vs 计数），不能并入正常结果" },
  { u: 3, i: 6, predicted: 3.8, hasUnit: false, source: "oldVersion", anomaly: true, reason: "摄像座单位缺失，旧版备注沿用，需隔离复核" },
  // 正常观测
  { u: 0, i: 0, actual: 4.2, source: "normal" },
  { u: 0, i: 1, actual: 2.8, source: "normal" },
  { u: 1, i: 1, actual: 3.0, source: "normal" },
  { u: 1, i: 2, actual: 3.6, source: "normal" },
  { u: 2, i: 2, actual: 4.1, source: "normal" },
  { u: 2, i: 3, actual: 3.4, source: "normal" },
  { u: 3, i: 0, actual: 2.9, source: "oldVersion" },
  { u: 3, i: 3, actual: 4.5, source: "normal" },
  { u: 4, i: 4, actual: 3.1, source: "normal" },
  { u: 5, i: 5, actual: 2.6, source: "verbal" },
  { u: 5, i: 7, actual: 3.9, source: "normal" },
  { u: 4, i: 7, actual: 2.2, source: "oldVersion" },
];

export const ANOMALY_THRESHOLD = 1.4;

export function buildMatrix(): MatrixCell[] {
  const cells: MatrixCell[] = [];
  const overrideMap = new Map<string, CellOverride>();
  for (const o of OVERRIDES) overrideMap.set(`${o.u}:${o.i}`, o);

  USERS.forEach((userId, u) => {
    ITEMS.forEach((itemIdFull, i) => {
      const itemId = itemIdFull.split(" ")[0];
      const o = overrideMap.get(`${u}:${i}`);
      const predicted = o?.predicted ?? Math.round(basePredict(u, i) * 100) / 100;
      const actual = o?.actual;
      const error = actual != null ? Math.round(Math.abs(actual - predicted) * 100) / 100 : 0;
      const hasUnit = o?.hasUnit ?? true;
      const sourceType: NoteSourceType = o?.source ?? (rand() > 0.7 ? "verbal" : "normal");
      const anomaly = o?.anomaly ?? (actual != null && error >= ANOMALY_THRESHOLD);
      cells.push({
        userId,
        itemId,
        itemIdFull,
        actualRating: actual,
        predictedRating: predicted,
        error,
        hasUnit,
        sourceType,
        anomaly,
        anomalyReason: o?.reason,
      } as MatrixCell & { itemIdFull: string });
    });
  });
  return cells;
}

// ---- 计算口径 ----
export const CALC_SPECS: CalcSpec[] = [
  {
    id: "spec-v2",
    runId: "run-2026-06-v3",
    name: "2026-06 矩阵分解 v3（当前）",
    basis:
      "隐因子 k=8，L2 正则 0.02，迭代 200 轮，学习率 0.005；评分统一为 0~5 分制；单位缺失记录不进入训练。",
    factors: 8,
    regularization: 0.02,
    iterations: 200,
    learningRate: 0.005,
    createdAt: "2026-06-15T09:20:00+08:00",
  },
  {
    id: "spec-v1",
    runId: "run-2026-05-v2",
    name: "2026-05 矩阵分解 v2（旧版口径）",
    basis:
      "隐因子 k=6，L2 正则 0.05，迭代 120 轮；部分品类评分沿用 0~1 旧口径，未做量纲统一。",
    factors: 6,
    regularization: 0.05,
    iterations: 120,
    learningRate: 0.01,
    createdAt: "2026-05-20T14:00:00+08:00",
  },
];

export const CURRENT_CALC_SPEC_ID = "spec-v2";

// ---- 边界样本（样本少、凭感觉）----
export const BOUNDARY_SAMPLES: BoundarySample[] = [
  {
    id: "bs-1",
    label: "U05 × 镜头模组",
    description: "仅有 1 条观测，评分 2.5，老叶凭感觉补到预测 4.9，误差大",
    intuitionBased: true,
    noteIds: ["note-3"],
  },
  {
    id: "bs-2",
    label: "U03 × 充电IC",
    description: "观测 1 条，口头备注称换了供应商，直觉判定偏低",
    intuitionBased: true,
    noteIds: ["note-2"],
  },
  {
    id: "bs-3",
    label: "U02 × 外壳",
    description: "单位缺失无法判定，暂不计入正常结果",
    intuitionBased: false,
    noteIds: ["note-4"],
  },
];

// ---- 评分备注（混入旧版/正常/口头）----
export const SCORING_NOTES: ScoringNote[] = [
  {
    id: "note-1",
    cellKey: "U01:I04",
    content: "屏幕良率旧口径按 0~1 记，本版应为 0~5，预测被压低至 2.1，需按比例放大复核。",
    sourceType: "oldVersion",
    sourceLabel: "2026-05 v2 备注旧版",
    calcSpecId: "spec-v2",
    influencesConclusion: true,
    author: "老叶",
    createdAt: "2026-06-16T10:00:00+08:00",
    version: 2,
  },
  {
    id: "note-2",
    cellKey: "U03:I06",
    content: "充电IC 从 5 月起换供应商，旧因子矩阵没更新，预测 4.6 偏高，实际 1.2。",
    sourceType: "verbal",
    sourceLabel: "供应商口头通知（值班人转述）",
    calcSpecId: "spec-v2",
    influencesConclusion: true,
    author: "算法值班人-阿哲",
    createdAt: "2026-06-17T16:30:00+08:00",
    version: 1,
  },
  {
    id: "note-3",
    cellKey: "U05:I01",
    content: "镜头模组只有 1 条观测，凭感觉补分，样本太少不纳入正式结论。",
    sourceType: "normal",
    sourceLabel: "正常记录-边界样本",
    calcSpecId: "spec-v2",
    influencesConclusion: false,
    author: "老叶",
    createdAt: "2026-06-17T09:10:00+08:00",
    version: 1,
  },
  {
    id: "note-4",
    cellKey: "U02:I05",
    content: "外壳评分缺量纲（百分比与计数混用），不能并入正常结果，先隔离。",
    sourceType: "normal",
    sourceLabel: "正常记录-单位缺失",
    calcSpecId: "spec-v2",
    influencesConclusion: true,
    author: "算法值班人-阿哲",
    createdAt: "2026-06-17T11:00:00+08:00",
    version: 1,
  },
  {
    id: "note-5",
    cellKey: "U04:I08",
    content: "连接器沿用旧版备注，评分 2.2 可能偏低，待本版口径复核。",
    sourceType: "oldVersion",
    sourceLabel: "2026-05 v2 备注旧版",
    calcSpecId: "spec-v2",
    influencesConclusion: false,
    author: "老叶",
    createdAt: "2026-06-16T10:05:00+08:00",
    version: 2,
  },
  {
    id: "note-6",
    cellKey: "U04:I07",
    content: "摄像座单位缺失，旧版备注沿用，隔离复核中。",
    sourceType: "oldVersion",
    sourceLabel: "2026-05 v2 备注旧版",
    calcSpecId: "spec-v2",
    influencesConclusion: false,
    author: "老叶",
    createdAt: "2026-06-16T10:08:00+08:00",
    version: 2,
  },
  {
    id: "note-7",
    content: "整体异常集中在屏幕与充电IC两类，灰度发布前需复核单位口径。",
    sourceType: "verbal",
    sourceLabel: "站会口头总结",
    calcSpecId: "spec-v2",
    influencesConclusion: true,
    author: "算法值班人-阿哲",
    createdAt: "2026-06-18T18:00:00+08:00",
    version: 1,
  },
];

// ---- 单位缺失隔离记录 ----
export const UNIT_MISSING_RECORDS: UnitMissingRecord[] = [
  {
    id: "um-1",
    cellKey: "U02:I05",
    userId: "U02",
    itemId: "I05",
    reason: "外壳评分缺少量纲（百分比 vs 计数），不能并入正常结果",
    quarantinedAt: "2026-06-17T11:05:00+08:00",
    restored: false,
  },
  {
    id: "um-2",
    cellKey: "U04:I07",
    userId: "U04",
    itemId: "I07",
    reason: "摄像座单位缺失，旧版备注沿用，需隔离复核",
    quarantinedAt: "2026-06-16T10:10:00+08:00",
    restored: false,
  },
];

// ---- 材料 ----
export const MATERIALS: Material[] = [
  {
    id: "mat-1",
    title: "评分口径对照表（0~1 旧版 vs 0~5 本版）",
    content: "屏幕良率：旧 0.42 → 本版 4.2；外壳：缺量纲待定；摄像座：缺量纲待定。",
    calcSpecId: "spec-v2",
    createdAt: "2026-06-16T10:30:00+08:00",
  },
  {
    id: "mat-2",
    title: "供应商变更口头通知纪要",
    content: "充电IC 自 5 月换供应商，旧因子未更新，预测偏高。",
    calcSpecId: "spec-v2",
    createdAt: "2026-06-17T16:35:00+08:00",
  },
];
