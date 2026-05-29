import { useRef, useEffect } from "react"
import type { AnomalyFragment } from "@/types"
import { ANOMALY_COLORS, ANOMALY_TYPE_LABELS } from "@/types"

interface Props {
  peaks: number[]
  duration: number
  color: string
  label: string
  offsetMs: number
  anomalies: AnomalyFragment[]
  height?: number
  scrollOffset?: number
  zoom?: number
}

export default function WaveformCanvas({
  peaks,
  duration,
  color,
  label,
  offsetMs,
  anomalies,
  height = 80,
  scrollOffset = 0,
  zoom = 1,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || peaks.length === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height

    ctx.fillStyle = "#0F0F1A"
    ctx.fillRect(0, 0, w, h)

    const visiblePeaks = peaks
    const barWidth = Math.max(1, (w * zoom) / visiblePeaks.length)
    const midY = h / 2

    for (let i = 0; i < visiblePeaks.length; i++) {
      const x = i * barWidth - scrollOffset
      if (x < -barWidth || x > w) continue
      const amplitude = visiblePeaks[i] * midY * 0.9
      ctx.fillStyle = color
      ctx.globalAlpha = 0.7
      ctx.fillRect(x, midY - amplitude, Math.max(1, barWidth - 0.5), amplitude * 2)
    }
    ctx.globalAlpha = 1

    const offsetPx = (offsetMs / 1000 / duration) * w * zoom
    if (Math.abs(offsetMs) > 10) {
      ctx.strokeStyle = "#E8A838"
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(offsetPx - scrollOffset, 0)
      ctx.lineTo(offsetPx - scrollOffset, h)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = "#E8A838"
      ctx.font = "10px JetBrains Mono, monospace"
      ctx.fillText(`${offsetMs > 0 ? "+" : ""}${offsetMs}ms`, offsetPx - scrollOffset + 4, 12)
    }

    for (const anomaly of anomalies) {
      const startX = (anomaly.startTime / duration) * w * zoom - scrollOffset
      const endX = (anomaly.endTime / duration) * w * zoom - scrollOffset
      const anomalyColor = ANOMALY_COLORS[anomaly.type]

      ctx.fillStyle = anomalyColor
      ctx.globalAlpha = 0.12
      ctx.fillRect(startX, 0, endX - startX, h)
      ctx.globalAlpha = 1

      ctx.strokeStyle = anomalyColor
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.5
      ctx.strokeRect(startX, 0, endX - startX, h)
      ctx.globalAlpha = 1
    }

    ctx.fillStyle = color
    ctx.globalAlpha = 0.8
    ctx.font = "bold 11px Noto Sans SC, sans-serif"
    ctx.fillText(label, 6, 14)
    ctx.globalAlpha = 1
  }, [peaks, duration, color, label, offsetMs, anomalies, scrollOffset, zoom, height])

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-lg border border-[#2A2A4A]"
      style={{ height }}
    />
  )
}
