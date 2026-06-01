import { useEffect, useRef, useMemo } from "react"
import { IntersectionData, SpeedBandResult } from "@/lib/types"

interface Props {
  intersections: IntersectionData[]
  results: SpeedBandResult[]
  cycle: number
  anomaliesIncluded: boolean
}

export default function TimeDistanceChart({ intersections, results, cycle, anomaliesIncluded }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const maxDistance = useMemo(() => Math.max(...intersections.map((i) => i.distanceFromStart), 100), [intersections])
  const timeRange = 2 * cycle

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || intersections.length === 0) return

    const dpr = window.devicePixelRatio || 1
    const width = container.clientWidth
    const height = 400
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext("2d")!
    ctx.scale(dpr, dpr)

    const padding = { left: 80, right: 20, top: 20, bottom: 40 }
    const chartW = width - padding.left - padding.right
    const chartH = height - padding.top - padding.bottom

    ctx.fillStyle = "#1A1A2E"
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = "#16213E"
    ctx.lineWidth = 1

    for (let t = 0; t <= timeRange; t += cycle / 4) {
      const x = padding.left + (t / timeRange) * chartW
      ctx.beginPath()
      ctx.moveTo(x, padding.top)
      ctx.lineTo(x, padding.top + chartH)
      ctx.stroke()
    }

    for (let i = 0; i < intersections.length; i++) {
      const y = padding.top + (1 - intersections[i].distanceFromStart / maxDistance) * chartH
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(padding.left + chartW, y)
      ctx.stroke()
    }

    ctx.fillStyle = "#64748B"
    ctx.font = "11px system-ui"
    ctx.textAlign = "center"

    for (let t = 0; t <= timeRange; t += cycle / 4) {
      const x = padding.left + (t / timeRange) * chartW
      ctx.fillText(`${t}s`, x, padding.top + chartH + 20)
    }

    ctx.textAlign = "right"
    for (let i = 0; i < intersections.length; i++) {
      const y = padding.top + (1 - intersections[i].distanceFromStart / maxDistance) * chartH
      ctx.fillText(intersections[i].name, padding.left - 8, y + 4)
    }

    for (let si = 0; si < results.length; si++) {
      const result = results[si]
      if (result.isAnomalous && !anomaliesIncluded) continue

      const fromIdx = intersections.findIndex((i) => i.name === result.fromIntersection)
      const toIdx = intersections.findIndex((i) => i.name === result.toIntersection)
      if (fromIdx < 0 || toIdx < 0) continue

      const from = intersections[fromIdx]
      const to = intersections[toIdx]

      if (result.isAnomalous) {
        const yFrom = padding.top + (1 - from.distanceFromStart / maxDistance) * chartH
        const yTo = padding.top + (1 - to.distanceFromStart / maxDistance) * chartH
        const xMid = padding.left + chartW / 2

        ctx.strokeStyle = "#EF4444"
        ctx.setLineDash([4, 4])
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(xMid - 50, yFrom)
        ctx.lineTo(xMid + 50, yTo)
        ctx.stroke()
        ctx.setLineDash([])

        ctx.fillStyle = "#EF4444"
        ctx.font = "10px system-ui"
        ctx.textAlign = "center"
        ctx.fillText("无法形成绿波", xMid, (yFrom + yTo) / 2 - 8)
      } else {
        const avgSpeed = ((result.speedMin + result.speedMax) / 2) / 3.6
        const bandwidth = result.bandwidth

        for (let cycleOffset = 0; cycleOffset < timeRange; cycleOffset += cycle) {
          const startX = padding.left + ((from.offset + cycleOffset) / timeRange) * chartW
          const endX = padding.left + ((to.offset + cycleOffset) / timeRange) * chartW
          const yFrom = padding.top + (1 - from.distanceFromStart / maxDistance) * chartH
          const yTo = padding.top + (1 - to.distanceFromStart / maxDistance) * chartH

          const bandLeft = bandwidth / 2 / timeRange * chartW
          const bandRight = bandwidth / 2 / timeRange * chartW

          ctx.fillStyle = "rgba(13, 115, 119, 0.25)"
          ctx.beginPath()
          ctx.moveTo(startX - bandLeft, yFrom)
          ctx.lineTo(endX - bandLeft, yTo)
          ctx.lineTo(endX + bandRight, yTo)
          ctx.lineTo(startX + bandRight, yFrom)
          ctx.closePath()
          ctx.fill()

          ctx.strokeStyle = "#0D7377"
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }
    }

    ctx.fillStyle = "#64748B"
    ctx.font = "12px system-ui"
    ctx.textAlign = "center"
    ctx.fillText("时间 (s)", padding.left + chartW / 2, height - 8)

    ctx.save()
    ctx.translate(16, padding.top + chartH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = "center"
    ctx.fillText("距离 (m)", 0, 0)
    ctx.restore()
  }, [intersections, results, cycle, maxDistance, timeRange, anomaliesIncluded])

  return (
    <div ref={containerRef} className="w-full">
      <canvas ref={canvasRef} className="w-full" />
    </div>
  )
}
