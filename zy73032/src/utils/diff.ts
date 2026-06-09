import type { DiffChunk } from "@/types";

export function deepDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): DiffChunk[] {
  const keys = new Set<string>();
  if (before) Object.keys(before).forEach((k) => keys.add(k));
  if (after) Object.keys(after).forEach((k) => keys.add(k));
  const result: DiffChunk[] = [];
  keys.forEach((k) => {
    const b = before ? before[k] : undefined;
    const a = after ? after[k] : undefined;
    result.push({
      key: k,
      before: b,
      after: a,
      changed: JSON.stringify(b) !== JSON.stringify(a),
    });
  });
  return result;
}

const FRIENDLY_KEYS: Record<string, string> = {
  petName: "宠物名",
  petId: "绑定规范宠物",
  courseName: "课程名称",
  courseDate: "上课日期",
  durationMin: "时长(分钟)",
  trainer: "训导师",
  status: "状态",
  confirmedAt: "确认时间",
  withdrawnAt: "撤回时间",
  confirmedBy: "操作人",
  aliasName: "别名",
  canonicalName: "规范名",
  species: "物种",
  gender: "性别",
  diagnosis: "诊断",
  treatment: "处置",
  visitDate: "就诊日期",
  veterinarian: "医生",
};

export function friendlyKey(k: string): string {
  return FRIENDLY_KEYS[k] || k;
}

export function formatValue(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "boolean") return v ? "是" : "否";
  if (typeof v === "object") return JSON.stringify(v, null, 0);
  if (typeof v === "string" && v.length === 0) return "（空）";
  return String(v);
}

export const STATUS_LABEL: Record<string, string> = {
  PENDING: "待确认",
  CONFIRMED: "已确认",
  WITHDRAWN: "已撤回",
  ANOMALY: "异常隔离",
};
