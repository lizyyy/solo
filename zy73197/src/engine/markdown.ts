import type { AttributionResult, ParamSet } from "./types";
import { FORMULA } from "./formula";

export function fmt(n: number, d = 2): string {
  if (!Number.isFinite(n)) return "—";
  const r = Number(n.toFixed(d));
  return String(r);
}

function tsLabel(ts: number): string {
  const d = new Date(ts);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const STATUS_LABEL: Record<AttributionResult["status"], string> = {
  pass: "通过",
  warn: "警告（越界）",
  blocked: "拦截",
};

function paramTable(set: ParamSet): string {
  const rows = set.params.map((p) => {
    const statusLabel =
      p.status === "ok" ? "正常" : p.status === "unit_missing" ? "单位缺失" : p.status === "blocked" ? "拦截" : "越界";
    return `| ${p.canonicalName} | ${p.rawFieldName} | ${p.value || "—"} | ${p.unit || "(空)"} | ${statusLabel} |`;
  });
  return [
    `| 参数 | 来源字段 | 取值 | 单位 | 处理状态 |`,
    `|------|----------|------|------|----------|`,
    ...rows,
  ].join("\n");
}

function stepsBlock(result: AttributionResult, group: "A" | "B"): string {
  const g = result.groups[group];
  if (g.blocked) {
    return `> 已拦截：${g.blockReason ?? "未知原因"}\n> 无中间计算可展开。`;
  }
  const lines = g.steps.map((s) => {
    const tag =
      s.type === "convert"
        ? "换算"
        : s.type === "substitute"
          ? "代入"
          : s.type === "compute"
            ? "计算"
            : "边界";
    const tail = s.unit && s.unit !== "无量纲" ? ` ${s.unit}` : "";
    return `${s.order + 1}. [${tag}] ${s.detail} → ${s.before} = ${s.after}${tail}`;
  });
  return lines.join("\n");
}

function boundaryTable(result: AttributionResult): string {
  const rows: string[] = [];
  (["A", "B"] as const).forEach((g) => {
    const grp = result.groups[g];
    if (grp.blocked) {
      rows.push(`| ${g} | — | — | — | 拦截 |`);
      return;
    }
    for (const b of grp.boundaries) {
      rows.push(
        `| ${g} | ${b.name} | ${fmt(b.value)} ${b.unit} | [${b.min}, ${b.max}] | ${b.ok ? "通过" : "越界"} |`,
      );
    }
  });
  return [
    `| 组 | 项目 | 值 | 边界 | 结果 |`,
    `|------|------|------|------|------|`,
    ...rows,
  ].join("\n");
}

export function buildMarkdown(setA: ParamSet, setB: ParamSet, result: AttributionResult): string {
  const gA = result.groups.A;
  const gB = result.groups.B;
  const aVal = gA.finalValue != null ? `${fmt(gA.finalValue)} ${FORMULA.resultUnit}` : "—（已拦截）";
  const bVal = gB.finalValue != null ? `${fmt(gB.finalValue)} ${FORMULA.resultUnit}` : "—（已拦截）";
  const delta =
    result.delta != null
      ? `${result.delta >= 0 ? "+" : ""}${fmt(result.delta)} ${FORMULA.resultUnit}`
      : "—";
  const deltaPct =
    result.deltaPct != null
      ? `${result.deltaPct >= 0 ? "+" : ""}${fmt(result.deltaPct, 1)}%`
      : "—";

  const exceptions: string[] = [];
  (["A", "B"] as const).forEach((g) => {
    const set = g === "A" ? setA : setB;
    for (const p of set.params) {
      if (p.status !== "ok") {
        exceptions.push(`- ${g}组「${p.canonicalName}」（来源字段 ${p.rawFieldName}）：${p.note ?? p.status}`);
      }
    }
  });

  return `# 错题归因报告

> 生成时间：${tsLabel(result.ts)}
> 状态：${STATUS_LABEL[result.status]}${result.blockReason ? ` — ${result.blockReason}` : ""}

## 1. 公式

\`\`\`
${FORMULA.expression}
\`\`\`

- 结果名称：${FORMULA.resultName}
- 结果单位：${FORMULA.resultUnit}
- 结果边界：[${FORMULA.resultBoundary.min}, ${FORMULA.resultBoundary.max}]

## 2. 参数与单位

### A 组（来源：${setA.source || "未标注"}）

${paramTable(setA)}

### B 组（来源：${setB.source || "未标注"}）

${paramTable(setB)}

## 3. 单位换算与中间计算

### A 组

${stepsBlock(result, "A")}

### B 组

${stepsBlock(result, "B")}

## 4. 边界校验

${boundaryTable(result)}

## 5. 结论

- A 组归因得分：${aVal}
- B 组归因得分：${bVal}
- 差值（A − B）：${delta}
- 差值占比（相对 B）：${deltaPct}
- 综合状态：${STATUS_LABEL[result.status]}

## 6. 来源与处理状态

- A 组来源：${setA.source || "未标注"}
- B 组来源：${setB.source || "未标注"}
- 异常明细：
${exceptions.length ? exceptions.join("\n") : "- 无"}

---

*由「优化调参错题归因」工作台自动生成。公式、单位、边界值与中间计算全程留痕。*
`;
}
