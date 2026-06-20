import { Link } from "react-router-dom";
import { SectionHeading } from "@/components/SectionHeading";
import { StepperTable } from "@/components/StepperTable";
import { DivzeroCard } from "@/components/DivzeroCard";
import { ConclusionCard } from "@/components/ConclusionCard";
import { PlainSummary } from "@/components/PlainSummary";
import { JudgmentChanger } from "@/components/JudgmentChanger";
import { Seq } from "@/components/Seq";
import { useReviewStore } from "@/store/useReviewStore";
import { ArrowRight, AlertTriangle } from "lucide-react";

export default function ReviewReport() {
  const review = useReviewStore((s) => s.review);
  const materials = useReviewStore((s) => s.materials);

  if (!review) {
    return (
      <div>
        <SectionHeading index="02" title="复核报告" />
        <div className="rounded-sm border border-rule bg-paper p-10 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-amberInk" />
          <p className="mt-3 text-sm text-inkSoft">还没有复核结果。</p>
          <Link
            to="/"
            className="mt-3 inline-block rounded-sm bg-vermilion px-4 py-2 text-sm font-medium text-paper hover:bg-vermilion-deep"
          >
            去材料台一键复核
          </Link>
        </div>
      </div>
    );
  }

  const old = review.old;
  const fixed = review.fixed;
  const div = old.result.find((s) => s.status === "divzero");

  return (
    <div className="space-y-6">
      <SectionHeading
        index="02"
        title="复核报告"
        kicker="逐项推演 · 除零定位 · 结论溯源 · 通俗解读"
      />

      <section className="rounded-sm border border-rule bg-paper p-5 shadow-dossier">
        <h3 className="font-serif text-base font-bold text-ink">复核对象</h3>
        <p className="mt-2 font-mono text-sm text-ink">
          递推式：<Seq sub="n" /> = {old.numExpr} ÷ ({old.denExpr})
        </p>
        <p className="mt-1 font-mono text-sm text-inkSoft">
          旧版边界：a₀ = {old.a0}，a₁ = {old.a1}；修正边界：a₁ = {fixed.a1}
        </p>
      </section>

      {div && <DivzeroCard step={div} materials={materials} />}

      <section>
        <h3 className="mb-3 font-serif text-base font-bold text-ink">
          推演对照
          <span className="ml-2 text-xs font-normal text-inkMute">
            左旧版（有除零） · 右修正（无除零）
          </span>
        </h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <StepperTable run={old} caption="旧版 · 逐项推演" />
          <StepperTable run={fixed} caption="修正 · 逐项推演" />
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-serif text-base font-bold text-ink">
          结论与溯源
        </h3>
        <div className="space-y-3">
          {review.conclusions.map((c) => (
            <ConclusionCard key={c.id} conclusion={c} materials={materials} />
          ))}
        </div>
      </section>

      <PlainSummary review={review} materials={materials} />

      <JudgmentChanger />

      <div className="text-center">
        <Link
          to="/audit"
          className="inline-flex items-center gap-1.5 text-sm text-indigoInk underline-offset-4 hover:underline"
        >
          查看完整判断历史 <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
