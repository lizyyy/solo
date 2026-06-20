import type {
  AttributionResult,
  BoundaryCheck,
  CalcStep,
  GroupResult,
  Param,
  ParamSet,
  ParamStatus,
  ResultStatus,
} from "./types";
import { FORMULA, getSpec } from "./formula";
import { convertParam } from "./units";
import { buildMarkdown, fmt } from "./markdown";

export function evaluateParam(p: Param): { status: ParamStatus; note?: string } {
  const spec = getSpec(p.key);
  const raw = String(p.value).trim();
  const num = parseFloat(raw);
  if (raw === "" || Number.isNaN(num)) {
    return { status: "blocked", note: `取值「${raw || "(空)"}」非数字` };
  }
  const conv = convertParam(p.key, p.unit);
  if (!conv.ok) {
    return { status: "unit_missing", note: conv.reason };
  }
  if (spec.boundary) {
    const v = num * conv.factor;
    if (v < spec.boundary.min || v > spec.boundary.max) {
      return {
        status: "out_of_range",
        note: `${fmt(v)} 越出边界 [${spec.boundary.min}, ${spec.boundary.max}]`,
      };
    }
  }
  return { status: "ok" };
}

function runGroup(set: ParamSet): GroupResult {
  const steps: CalcStep[] = [];
  const boundaries: BoundaryCheck[] = [];
  let order = 0;
  let blocked = false;
  let blockReason: string | undefined;

  const vals: Record<string, number> = {};

  for (const p of set.params) {
    const spec = getSpec(p.key);
    const raw = String(p.value).trim();
    const num = parseFloat(raw);

    if (raw === "" || Number.isNaN(num)) {
      blocked = true;
      blockReason =
        blockReason ?? `「${spec.canonicalName}」取值「${raw || "(空)"}」非数字，归因被拦截。`;
      steps.push({
        order: order++,
        type: "substitute",
        group: set.id,
        detail: `代入 ${spec.canonicalName}`,
        before: raw || "(空)",
        after: "—",
        unit: spec.canonicalUnit,
      });
      continue;
    }

    const conv = convertParam(p.key, p.unit);
    if (!conv.ok) {
      blocked = true;
      blockReason = blockReason ?? conv.reason;
      steps.push({
        order: order++,
        type: "convert",
        group: set.id,
        detail: `${spec.canonicalName}：单位校验`,
        before: `${fmt(num)} ${conv.from}`,
        after: "—（拦截）",
        unit: conv.to,
      });
      continue;
    }

    const canonicalVal = num * conv.factor;
    vals[p.key] = canonicalVal;

    if (conv.factor !== 1) {
      steps.push({
        order: order++,
        type: "convert",
        group: set.id,
        detail: `${spec.canonicalName} 单位换算`,
        before: `${fmt(num)} ${conv.from}`,
        after: `${fmt(canonicalVal)} ${conv.to}`,
        unit: conv.to,
      });
    } else {
      steps.push({
        order: order++,
        type: "substitute",
        group: set.id,
        detail: `代入 ${spec.canonicalName}`,
        before: `${fmt(num)} ${conv.from}`,
        after: `${fmt(canonicalVal)} ${conv.to}`,
        unit: conv.to,
      });
    }
  }

  let finalValue: number | null = null;

  if (!blocked) {
    const hits = vals.hits;
    const spi = vals.scorePerItem;
    const diff = vals.difficulty;
    const dur = vals.duration;
    const tf = vals.timeFactor;

    if (!dur || !Number.isFinite(dur) || dur === 0) {
      blocked = true;
      blockReason = `「耗时」换算后为 ${fmt(dur)} 秒，触发除零，归因被拦截。`;
    }

    if (!blocked) {
      const s1 = hits * spi;
      steps.push({
        order: order++,
        type: "compute",
        group: set.id,
        detail: "命中数 × 单题分值",
        before: `${fmt(hits)} × ${fmt(spi)}`,
        after: `${fmt(s1)}`,
        unit: "分",
      });
      const s2 = s1 * diff;
      steps.push({
        order: order++,
        type: "compute",
        group: set.id,
        detail: "× 难度",
        before: `${fmt(s1)} × ${fmt(diff)}`,
        after: `${fmt(s2)}`,
        unit: "分",
      });
      const s3 = s2 / dur;
      steps.push({
        order: order++,
        type: "compute",
        group: set.id,
        detail: "÷ 耗时(秒)",
        before: `${fmt(s2)} ÷ ${fmt(dur)}`,
        after: `${fmt(s3)}`,
        unit: "分",
      });
      const s4 = s3 * tf;
      steps.push({
        order: order++,
        type: "compute",
        group: set.id,
        detail: "× 时长系数",
        before: `${fmt(s3)} × ${fmt(tf)}`,
        after: `${fmt(s4)}`,
        unit: FORMULA.resultUnit,
      });
      finalValue = s4;

      for (const spec of FORMULA.params) {
        if (spec.boundary) {
          const v = vals[spec.key];
          const ok = v >= spec.boundary.min && v <= spec.boundary.max;
          boundaries.push({
            name: spec.canonicalName,
            value: v,
            min: spec.boundary.min,
            max: spec.boundary.max,
            ok,
            unit: spec.canonicalUnit,
          });
          steps.push({
            order: order++,
            type: "boundary",
            group: set.id,
            detail: `边界校验 ${spec.canonicalName}`,
            before: `${fmt(v)}`,
            after: ok ? "通过" : "越界",
            unit: spec.canonicalUnit,
          });
        }
      }

      const rb = FORMULA.resultBoundary;
      const rok = finalValue >= rb.min && finalValue <= rb.max;
      boundaries.push({
        name: FORMULA.resultName,
        value: finalValue,
        min: rb.min,
        max: rb.max,
        ok: rok,
        unit: FORMULA.resultUnit,
      });
      steps.push({
        order: order++,
        type: "boundary",
        group: set.id,
        detail: `结果边界校验 ${FORMULA.resultName}`,
        before: `${fmt(finalValue)}`,
        after: rok ? "通过" : "越界",
        unit: FORMULA.resultUnit,
      });
    }
  }

  return {
    group: set.id,
    steps,
    boundaries,
    finalValue,
    finalUnit: FORMULA.resultUnit,
    blocked,
    blockReason,
  };
}

export function runAttribution(setA: ParamSet, setB: ParamSet): AttributionResult {
  const gA = runGroup(setA);
  const gB = runGroup(setB);

  let status: ResultStatus = "pass";
  let blockReason: string | undefined;

  if (gA.blocked || gB.blocked) {
    status = "blocked";
    const reasons: string[] = [];
    if (gA.blocked && gA.blockReason) reasons.push(`A组：${gA.blockReason}`);
    if (gB.blocked && gB.blockReason) reasons.push(`B组：${gB.blockReason}`);
    blockReason = reasons.join("；");
  } else {
    const anyWarn = [gA, gB].some((g) => g.boundaries.some((b) => !b.ok));
    if (anyWarn) status = "warn";
  }

  const delta =
    !gA.blocked && !gB.blocked && gA.finalValue != null && gB.finalValue != null
      ? gA.finalValue - gB.finalValue
      : null;
  const deltaPct =
    delta != null && gB.finalValue !== 0 ? (delta / Math.abs(gB.finalValue)) * 100 : null;

  const result: AttributionResult = {
    status,
    blockReason,
    groups: { A: gA, B: gB },
    delta,
    deltaPct,
    markdown: "",
    ts: Date.now(),
  };
  result.markdown = buildMarkdown(setA, setB, result);
  return result;
}
