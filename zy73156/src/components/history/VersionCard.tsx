import { CheckCircle2, PenLine } from "lucide-react";
import type { HistoryVersion } from "@/data/types";
import { VERSION_LAYER_META } from "@/data/types";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  version: HistoryVersion;
  active: boolean;
  onSelect: () => void;
  index: number;
}

export default function VersionCard({ version, active, onSelect, index }: Props) {
  const meta = VERSION_LAYER_META[version.layer];
  return (
    <button
      onClick={onSelect}
      className="group relative w-full text-left"
    >
      {/* connector dot */}
      <div className="flex gap-3">
        <div className="flex flex-col items-center pt-1">
          <span
            className={cn(
              "z-10 h-3 w-3 rounded-full border-2",
              active ? "border-glow-cyan bg-glow-cyan shadow-glow" : cn("border-abyss-700", meta.dot),
            )}
          />
          <span className="mt-1 w-px flex-1 bg-gradient-to-b from-white/10 to-transparent" />
        </div>

        <div
          className={cn(
            "mb-3 flex-1 rounded-lg border p-3 transition",
            active
              ? "border-glow-cyan/40 bg-glow-cyan/[0.06]"
              : version.manualEdited
                ? "border-warn-amber/30 bg-warn-amber/[0.04] hover:bg-warn-amber/[0.08]"
                : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]",
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold",
                  meta.color,
                  "bg-current/10",
                )}
              >
                {meta.label}
              </span>
              {version.manualEdited ? (
                <span className="flex items-center gap-1 rounded bg-warn-amber/15 px-1.5 py-0.5 font-mono text-[9px] text-warn-amber">
                  <PenLine className="h-2.5 w-2.5" /> 人工修改 · 第 {index + 1} 步
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded bg-ok-emerald/10 px-1.5 py-0.5 font-mono text-[9px] text-ok-emerald">
                  <CheckCircle2 className="h-2.5 w-2.5" /> 自动
                </span>
              )}
            </div>
            <span className="font-mono text-[9px] text-slate-600">
              {fmtDateTime(version.createdAt)}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px]">
            <span className="text-slate-300">{version.changedBy}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{version.changedByRole}</span>
          </div>

          <p className="mt-1 font-mono text-[10px] leading-relaxed text-slate-400">
            {version.summary}
          </p>

          {version.manualEdited && version.changedField && (
            <div className="mt-2 rounded-md border border-warn-amber/20 bg-abyss-950/50 p-2">
              <div className="font-mono text-[9px] text-warn-amber">{version.changedField}</div>
              <div className="mt-1 flex items-center gap-2 font-mono text-[11px]">
                <span className="rounded bg-block-rose/10 px-1.5 py-0.5 text-block-rose line-through">
                  {fmtNum(version.valueBefore ?? 0)}
                </span>
                <span className="text-slate-500">→</span>
                <span className="rounded bg-ok-emerald/10 px-1.5 py-0.5 text-ok-emerald">
                  {fmtNum(version.valueAfter ?? 0)}
                </span>
              </div>
            </div>
          )}

          <p className="mt-2 font-mono text-[9px] leading-relaxed text-slate-500">
            {version.note}
          </p>
        </div>
      </div>
    </button>
  );
}
