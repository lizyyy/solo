import { Activity, AlertTriangle, FileWarning, History } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { formatTime } from "@/utils/export";

export default function TopSummaryBar() {
  const { globalSummary, currentAnomalies, runs, drafts } = useAppStore();
  const conflict = currentAnomalies.filter(
    (a) => a.type === "answer_version_conflict"
  ).length;
  const dupSub = currentAnomalies.filter(
    (a) => a.type === "duplicate_submission"
  ).length;
  const dupSample = currentAnomalies.filter(
    (a) => a.type === "duplicate_sample"
  ).length;
  const missing = currentAnomalies.filter((a) => a.type === "missing_note")
    .length;
  const lastRun = runs[runs.length - 1];

  return (
    <header className="sticky top-0 z-30 bg-ink-500 text-fog-50 shadow-[0_4px_20px_rgba(15,30,49,0.25)]">
      <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-6">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-fog-50/10 border border-fog-50/20 flex items-center justify-center">
            <Activity size={18} />
          </div>
          <div>
            <h1 className="font-serif text-lg font-semibold tracking-wide leading-tight">
              误差传播批量验算
            </h1>
            <p className="text-xs text-fog-100/70 leading-tight">
              教研编辑工作台 · 阿宁专用
            </p>
          </div>
        </div>

        <div className="h-8 w-px bg-fog-50/15 shrink-0" />

        <div className="flex items-center gap-4 text-xs shrink-0">
          <div className="flex items-center gap-1.5">
            <FileWarning size={14} className="text-ochre-200" />
            <span className="text-fog-100/80">草稿</span>
            <span className="font-mono font-semibold text-white">
              {drafts.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-ochre-200" />
            <span className="text-fog-100/80">冲突</span>
            <span className="font-mono font-semibold text-white">{conflict}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <History size={14} className="text-moss-200" />
            <span className="text-fog-100/80">重提</span>
            <span className="font-mono font-semibold text-white">
              {dupSub}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-ochre-300" />
            <span className="text-fog-100/80">重样</span>
            <span className="font-mono font-semibold text-white">
              {dupSample}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileWarning size={14} className="text-fog-200/80" />
            <span className="text-fog-100/80">待补</span>
            <span className="font-mono font-semibold text-white">{missing}</span>
          </div>
        </div>

        <div className="h-8 w-px bg-fog-50/15 shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="text-sm text-fog-50/90 truncate">{globalSummary}</p>
        </div>

        <div className="shrink-0 text-xs text-fog-100/70 font-mono">
          {lastRun ? `最后运行 ${formatTime(lastRun.startedAt)}` : "尚未运行"}
        </div>
      </div>
    </header>
  );
}
