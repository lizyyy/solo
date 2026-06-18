import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOceanStore } from "@/store/useOceanStore";
import { GlassPanel, SectionHeader } from "@/components/ui/Primitives";

const TIME_LABELS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];

type Tick = "normal" | "warning" | "blocked" | "none";

const STATUS_DOT: Record<Tick, string> = {
  normal: "bg-ok-emerald/40",
  warning: "bg-warn-amber",
  blocked: "bg-block-rose",
  none: "bg-slate-600",
};

export default function Timeline() {
  const timeIndex = useOceanStore((s) => s.timeIndex);
  const setTimeIndex = useOceanStore((s) => s.setTimeIndex);
  const selectedId = useOceanStore((s) => s.selectedSampleId);
  const samples = useOceanStore((s) => s.samples);
  const sample = samples.find((s) => s.id === selectedId);

  const tickStatus = (i: number): Tick => {
    if (!sample) return "none";
    return (sample.readings[i]?.status ?? "none") as Tick;
  };

  return (
    <GlassPanel className="px-2 py-2">
      <SectionHeader
        title="时间轴 · TIMELINE"
        icon={<Clock className="h-3.5 w-3.5" />}
        right={
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTimeIndex(Math.max(0, timeIndex - 1))}
              disabled={timeIndex <= 0}
              className="rounded-md border border-white/10 p-1 text-slate-300 transition hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="font-mono text-[11px] tabular-nums text-glow-cyan">
              {TIME_LABELS[timeIndex]}
            </span>
            <button
              onClick={() => setTimeIndex(Math.min(TIME_LABELS.length - 1, timeIndex + 1))}
              disabled={timeIndex >= TIME_LABELS.length - 1}
              className="rounded-md border border-white/10 p-1 text-slate-300 transition hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      />
      <div className="px-3 pb-3 pt-1">
        <div className="relative flex items-end justify-between">
          <div className="absolute left-0 right-0 top-1/2 -z-0 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-glow-cyan/30 to-transparent" />
          {TIME_LABELS.map((label, i) => {
            const active = i === timeIndex;
            const st = tickStatus(i);
            return (
              <button
                key={label}
                onClick={() => setTimeIndex(i)}
                className="group relative z-10 flex flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full border transition-all",
                    active
                      ? "scale-150 border-glow-cyan bg-glow-cyan shadow-glow"
                      : cn("border-transparent", STATUS_DOT[st]),
                  )}
                />
                <span
                  className={cn(
                    "font-mono text-[9px] tabular-nums transition",
                    active ? "text-glow-cyan" : "text-slate-500 group-hover:text-slate-300",
                  )}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between px-1">
          <span className="font-mono text-[9px] text-slate-600">
            {sample ? `${sample.code} 逐时刻读数` : "未选中对象 · 显示全部均值"}
          </span>
          <div className="flex items-center gap-2.5 font-mono text-[9px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-ok-emerald/60" /> 正常
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-warn-amber" /> 预警
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-block-rose" /> 拦截
            </span>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
