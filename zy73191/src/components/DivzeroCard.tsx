import { MaterialChip } from "./MaterialBadge";
import { Seq } from "./Seq";
import { formatNum } from "@/lib/utils";
import type { Material, Step } from "@/lib/types";

export function DivzeroCard({
  step,
  materials,
}: {
  step: Step;
  materials: Material[];
}) {
  const byId = Object.fromEntries(materials.map((m) => [m.id, m]));
  const causeMat = step.causedBy ? byId[step.causedBy.materialId] : undefined;
  const causeVar = step.causedBy?.varName === "a0" ? "a₀" : "a₁";
  const den = step.denIsBin ? `(${step.denStr})` : step.denStr;

  return (
    <section className="rounded-sm border-2 border-vermilion/40 bg-vermilion/5 p-5">
      <div className="flex items-center gap-2">
        <span className="font-serif text-xl font-bold text-vermilion">×</span>
        <h3 className="font-serif text-lg font-bold text-vermilion">
          第 {step.n} 项除零定位
        </h3>
      </div>

      <p className="mt-3 font-mono text-sm text-ink">
        <Seq sub={step.n} /> = {step.numStr} ÷ {den}，分母 ={" "}
        <span className="font-bold text-vermilion">0</span>，序列在此中断。
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-sm border border-rule bg-paper p-3">
          <p className="text-[11px] text-inkMute">使分母为 0 的边界值</p>
          <p className="mt-1 font-mono text-sm text-ink">
            {causeVar} = {formatNum(step.causedBy?.value)}
          </p>
          {causeMat && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <MaterialChip material={causeMat} />
              <span className="text-[11px] text-inkMute">
                原始说法：{causeMat.quote}
              </span>
            </div>
          )}
        </div>
        <div className="rounded-sm border border-rule bg-paper p-3">
          <p className="text-[11px] text-inkMute">本次代入值（含来源）</p>
          <ul className="mt-1 space-y-1 font-mono text-[12px] text-inkSoft">
            {step.substituted.map((v) => (
              <li key={v.token}>
                {v.token === "a1" ? "a(n−1)" : "a(n−2)"} = {formatNum(v.value)}
                <span className="text-inkMute">
                  {" "}
                  ·{" "}
                  {v.origin.kind === "boundary"
                    ? `边界 ${v.origin.varName}（来自材料）`
                    : `由 a_${v.origin.fromN} 推得`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-inkSoft">
        → 追到原始说法：除零根源是旧版边界 {causeVar} ={" "}
        {formatNum(step.causedBy?.value)}，见上方来源材料的"原始说法"；后补备注已将其修正，见下方"修正后推演"对照。
      </p>
    </section>
  );
}
