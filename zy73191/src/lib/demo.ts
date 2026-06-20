import { contentHash } from "./hash";
import type {
  AuditEntry,
  Judgment,
  Material,
  MaterialContribution,
  MaterialType,
} from "./types";

function mk(
  id: string,
  type: MaterialType,
  version: string,
  source: string,
  content: string,
  quote: string,
  contributes?: MaterialContribution,
): Material {
  return {
    id,
    type,
    version,
    source,
    content,
    quote,
    contributes,
    contentHash: contentHash(type, version, content),
  };
}

export const seedMaterials: Material[] = [
  mk(
    "m-hist-v1",
    "历史答案",
    "v1（旧版）",
    "历史答案库 · 2026-06-18",
    "数列递推 a_n = a_{n-1} / (a_{n-2} - 3)；边界 a_0 = 5, a_1 = 3。",
    "边界 a_0 = 5, a_1 = 3",
    { recurrence: { num: "a1", den: "a2-3" }, boundary: { a0: 5, a1: 3 } },
  ),
  mk(
    "m-note-fix",
    "后补备注",
    "v2",
    "小岑 · 后补",
    "更正：边界 a_1 应为 2（旧版 a_1=3 会在 n=3 处使分母 a_{n-2}-3 = 0）。",
    "a_1 应为 2",
    { boundary: { a1: 2 } },
  ),
  mk(
    "m-verbal",
    "口头备注",
    "—",
    "复盘口头录音",
    "我记得边界 a_1 取过 3。",
    "a_1 取过 3",
  ),
];

const now = Date.now();
const day = 86400000;

export const seedJudgments: Judgment[] = [
  { factKey: "boundary-safety", value: "边界有除零风险（n=3）", ts: now - 3600000 },
];

export const seedAudit: AuditEntry[] = [
  {
    id: "a-seed-1",
    factKey: "boundary-safety",
    prevValue: "—（未复核）",
    nextValue: "边界安全（未见异常）",
    reason: "初次复核，边界样本少，凭经验判断安全，未逐项推演到 n=3。",
    actor: "小岑",
    ts: now - day,
  },
  {
    id: "a-seed-2",
    factKey: "boundary-safety",
    prevValue: "边界安全（未见异常）",
    nextValue: "边界有除零风险（n=3）",
    reason:
      "补算 n=3：分母 a_{n-2}-3 在 a_1=3 时为 0，源自历史答案 v1（旧版）；后补备注已将其修正为 2。",
    actor: "小岑",
    ts: now - 3600000,
  },
];

export const boundarySafetyFactKey = "boundary-safety";
