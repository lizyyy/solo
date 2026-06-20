import { FunctionSquare, Ruler, Scale } from "lucide-react";
import { FORMULA } from "@/engine/formula";

export default function FormulaPanel() {
  const rb = FORMULA.resultBoundary;
  return (
    <section className="border border-line bg-carbon-900/50 p-5">
      <header className="mb-4 flex items-center gap-2">
        <FunctionSquare className="h-4 w-4 text-amber" />
        <h2 className="font-display text-sm font-bold tracking-wide text-bone">公式 · 单位 · 边界</h2>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-ash">
          formula spec
        </span>
      </header>

      <div className="mb-4 border border-amber/20 bg-carbon-950/60 p-4">
        <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-ash">
          {FORMULA.name}
        </div>
        <code className="block font-mono text-base text-amber-soft tnum">
          {FORMULA.expressionMono}
        </code>
      </div>

      <div className="grid gap-2 lg:grid-cols-5">
        {FORMULA.params.map((p) => (
          <div key={p.key} className="border border-line bg-carbon-850/60 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-ash">
              <Ruler className="h-3 w-3" />
              {p.canonicalName}
            </div>
            <div className="mt-1 font-mono text-[12px] text-bone">{p.canonicalUnit}</div>
            {p.boundary && (
              <div className="mt-1 font-mono text-[10px] text-ash">
                ∈ [{p.boundary.min}, {p.boundary.max}]
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 border border-line bg-carbon-850/60 p-2.5">
        <Scale className="h-3.5 w-3.5 text-pass" />
        <span className="text-[12px] text-bone">
          结果 <span className="font-mono">{FORMULA.resultName}</span>
        </span>
        <span className="font-mono text-[12px] text-ash">单位 {FORMULA.resultUnit}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[10px] text-ash">边界</span>
          <div className="relative h-1.5 w-40 bg-carbon-700">
            <div className="absolute inset-y-0 left-1/2 w-px bg-ash/40" />
            <span className="absolute -left-1 -bottom-4 font-mono text-[9px] text-ash">{rb.min}</span>
            <span className="absolute -right-1 -bottom-4 font-mono text-[9px] text-ash">{rb.max}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
