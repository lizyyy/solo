import { MaterialChip } from "./MaterialBadge";
import { Seq } from "./Seq";
import { formatNum } from "@/lib/utils";
import type { Material, ReviewPair } from "@/lib/types";

export function PlainSummary({
  review,
  materials,
}: {
  review: ReviewPair;
  materials: Material[];
}) {
  const hist = materials.find((m) => m.type === "历史答案");
  const note = materials.find((m) => m.type === "后补备注");
  const verbal = materials.find((m) => m.type === "口头备注");
  const old = review.old;
  const fixed = review.fixed;
  const div = old.result.find((s) => s.status === "divzero");
  const a2 = old.result.find((s) => s.n === 2)?.value;
  const lastFixed = fixed.result[fixed.result.length - 1];
  const causeVal = div?.causedBy?.value;
  const fixedStep = fixed.result.find((s) => s.n === div?.n);

  return (
    <section className="rounded-sm border border-rule bg-paperDeep/40 p-5 shadow-dossier">
      <h3 className="font-serif text-lg font-bold text-ink">
        通俗解读 · 讲给不看代码的人
      </h3>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-inkSoft">
        <p>
          这次复核的数列是{" "}
          <span className="font-mono text-ink">
            {old.numExpr} ÷ ({old.denExpr})
          </span>
          {hist && (
            <>
              （来源 <MaterialChip material={hist} />）
            </>
          )}
          。
        </p>
        <p>
          把旧版边界 a₀={old.a0}、a₁={old.a1} 代入，逐项往后算：a₂=
          {formatNum(a2)}；到 <Seq sub={div?.n ?? "?"} /> 时分母 ={" "}
          <span className="font-mono text-ink">{div?.denStr}</span> ={" "}
          <span className="font-bold text-vermilion">0</span>，算不下去——这就是
          <span className="font-bold text-vermilion">除零</span>，发生在第{" "}
          {div?.n} 项。
        </p>
        <p>
          根源是旧版把 a₁ 定成了 {formatNum(causeVal)}（
          {hist && <MaterialChip material={hist} />}）
          {verbal && (
            <>
              ；<MaterialChip material={verbal} /> 也提到 a₁ 取过{" "}
              {formatNum(causeVal)}
            </>
          )}
          。
        </p>
        <p>
          {note && <MaterialChip material={note} />} 把 a₁ 改成 {fixed.a1}，再算{" "}
          <Seq sub={div?.n ?? "?"} /> 分母 ={" "}
          <span className="font-mono text-ink">
            {formatNum(fixedStep?.denomValue)}
          </span>{" "}
          ≠ 0，序列就能继续到 <Seq sub={lastFixed?.n ?? "?"} />，没有除零。
        </p>
        <p className="border-t border-rule pt-3 text-ink">
          结论：旧版边界有除零风险，按后补备注修正后安全。每个数字都能在材料台与推演表里一一对应。
        </p>
      </div>
    </section>
  );
}
