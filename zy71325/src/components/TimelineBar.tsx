import type { AnomalyFragment } from "@/types"
import { ANOMALY_COLORS, ANOMALY_TYPE_LABELS } from "@/types"

interface Props {
  duration: number
  anomalies: AnomalyFragment[]
  onAnomalyClick?: (anomaly: AnomalyFragment) => void
}

export default function TimelineBar({ duration, anomalies, onAnomalyClick }: Props) {
  if (duration <= 0) return null

  return (
    <div className="w-full">
      <div className="relative h-8 bg-[#0F0F1A] rounded-lg border border-[#2A2A4A] overflow-hidden">
        {anomalies.map((a) => {
          const left = (a.startTime / duration) * 100
          const width = ((a.endTime - a.startTime) / duration) * 100
          const color = ANOMALY_COLORS[a.type]

          return (
            <button
              key={a.id}
              onClick={() => onAnomalyClick?.(a)}
              className="absolute top-0 h-full cursor-pointer hover:brightness-125 transition-all"
              style={{
                left: `${left}%`,
                width: `${Math.max(width, 0.5)}%`,
                backgroundColor: `${color}50`,
                borderLeft: `2px solid ${color}`,
                borderRight: `2px solid ${color}30`,
              }}
              title={`${ANOMALY_TYPE_LABELS[a.type]}: ${a.startTime.toFixed(1)}s - ${a.endTime.toFixed(1)}s`}
            />
          )
        })}

        {Array.from({ length: Math.floor(duration / 30) + 1 }, (_, i) => {
          const pos = ((i * 30) / duration) * 100
          return (
            <div
              key={i}
              className="absolute top-0 h-full flex items-end"
              style={{ left: `${pos}%` }}
            >
              <span className="text-[8px] text-gray-600 font-mono -translate-x-1/2 translate-y-0">
                {Math.floor(i * 30 / 60)}:{(i * 30 % 60).toString().padStart(2, "0")}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex gap-4 mt-2 flex-wrap">
        {(["offset_error", "beat_drift", "duplicate_clip", "late_join"] as const).map((type) => {
          const count = anomalies.filter((a) => a.type === type).length
          if (count === 0) return null
          return (
            <div key={type} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: ANOMALY_COLORS[type] }}
              />
              <span className="text-[10px] text-gray-500">
                {ANOMALY_TYPE_LABELS[type]} ×{count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
