import {
  Activity,
  Download,
  History,
  Layers,
  Radio,
  Sparkles,
  X,
} from "lucide-react";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { useTimeFormatter } from "@/hooks/useTimeFormatter";
import { BUOY_LOGS, METRICS } from "@/data/mockData";
import { StatusBadge } from "./StatusBadge";

export function Header({ onExport }: { onExport: () => void }) {
  const { timeRange, anomalies, activeVersionTag, toggleHistoryDrawer, toggleQuickStart } =
    usePlaybackStore();
  const { fmtFull } = useTimeFormatter();
  const pending = anomalies.filter((a) => a.type === "pending_confirmation" && !a.confirmed).length;
  const anom = anomalies.filter((a) => a.type === "anomaly").length;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-ocean-950/60 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-tide-500 to-ocean-600 shadow-glow">
          <Activity className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold tracking-wide text-white">
            近岸水质时序回放
          </h1>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-200">
            <Radio className="h-3 w-3 text-tide-500" />
            <span>浮标 FB-QS-007 · 小包测试数据</span>
            <span className="opacity-50">·</span>
            <span>
              {fmtFull(timeRange[0])} ~ {fmtFull(timeRange[1])}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="chip">
          <Layers className="h-3 w-3" /> 指标 {METRICS.length}
        </span>
        <span className="chip">
          <Sparkles className="h-3 w-3" /> 数据点 {BUOY_LOGS.length}
        </span>
        <StatusBadge kind="anomaly" text={`异常 ${anom}`} />
        <StatusBadge kind="pending" text={`待确认 ${pending}`} />
        <span className="chip font-mono text-tide-400">{activeVersionTag}</span>

        <button className="btn-ghost" onClick={() => toggleHistoryDrawer()}>
          <History className="h-4 w-4" /> 历史版本
        </button>
        <button className="btn-ghost" onClick={() => toggleQuickStart()}>
          <Sparkles className="h-4 w-4" /> 快速上手
        </button>
        <button className="btn-primary" onClick={onExport}>
          <Download className="h-4 w-4" /> 导出结果
        </button>
      </div>
    </header>
  );
}
