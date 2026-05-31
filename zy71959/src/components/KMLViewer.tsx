import { useStore } from "@/store/useStore"
import { ANOMALY_LABELS } from "@/types"
import type { AnomalyType } from "@/types"
import { useMemo } from "react"

const anomalyPointColors: Record<AnomalyType, string> = {
  battery_cycle_error: "#f59e0b",
  return_point_lost: "#ef4444",
  no_fly_zone_edge: "#f97316",
}

export default function KMLViewer({ routeId }: { routeId: string }) {
  const kmlTracks = useStore((s) => s.kmlTracks)
  const track = useMemo(() => kmlTracks.find((k) => k.routeId === routeId), [kmlTracks, routeId])

  if (!track) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        暂无 KML 轨迹数据
      </div>
    )
  }

  const coords = track.coordinates
  const minLng = Math.min(...coords.map((c) => c[1]))
  const maxLng = Math.max(...coords.map((c) => c[1]))
  const minLat = Math.min(...coords.map((c) => c[0]))
  const maxLat = Math.max(...coords.map((c) => c[0]))
  const lngRange = maxLng - minLng || 0.001
  const latRange = maxLat - minLat || 0.001
  const padding = 40
  const svgW = 500
  const svgH = 300
  const drawW = svgW - padding * 2
  const drawH = svgH - padding * 2

  const toSvg = (coord: [number, number]): [number, number] => {
    const x = padding + ((coord[1] - minLng) / lngRange) * drawW
    const y = padding + drawH - ((coord[0] - minLat) / latRange) * drawH
    return [x, y]
  }

  const pathD = coords.map((c, i) => {
    const [x, y] = toSvg(c)
    return `${i === 0 ? "M" : "L"} ${x} ${y}`
  }).join(" ")

  const anomalyPointIndices = new Set(track.anomalyPoints.map((ap) => ap.index))

  return (
    <div className="bg-surface-800/50 rounded-xl border border-surface-500/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs text-slate-400 font-medium">航线轨迹</h4>
        <div className="flex items-center gap-3">
          {track.anomalyPoints.length > 0 && (
            <div className="flex items-center gap-2">
              {track.anomalyPoints.map((ap, i) => (
                <span key={i} className="flex items-center gap-1 text-[10px]">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: anomalyPointColors[ap.type] }}
                  />
                  {ANOMALY_LABELS[ap.type]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto">
        <defs>
          <radialGradient id="gridFade" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a2030" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#1a2030" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x={0} y={0} width={svgW} height={svgH} fill="#0f1219" rx={8} />
        {Array.from({ length: 10 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={padding}
            y1={padding + (drawH / 9) * i}
            x2={svgW - padding}
            y2={padding + (drawH / 9) * i}
            stroke="#1a2030"
            strokeWidth={0.5}
          />
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={padding + (drawW / 9) * i}
            y1={padding}
            x2={padding + (drawW / 9) * i}
            y2={svgH - padding}
            stroke="#1a2030"
            strokeWidth={0.5}
          />
        ))}
        <path
          d={pathD}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
        />
        <path
          d={pathD}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.1}
        />
        {coords.map((c, i) => {
          const [x, y] = toSvg(c)
          const isAnomaly = anomalyPointIndices.has(i)
          const ap = track.anomalyPoints.find((a) => a.index === i)
          if (isAnomaly && ap) {
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={8} fill={anomalyPointColors[ap.type]} opacity={0.2} />
                <circle cx={x} cy={y} r={4} fill={anomalyPointColors[ap.type]} opacity={0.6} />
                <circle cx={x} cy={y} r={2} fill={anomalyPointColors[ap.type]} />
              </g>
            )
          }
          return (
            <circle key={i} cx={x} cy={y} r={1.5} fill="#3b82f6" opacity={0.4} />
          )
        })}
        {coords.length > 0 && (() => {
          const [sx, sy] = toSvg(coords[0])
          return <circle cx={sx} cy={sy} r={5} fill="#10b981" stroke="#0f1219" strokeWidth={2} />
        })()}
      </svg>
    </div>
  )
}
