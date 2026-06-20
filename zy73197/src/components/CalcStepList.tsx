import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import type { CalcStep, GroupResult } from "@/engine/types";

const TYPE_META: Record<CalcStep["type"], { label: string; cls: string }> = {
  substitute: { label: "代入", cls: "text-ash border-line bg-carbon-800/50" },
  convert: { label: "换算", cls: "text-amber border-amber/40 bg-amber/10" },
  compute: { label: "计算", cls: "text-bone border-line bg-carbon-800/50" },
  boundary: { label: "边界", cls: "text-pass border-pass/30 bg-pass/5" },
};

function StepRow({ step }: { step: CalcStep }) {
  const meta = TYPE_META[step.type];
  const afterOk = step.after === "通过";
  const afterBad = step.after === "越界" || step.after.includes("拦截");
  return (
    <div className="grid grid-cols-[28px_52px_1fr_auto] items-center gap-2 border-b border-line/60 py-2 last:border-0">
      <span className="font-mono text-[11px] text-ash tnum">{String(step.order + 1).padStart(2, "0")}</span>
      <span className={cn("inline-flex justify-center border px-1.5 py-0.5 font-mono text-[10px]", meta.cls)}>
        {meta.label}
      </span>
      <span className="min-w-0 truncate text-[12px] text-bone/90">{step.detail}</span>
      <span className="flex items-center gap-1.5 font-mono text-[12px] tnum">
        <span className="text-ash">{step.before}</span>
        <ArrowRight className="h-3 w-3 text-ash/60" />
        <span
          className={cn(
            "text-bone",
            afterOk && "text-pass",
            afterBad && "text-block",
            step.type === "convert" && "text-amber",
          )}
        >
          {step.after}
          {step.unit && step.unit !== "无量纲" ? ` ${step.unit}` : ""}
        </span>
      </span>
    </div>
  );
}

interface Props {
  group: GroupResult;
}

export function CalcStepList({ group }: Props) {
  const isA = group.group === "A";
  return (
    <section className="border border-line bg-carbon-900/50">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span
          className={cn(
            "grid h-6 w-6 place-items-center font-display text-xs font-extrabold",
            isA ? "bg-amber text-carbon-950" : "border border-bone/40 text-bone",
          )}
        >
          {group.group}
        </span>
        <h3 className="font-display text-sm font-bold tracking-tightest text-bone">
          中间计算 · 单位换算
        </h3>
        {group.blocked ? (
          <span className="ml-auto font-mono text-[11px] text-block">已拦截 · 无展开</span>
        ) : (
          <span className="ml-auto font-mono text-[11px] text-pass tnum">
            {group.finalValue != null ? group.finalValue.toFixed(2) : "—"} {group.finalUnit}
          </span>
        )}
      </header>

      {group.blocked ? (
        <div className="px-4 py-6">
          <div className="border border-block/40 bg-block/5 p-3 font-mono text-[12px] leading-relaxed text-block/90">
            <span className="font-bold">拦截原因：</span>
            {group.blockReason}
          </div>
          <p className="mt-2 text-[11px] text-ash">
            该组因上述原因无法完成单位换算 / 计算，归因被拦住，结果不产出。补全后重跑即可恢复中间步展开。
          </p>
        </div>
      ) : (
        <div className="px-4 py-1">
          {group.steps.map((s) => (
            <StepRow key={s.order} step={s} />
          ))}
        </div>
      )}
    </section>
  );
}
