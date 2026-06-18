import { Filter, RotateCcw } from "lucide-react";
import { ANOMALY_TYPE_LABELS, RECORD_KIND_META } from "@/data/types";
import type { AnomalyType, RecordKind } from "@/data/types";
import { cn } from "@/lib/utils";
import {
  ALL_ANOMALY_TYPES,
  ALL_KINDS,
  ALL_STATION_IDS,
  useOceanStore,
} from "@/store/useOceanStore";
import { STATIONS } from "@/store/useOceanStore";
import { GlassPanel, SectionHeader } from "@/components/ui/Primitives";

const ANOMALY_ICONS: Record<AnomalyType, string> = {
  temperature: "℃",
  salinity: "‰",
  pressure: "MPa",
  oxygen: "O₂",
};

export default function FilterPanel() {
  const filter = useOceanStore((s) => s.filter);
  const toggleFilterItem = useOceanStore((s) => s.toggleFilterItem);
  const setFilter = useOceanStore((s) => s.setFilter);
  const resetFilter = useOceanStore((s) => s.resetFilter);

  return (
    <GlassPanel className="flex flex-col">
      <SectionHeader
        title="筛选 · FILTER"
        icon={<Filter className="h-3.5 w-3.5" />}
        right={
          <button
            onClick={resetFilter}
            className="flex items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[9px] text-slate-400 transition hover:bg-white/10 hover:text-slate-200"
          >
            <RotateCcw className="h-2.5 w-2.5" /> 重置
          </button>
        }
      />
      <div className="flex flex-col gap-3 px-3.5 pb-3.5">
        {/* anomaly type */}
        <div>
          <div className="hud-label mb-1.5">异常类型</div>
          <div className="grid grid-cols-2 gap-1.5">
            {ALL_ANOMALY_TYPES.map((t) => {
              const active = filter.anomalyTypes.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleFilterItem("anomalyTypes", t)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 font-mono text-[10px] transition",
                    active
                      ? "border-glow-cyan/50 bg-glow-cyan/10 text-glow-cyan"
                      : "border-white/5 bg-white/[0.02] text-slate-500 hover:text-slate-300",
                  )}
                >
                  <span className="text-[11px]">{ANOMALY_ICONS[t]}</span>
                  {ANOMALY_TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>
        </div>

        {/* record kind */}
        <div>
          <div className="hud-label mb-1.5">记录类型</div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_KINDS.map((k) => {
              const active = filter.kinds.includes(k);
              const meta = RECORD_KIND_META[k as RecordKind];
              return (
                <button
                  key={k}
                  onClick={() => toggleFilterItem("kinds", k)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[10px] transition",
                    active
                      ? meta.bg + " " + meta.color
                      : "border-white/5 bg-white/[0.02] text-slate-500 hover:text-slate-300",
                  )}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* station */}
        <div>
          <div className="hud-label mb-1.5">站点</div>
          <div className="flex flex-wrap gap-1.5">
            {STATIONS.map((st) => {
              const active = filter.stationIds.includes(st.id);
              return (
                <button
                  key={st.id}
                  onClick={() => toggleFilterItem("stationIds", st.id)}
                  className={cn(
                    "rounded-md border px-2 py-1 font-mono text-[10px] transition",
                    active
                      ? "border-glow-blue/50 bg-glow-blue/10 text-glow-blue"
                      : "border-white/5 bg-white/[0.02] text-slate-500 hover:text-slate-300",
                  )}
                >
                  {st.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* depth */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="hud-label">深度区间 (m)</span>
            <span className="font-mono text-[10px] text-glow-cyan">
              {filter.depthRange[0]}–{filter.depthRange[1]}
            </span>
          </div>
          <input
            type="range"
            min={1000}
            max={4000}
            step={100}
            value={filter.depthRange[1]}
            onChange={(e) =>
              setFilter({ depthRange: [filter.depthRange[0], Number(e.target.value)] })
            }
            className="w-full accent-glow-cyan"
          />
          <div className="mt-0.5 flex justify-between font-mono text-[9px] text-slate-600">
            <span>1000</span>
            <span>{ALL_STATION_IDS.length} 站点可见</span>
            <span>4000</span>
          </div>
        </div>

        {/* only anomaly */}
        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2">
          <span className="font-mono text-[10px] text-slate-300">仅显示异常记录</span>
          <button
            onClick={() => setFilter({ onlyAnomaly: !filter.onlyAnomaly })}
            className={cn(
              "relative h-4 w-8 rounded-full transition",
              filter.onlyAnomaly ? "bg-warn-amber/80" : "bg-slate-700",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
                filter.onlyAnomaly ? "left-4" : "left-0.5",
              )}
            />
          </button>
        </label>
      </div>
    </GlassPanel>
  );
}
