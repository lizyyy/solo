import type { ParamSpec } from "./types";

export interface FormulaStep {
  label: string;
  op: "×" | "÷";
}

export interface FormulaDef {
  id: string;
  name: string;
  expression: string;
  expressionMono: string;
  params: ParamSpec[];
  resultName: string;
  resultUnit: string;
  resultBoundary: { min: number; max: number };
  steps: FormulaStep[];
}

export const FORMULA: FormulaDef = {
  id: "attribution-score",
  name: "错题归因得分",
  expression: "归因得分 = (命中数 × 单题分值 × 难度) ÷ 耗时 × 时长系数",
  expressionMono: "得分 = (命中数 · 单题分值 · 难度) / 耗时 · 时长系数",
  resultName: "归因得分",
  resultUnit: "分",
  resultBoundary: { min: 0, max: 100 },
  params: [
    {
      key: "hits",
      canonicalName: "命中数",
      canonicalUnit: "道",
      dimensionless: false,
      unitOptions: ["道", "题"],
    },
    {
      key: "scorePerItem",
      canonicalName: "单题分值",
      canonicalUnit: "分/道",
      dimensionless: false,
      unitOptions: ["分/道"],
    },
    {
      key: "difficulty",
      canonicalName: "难度",
      canonicalUnit: "无量纲",
      dimensionless: true,
      unitOptions: ["无量纲"],
      boundary: { min: 0, max: 1 },
    },
    {
      key: "duration",
      canonicalName: "耗时",
      canonicalUnit: "秒",
      dimensionless: false,
      unitOptions: ["秒", "分", "毫秒"],
    },
    {
      key: "timeFactor",
      canonicalName: "时长系数",
      canonicalUnit: "无量纲",
      dimensionless: true,
      unitOptions: ["无量纲"],
      boundary: { min: 0.5, max: 2 },
    },
  ],
  steps: [
    { label: "命中数 × 单题分值", op: "×" },
    { label: "× 难度", op: "×" },
    { label: "÷ 耗时(秒)", op: "÷" },
    { label: "× 时长系数", op: "×" },
  ],
};

export const PARAM_KEYS = FORMULA.params.map((p) => p.key);

export function getSpec(key: string): ParamSpec {
  const spec = FORMULA.params.find((p) => p.key === key);
  if (!spec) throw new Error(`未知参数 key: ${key}`);
  return spec;
}
