import { ArrowRight, Check } from "lucide-react";
import type { Diff } from "@/engine/types";

export function DiffView({ diffs }: { diffs: Diff[] }) {
  if (!diffs.length) {
    return (
      <div className="flex items-center gap-2 py-3 font-mono text-[12px] text-pass">
        <Check className="h-3.5 w-3.5" />
        无变化 — 人工确认与自动归因结果一致
      </div>
    );
  }
  return (
    <div className="divide-amber-line">
      {diffs.map((d, i) => (
        <div
          key={i}
          className="grid grid-cols-[150px_1fr_18px_1fr] items-center gap-2 py-2"
        >
          <span className="truncate font-mono text-[11px] text-amber">{d.path}</span>
          <span className="truncate font-mono text-[12px] text-block/70 line-through tnum">
            {d.before || "—"}
          </span>
          <ArrowRight className="h-3 w-3 text-ash/60" />
          <span className="truncate font-mono text-[12px] text-pass tnum">{d.after || "—"}</span>
        </div>
      ))}
    </div>
  );
}

export function DiffLegend() {
  return (
    <div className="flex items-center gap-4 font-mono text-[10px] text-ash">
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 bg-block/70" /> 自动归因（确认前）
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 bg-pass" /> 人工确认（确认后）
      </span>
    </div>
  );
}
