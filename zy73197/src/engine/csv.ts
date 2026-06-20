import type { AttributionResult, ParamSet } from "./types";
import { fmt } from "./markdown";

export function buildCsv(setA: ParamSet, setB: ParamSet, result: AttributionResult): string {
  const head = ["组", "参数", "来源字段", "取值", "单位", "处理状态", "最终得分", "综合状态"];
  const rows: string[][] = [head];

  (["A", "B"] as const).forEach((g) => {
    const set = g === "A" ? setA : setB;
    const grp = result.groups[g];
    const score = grp.finalValue != null ? fmt(grp.finalValue) : "—（拦截）";
    set.params.forEach((p) => {
      const statusLabel =
        p.status === "ok"
          ? "正常"
          : p.status === "unit_missing"
            ? "单位缺失"
            : p.status === "blocked"
              ? "拦截"
              : "越界";
      rows.push([
        g,
        p.canonicalName,
        p.rawFieldName,
        p.value || "—",
        p.unit || "(空)",
        statusLabel,
        score,
        result.status,
      ]);
    });
  });

  return rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
