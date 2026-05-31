import { useCallback } from "react";
import type { TimeRange } from "@/types";

interface TimelineTrackProps {
  label: string;
  color: string;
  items: { startTime: number; endTime: number; id: string; label?: string }[];
  timeRange: TimeRange;
  onClick?: (id: string) => void;
  highlightIds?: Set<string>;
}

export default function TimelineTrack({
  label,
  color,
  items,
  timeRange,
  onClick,
  highlightIds,
}: TimelineTrackProps) {
  const { start, end } = timeRange;
  const totalDuration = end - start || 1;

  const toPercent = useCallback(
    (ts: number) => ((ts - start) / totalDuration) * 100,
    [start, totalDuration]
  );

  return (
    <div className="flex items-stretch group">
      <div className="w-28 flex-shrink-0 flex items-center px-3 py-2">
        <span className="text-xs font-medium text-slate-400">{label}</span>
      </div>
      <div className="flex-1 relative h-12 border-b border-slate-700/30 bg-slate-900/30">
        <div className="absolute inset-0 flex items-center">
          <div
            className="absolute top-0 bottom-0 opacity-20 rounded-sm"
            style={{ backgroundColor: color, left: 0, right: 0 }}
          />
          {items.map((item) => {
            const left = toPercent(item.startTime);
            const width = Math.max(toPercent(item.endTime) - left, 0.3);
            const isHighlighted = highlightIds?.has(item.id);
            return (
              <div
                key={item.id}
                className={`absolute top-1 bottom-1 rounded-sm cursor-pointer transition-all duration-100 ${
                  isHighlighted
                    ? "ring-2 ring-amber-400/60 shadow-lg shadow-amber-400/20"
                    : "hover:ring-1 hover:ring-white/30"
                }`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: isHighlighted ? "#F59E0B" : color,
                  opacity: isHighlighted ? 0.9 : 0.7,
                }}
                onClick={() => onClick?.(item.id)}
                title={item.label || `${item.startTime} - ${item.endTime}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
