import { useExplanationStore } from "@/store/useExplanationStore";
import { SlidersHorizontal, BookText } from "lucide-react";
import { ProvenanceChip } from "@/components/ui/ProvenanceChip";
import { cn } from "@/lib/utils";

interface CalcSpecBarProps {
  highlighted?: boolean;
  className?: string;
}

export function CalcSpecBar({ highlighted, className }: CalcSpecBarProps) {
  const calcSpecs = useExplanationStore((s) => s.calcSpecs);
  const currentSpecId = useExplanationStore((s) => s.currentCalcSpecId);
  const setCurrentCalcSpec = useExplanationStore((s) => s.setCurrentCalcSpec);
  const spec = calcSpecs.find((c) => c.id === currentSpecId);

  if (!spec) return null;

  const params = [
    { k: "隐因子 k", v: spec.factors },
    { k: "L2 正则", v: spec.regularization },
    { k: "迭代轮数", v: spec.iterations },
    { k: "学习率", v: spec.learningRate },
  ];

  return (
    <div
      id="calc-spec-bar"
      className={cn(
        "paper-grain rounded-md border bg-surface p-4 transition-shadow",
        highlighted ? "border-anomaly shadow-atlas-lift" : "border-line shadow-atlas",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-surface-2 text-ink-soft">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-semibold text-ink">{spec.name}</h3>
              <span className="font-mono-data text-[10px] uppercase tracking-wider text-ink-mute">
                本次计算口径
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-ink-soft">{spec.basis}</p>
          </div>
        </div>
        <ProvenanceChip
          label="口径来源"
          calcSpec={spec}
          notes={[]}
          className="shrink-0"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-3">
        {params.map((p) => (
          <div key={p.k} className="flex items-baseline gap-1.5">
            <span className="font-mono-data text-[10px] uppercase tracking-wider text-ink-mute">
              {p.k}
            </span>
            <span className="font-mono-data text-sm font-semibold text-ink">{p.v}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <BookText className="h-3.5 w-3.5 text-ink-mute" />
          <span className="font-mono-data text-[10px] uppercase tracking-wider text-ink-mute">
            口径切换
          </span>
          <select
            value={currentSpecId}
            onChange={(e) => setCurrentCalcSpec(e.target.value)}
            className="rounded-atlas border border-line bg-surface px-2 py-1 font-mono-data text-xs text-ink focus:border-ink-mute focus:outline-none"
          >
            {calcSpecs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
