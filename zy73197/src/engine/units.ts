import { FORMULA, getSpec } from "./formula";

export interface Conversion {
  from: string;
  to: string;
  factor: number;
  ok: boolean;
  reason?: string;
}

const UNIT_FACTORS: Record<string, { unit: string; factor: number }[]> = {
  hits: [
    { unit: "道", factor: 1 },
    { unit: "题", factor: 1 },
  ],
  scorePerItem: [{ unit: "分/道", factor: 1 }],
  difficulty: [{ unit: "无量纲", factor: 1 }],
  duration: [
    { unit: "秒", factor: 1 },
    { unit: "分", factor: 60 },
    { unit: "毫秒", factor: 0.001 },
  ],
  timeFactor: [{ unit: "无量纲", factor: 1 }],
};

export function convertParam(key: string, unit: string): Conversion {
  const spec = getSpec(key);
  const list = UNIT_FACTORS[key] ?? [];
  const canonical = spec.canonicalUnit;

  if (spec.dimensionless) {
    return { from: unit || "无量纲", to: canonical, factor: 1, ok: true };
  }

  if (!unit || unit.trim() === "") {
    return {
      from: "(空)",
      to: canonical,
      factor: 0,
      ok: false,
      reason: `「${spec.canonicalName}」单位缺失：无法确定换算因子（如 分↔秒），归因被拦截。请补全单位后重跑。`,
    };
  }

  const found = list.find((u) => u.unit === unit);
  if (!found) {
    return {
      from: unit,
      to: canonical,
      factor: 0,
      ok: false,
      reason: `「${spec.canonicalName}」出现未知单位「${unit}」：不在受支持单位（${list
        .map((u) => u.unit)
        .join(" / ")}）内，归因被拦截。`,
    };
  }

  return { from: unit, to: canonical, factor: found.factor, ok: true };
}

export function unitOptions(key: string): string[] {
  return getSpec(key).unitOptions;
}

export function allUnitOptions(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const p of FORMULA.params) map[p.key] = p.unitOptions;
  return map;
}
