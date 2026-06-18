import { useEffect, useRef } from "react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { AnomalyBadge } from "@/components/Badges";
import type { SamplingParameter } from "@/types";
import { parameterConfig } from "@/components/Badges";

interface TimelineProps {
  parameter: SamplingParameter;
}

export function Timeline({ parameter }: TimelineProps) {
  const {
    getFilteredRecords,
    playback,
    anomalies,
    drifts,
    selectRecord,
    selectedRecordId,
  } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const records = getFilteredRecords();

  useEffect(() => {
    if (containerRef.current) {
      const activeEl = containerRef.current.querySelector("[data-active]");
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [playback.currentIndex]);

  const getValue = (r: typeof records[0]) => r.parameters[parameter];
  const values = records.map(getValue).filter((v): v is number => v !== null);
  const minVal = Math.min(...values) * 0.95;
  const maxVal = Math.max(...values) * 1.05;
  const range = maxVal - minVal || 1;

  const yOffset = (val: number | null) => {
    if (val === null) return 50;
    return 100 - ((val - minVal) / range) * 80 - 10;
  };

  const isAffectedByDrift = (index: number) => {
    return records[index]?.driftIds.length > 0;
  };

  const hasAnomaly = (index: number) => {
    return records[index]?.anomalies.length > 0;
  };

  const isWithdrawn = (index: number) => {
    return !!records[index]?.withdrawalId;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full", parameterConfig[parameter].color.replace("text-", "bg-"))} />
          {parameterConfig[parameter].label} ({parameterConfig[parameter].unit || "值"})
        </h3>
        <div className="text-xs text-slate-400">
          范围: {minVal.toFixed(2)} - {maxVal.toFixed(2)}
        </div>
      </div>

      <div className="relative h-32 border-b border-slate-100">
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {records.map((record, i) => {
            if (i === 0) return null;
            const prevVal = getValue(records[i - 1]);
            const currVal = getValue(record);
            if (prevVal === null || currVal === null) return null;

            const x1 = ((i - 1) / (records.length - 1)) * 100;
            const x2 = (i / (records.length - 1)) * 100;
            const y1 = yOffset(prevVal);
            const y2 = yOffset(currVal);

            const hasDrift = isAffectedByDrift(i - 1) || isAffectedByDrift(i);

            return (
              <line
                key={i}
                x1={`${x1}%`}
                y1={`${y1}%`}
                x2={`${x2}%`}
                y2={`${y2}%`}
                stroke={hasDrift ? "#f97316" : "#94a3b8"}
                strokeWidth={hasDrift ? 2.5 : 1.5}
                strokeDasharray={hasDrift ? "4 2" : "none"}
                opacity={isWithdrawn(i - 1) || isWithdrawn(i) ? 0.3 : 1}
              />
            );
          })}
        </svg>

        <div
          ref={containerRef}
          className="absolute inset-0 flex items-end justify-between px-1 overflow-x-auto"
        >
          {records.map((record, i) => {
            const val = getValue(record);
            const isActive = i === playback.currentIndex;
            const isSelected = record.id === selectedRecordId;
            const driftAffected = isAffectedByDrift(i);
            const anomaly = hasAnomaly(i);
            const withdrawn = isWithdrawn(i);
            const anomalyTypes = record.anomalies.map(
              (aId) => anomalies.find((a) => a.id === aId)?.type
            ).filter(Boolean) as any[];

            return (
              <div
                key={record.id}
                data-active={isActive ? "" : undefined}
                onClick={() => {
                  useStore.getState().jumpToIndex(i);
                  selectRecord(record.id);
                }}
                className={cn(
                  "relative flex-shrink-0 w-6 flex flex-col items-center cursor-pointer group",
                  withdrawn && "opacity-40"
                )}
              >
                {anomaly && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10">
                    {anomalyTypes.slice(0, 1).map((type) => (
                      <div key={type} className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    ))}
                  </div>
                )}

                <div
                  className={cn(
                    "w-3 h-3 rounded-full border-2 transition-all",
                    isActive || isSelected
                      ? "bg-blue-500 border-blue-600 scale-150 z-10"
                      : driftAffected
                      ? "bg-orange-100 border-orange-400"
                      : anomaly
                      ? "bg-red-100 border-red-400"
                      : "bg-white border-slate-300 group-hover:border-slate-500"
                  )}
                  style={{
                    position: "absolute",
                    bottom: `${yOffset(val)}%`,
                  }}
                />

                <div
                  className={cn(
                    "absolute bottom-0 w-0.5 h-4",
                    isActive ? "bg-blue-500" : "bg-slate-100"
                  )}
                />

                {i % 4 === 0 && (
                  <div className="absolute -bottom-5 text-[9px] text-slate-400 whitespace-nowrap">
                    {new Date(record.timestamp).toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-white border-2 border-slate-300" />
          <span className="text-slate-500">正常</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-orange-100 border-2 border-orange-400" />
          <span className="text-slate-500">漂移影响</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-100 border-2 border-red-400" />
          <span className="text-slate-500">异常</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-4 border-l-2 border-dashed border-orange-400" />
          <span className="text-slate-500">漂移区间</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="text-xs text-slate-500 mb-2">传感器漂移影响范围</div>
        <div className="space-y-1.5">
          {drifts.map((drift) => (
            <div key={drift.id} className="flex items-center gap-2 text-xs">
              <span className="font-mono text-slate-400">{drift.sensorId}</span>
              <span className={drift.driftDirection === "positive" ? "text-orange-600" : "text-blue-600"}>
                {drift.driftDirection === "positive" ? "+" : ""}{drift.driftValue}
              </span>
              <span className="text-slate-400">影响索引</span>
              <span className="font-mono text-slate-600">{drift.affectedStartIndex}-{drift.affectedEndIndex}</span>
              <span className="text-slate-400">来源行</span>
              <span className="font-mono text-slate-600">{drift.sourceLine}</span>
              {drift.corrected ? (
                <span className="text-emerald-600 text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded">已校准</span>
              ) : (
                <span className="text-amber-600 text-[10px] bg-amber-50 px-1.5 py-0.5 rounded">待校准</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
