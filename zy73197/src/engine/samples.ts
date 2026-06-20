import type { Param, ParamSet, Sample } from "./types";
import { FORMULA, getSpec } from "./formula";

export function makeParam(key: string, value: string, unit: string, rawFieldName: string): Param {
  const spec = getSpec(key);
  return {
    key,
    canonicalName: spec.canonicalName,
    rawFieldName,
    value,
    unit,
    status: "ok",
  };
}

export function makeParamSet(
  id: "A" | "B",
  source: string,
  values: Record<string, { value: string; unit: string; rawFieldName?: string }>,
): ParamSet {
  const params: Param[] = FORMULA.params.map((spec) => {
    const v = values[spec.key] ?? { value: "", unit: spec.canonicalUnit };
    return makeParam(
      spec.key,
      v.value,
      v.unit,
      v.rawFieldName ?? spec.canonicalName,
    );
  });
  return { id, label: `${id} 组`, source, params };
}

const sourceMapA: Record<string, string> = {
  hits: "hit_count",
  scorePerItem: "score_per_item",
  difficulty: "diff_coef",
  duration: "cost_time",
  timeFactor: "time_k",
};
const sourceMapB: Record<string, string> = {
  hits: "命中数",
  scorePerItem: "单题分值",
  difficulty: "难度系数",
  duration: "耗时",
  timeFactor: "时长系数",
};

function fromMaps(
  id: "A" | "B",
  sourceLabel: string,
  srcMap: Record<string, string>,
  values: Record<string, { value: string; unit: string }>,
): ParamSet {
  const v: Record<string, { value: string; unit: string; rawFieldName?: string }> = {};
  for (const key of Object.keys(values)) {
    v[key] = { ...values[key], rawFieldName: srcMap[key] ?? key };
  }
  return makeParamSet(id, sourceLabel, v);
}

export const SAMPLES: Sample[] = [
  {
    id: "normal",
    name: "正常对照",
    tag: "normal",
    description: "A/B 两组单位齐全、结果在边界内，展示完整单位换算与中间计算。",
    setA: fromMaps(
      "A",
      "排班-v2字段表",
      sourceMapA,
      {
        hits: { value: "10", unit: "道" },
        scorePerItem: { value: "5", unit: "分/道" },
        difficulty: { value: "0.8", unit: "无量纲" },
        duration: { value: "2", unit: "分" },
        timeFactor: { value: "1.2", unit: "无量纲" },
      },
    ),
    setB: fromMaps(
      "B",
      "手工录入",
      sourceMapB,
      {
        hits: { value: "12", unit: "题" },
        scorePerItem: { value: "4.5", unit: "分/道" },
        difficulty: { value: "0.7", unit: "无量纲" },
        duration: { value: "150", unit: "秒" },
        timeFactor: { value: "1.0", unit: "无量纲" },
      },
    ),
  },
  {
    id: "unit_missing",
    name: "单位缺失拦截",
    tag: "unit_missing",
    description: "A 组「耗时」未填单位，归因被拦截并写明原因；B 组正常，便于对照。",
    setA: fromMaps(
      "A",
      "排班-v2字段表",
      sourceMapA,
      {
        hits: { value: "10", unit: "道" },
        scorePerItem: { value: "5", unit: "分/道" },
        difficulty: { value: "0.8", unit: "无量纲" },
        duration: { value: "2", unit: "" },
        timeFactor: { value: "1.2", unit: "无量纲" },
      },
    ),
    setB: fromMaps(
      "B",
      "手工录入",
      sourceMapB,
      {
        hits: { value: "12", unit: "题" },
        scorePerItem: { value: "4.5", unit: "分/道" },
        difficulty: { value: "0.7", unit: "无量纲" },
        duration: { value: "150", unit: "秒" },
        timeFactor: { value: "1.0", unit: "无量纲" },
      },
    ),
  },
  {
    id: "out_of_range",
    name: "越界警告",
    tag: "out_of_range",
    description: "A 组「难度」=1.5 超出 [0,1]，结果越界产出警告；B 组正常。",
    setA: fromMaps(
      "A",
      "排班-v2字段表",
      sourceMapA,
      {
        hits: { value: "10", unit: "道" },
        scorePerItem: { value: "5", unit: "分/道" },
        difficulty: { value: "1.5", unit: "无量纲" },
        duration: { value: "2", unit: "分" },
        timeFactor: { value: "1.2", unit: "无量纲" },
      },
    ),
    setB: fromMaps(
      "B",
      "手工录入",
      sourceMapB,
      {
        hits: { value: "12", unit: "题" },
        scorePerItem: { value: "4.5", unit: "分/道" },
        difficulty: { value: "0.7", unit: "无量纲" },
        duration: { value: "150", unit: "秒" },
        timeFactor: { value: "1.0", unit: "无量纲" },
      },
    ),
  },
];

export function defaultParamSets(): { A: ParamSet; B: ParamSet } {
  const s = SAMPLES[0];
  return { A: cloneSet(s.setA), B: cloneSet(s.setB) };
}

export function cloneSet(set: ParamSet): ParamSet {
  return {
    ...set,
    params: set.params.map((p) => ({ ...p })),
  };
}
