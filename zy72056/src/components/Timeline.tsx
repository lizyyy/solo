import { useRef, useCallback } from "react"
import { useAppStore } from "@/store/useAppStore"
import { mockTimeSlots } from "@/data/mockTimeSlots"

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6)

function getCongestionColor(avg: number): string {
  if (avg < 0.25) return "#1A5276"
  if (avg < 0.5) return "#1E8449"
  if (avg < 0.75) return "#D4AC0D"
  return "#C0392B"
}

export default function Timeline() {
  const { filter, setFilter } = useAppStore()
  const barRef = useRef<HTMLDivElement>(null)

  const slotColors = HOURS.map(hour => {
    const slot = mockTimeSlots.find(t => t.hour === hour)
    if (!slot || slot.points.length === 0) return "#1A1A2E"
    const avg = slot.points.reduce((s, p) => s + p.congestion, 0) / slot.points.length
    return getCongestionColor(avg)
  })

  const jumpToHour = useCallback(
    (clientX: number) => {
      const bar = barRef.current
      if (!bar) return
      const rect = bar.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const hour = Math.round(ratio * 17) + 6
      setFilter({ timeHour: Math.max(6, Math.min(23, hour)) })
    },
    [setFilter]
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => jumpToHour(e.clientX),
    [jumpToHour]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      jumpToHour(e.clientX)
      const onMove = (ev: MouseEvent) => jumpToHour(ev.clientX)
      const onUp = () => {
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
      }
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
    },
    [jumpToHour]
  )

  const thumbLeft = ((filter.timeHour - 6) / 17) * 100

  return (
    <div className="h-[56px] shrink-0 bg-[#0D1117] border-t border-white/10 flex items-center px-4 gap-3 select-none">
      <span className="text-xs text-white/40 w-10 shrink-0">时间轴</span>

      <div
        ref={barRef}
        className="relative flex-1 h-6 flex items-center cursor-pointer"
        onClick={handleClick}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 flex rounded-sm overflow-hidden">
          {slotColors.map((color, i) => (
            <div key={HOURS[i]} className="flex-1" style={{ backgroundColor: color }} />
          ))}
        </div>

        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/20"
          style={{ left: `${thumbLeft}%` }}
        />

        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-5 rounded-sm bg-[#E94560] shadow-lg shadow-[#E94560]/40"
          style={{ left: `${thumbLeft}%` }}
        />
      </div>

      <div className="flex gap-0 shrink-0 w-[calc(100%-80px)] max-w-full">
        {HOURS.map(hour => (
          <span
            key={hour}
            className={`flex-1 text-center text-[9px] ${
              filter.timeHour === hour ? "text-[#E94560] font-bold" : "text-white/40"
            }`}
          >
            {hour}:00
          </span>
        ))}
      </div>
    </div>
  )
}
