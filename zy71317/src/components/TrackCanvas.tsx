import { useRef, useEffect, useCallback } from "react"
import type { StabilityResult, ParamState } from "@/types"

interface TrackCanvasProps {
  params: ParamState
  result: StabilityResult | null
}

export default function TrackCanvas({ params, result }: TrackCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const frameRef = useRef(0)
  const cartYRef = useRef(0)
  const velocityRef = useRef(0)
  const oscillationHistoryRef = useRef<number[]>([])

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      frameRef.current++
      const frame = frameRef.current

      ctx.clearRect(0, 0, w, h)

      const bgGrad = ctx.createLinearGradient(0, 0, 0, h)
      bgGrad.addColorStop(0, "#0A1628")
      bgGrad.addColorStop(1, "#0D1F3C")
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, w, h)

      ctx.strokeStyle = "rgba(0, 229, 204, 0.06)"
      ctx.lineWidth = 1
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      const trackY = h * 0.7
      const trackLeft = w * 0.08
      const trackRight = w * 0.92

      ctx.strokeStyle = "rgba(0, 229, 204, 0.4)"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(trackLeft, trackY)
      ctx.lineTo(trackRight, trackY)
      ctx.stroke()

      ctx.strokeStyle = "rgba(0, 229, 204, 0.15)"
      ctx.lineWidth = 1
      for (let x = trackLeft; x <= trackRight; x += 20) {
        ctx.beginPath()
        ctx.moveTo(x, trackY)
        ctx.lineTo(x, trackY + 12)
        ctx.stroke()
      }

      const numMagnets = Math.max(2, Math.floor((trackRight - trackLeft) / 80))
      const magnetSpacing = (trackRight - trackLeft) / (numMagnets - 1)
      for (let i = 0; i < numMagnets; i++) {
        const mx = trackLeft + i * magnetSpacing
        const mw = 24
        const mh = 14
        const grad = ctx.createLinearGradient(mx - mw / 2, trackY + 4, mx + mw / 2, trackY + 4 + mh)
        grad.addColorStop(0, "#FF3366")
        grad.addColorStop(0.5, "#FF6B9D")
        grad.addColorStop(1, "#3366FF")
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.roundRect(mx - mw / 2, trackY + 4, mw, mh, 3)
        ctx.fill()

        ctx.fillStyle = "rgba(255, 51, 102, 0.08)"
        ctx.font = "8px monospace"
        ctx.textAlign = "center"
        ctx.fillText("N", mx - 4, trackY + 14)
        ctx.fillText("S", mx + 4, trackY + 14)
      }

      if (!result) return

      const cartWidth = 60
      const cartHeight = 28
      const cartCenterX = (trackLeft + trackRight) / 2
      const baseLevHeight = 50
      let targetLevHeight: number

      if (result.status === "stable") {
        targetLevHeight = baseLevHeight + Math.sin(frame * 0.03) * 2
      } else if (result.status === "critical") {
        targetLevHeight = baseLevHeight + Math.sin(frame * 0.08) * 8
      } else {
        targetLevHeight = 10
      }

      if (result.anomalyType === "oscillation_diverge") {
        const amp = 5 + frame * 0.15
        targetLevHeight = baseLevHeight + Math.sin(frame * 0.12) * amp
      }

      const springK = 0.08
      const damping = 0.85
      const force = (targetLevHeight - cartYRef.current) * springK
      velocityRef.current = (velocityRef.current + force) * damping
      cartYRef.current += velocityRef.current

      const cartTop = trackY - cartYRef.current - cartHeight

      if (result.status === "stable" || result.status === "critical") {
        const intensity = Math.min(1, result.ratio / 2)
        for (let i = 0; i < numMagnets; i++) {
          const mx = trackLeft + i * magnetSpacing
          const grad = ctx.createLinearGradient(mx, trackY, mx, cartTop + cartHeight)
          grad.addColorStop(0, `rgba(0, 229, 204, ${0.3 * intensity})`)
          grad.addColorStop(1, `rgba(0, 229, 204, 0.02)`)
          ctx.strokeStyle = grad
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(mx, trackY)
          const cp1x = mx - 15
          const cp1y = trackY - (trackY - cartTop - cartHeight) * 0.3
          const cp2x = mx + 15
          const cp2y = trackY - (trackY - cartTop - cartHeight) * 0.6
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, cartCenterX, cartTop + cartHeight)
          ctx.stroke()

          ctx.beginPath()
          ctx.moveTo(mx, trackY)
          const cp3x = mx + 15
          const cp3y = trackY - (trackY - cartTop - cartHeight) * 0.3
          const cp4x = mx - 15
          const cp4y = trackY - (trackY - cartTop - cartHeight) * 0.6
          ctx.bezierCurveTo(cp3x, cp3y, cp4x, cp4y, cartCenterX, cartTop + cartHeight)
          ctx.stroke()
        }

        ctx.fillStyle = `rgba(0, 229, 204, ${0.04 * intensity})`
        ctx.fillRect(trackLeft, cartTop + cartHeight, trackRight - trackLeft, trackY - cartTop - cartHeight)
      }

      const cartGrad = ctx.createLinearGradient(
        cartCenterX - cartWidth / 2,
        cartTop,
        cartCenterX + cartWidth / 2,
        cartTop + cartHeight
      )
      cartGrad.addColorStop(0, "#FF6B35")
      cartGrad.addColorStop(0.5, "#FFB347")
      cartGrad.addColorStop(1, "#FF6B35")
      ctx.fillStyle = cartGrad
      ctx.beginPath()
      ctx.roundRect(
        cartCenterX - cartWidth / 2,
        cartTop,
        cartWidth,
        cartHeight,
        6
      )
      ctx.fill()

      ctx.shadowColor = result.status === "stable" ? "#00E5CC" : result.status === "critical" ? "#FFD700" : "#FF4444"
      ctx.shadowBlur = 15
      ctx.strokeStyle = ctx.shadowColor
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.roundRect(
        cartCenterX - cartWidth / 2,
        cartTop,
        cartWidth,
        cartHeight,
        6
      )
      ctx.stroke()
      ctx.shadowBlur = 0

      ctx.fillStyle = "#0A1628"
      ctx.font = "bold 10px monospace"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("MAGLEV", cartCenterX, cartTop + cartHeight / 2)

      const arrowLen = 30
      const arrowX = cartCenterX + cartWidth / 2 + 20
      const arrowMidY = cartTop + cartHeight / 2

      ctx.strokeStyle = "#00E5CC"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(arrowX, arrowMidY)
      ctx.lineTo(arrowX, arrowMidY - arrowLen)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(arrowX - 5, arrowMidY - arrowLen + 7)
      ctx.lineTo(arrowX, arrowMidY - arrowLen)
      ctx.lineTo(arrowX + 5, arrowMidY - arrowLen + 7)
      ctx.stroke()

      ctx.fillStyle = "#00E5CC"
      ctx.font = "10px monospace"
      ctx.textAlign = "left"
      ctx.fillText(`F=${result.magneticForce.toFixed(4)}N`, arrowX + 8, arrowMidY - arrowLen / 2)

      ctx.strokeStyle = "#FF6B35"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(arrowX, arrowMidY)
      ctx.lineTo(arrowX, arrowMidY + arrowLen)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(arrowX - 5, arrowMidY + arrowLen - 7)
      ctx.lineTo(arrowX, arrowMidY + arrowLen)
      ctx.lineTo(arrowX + 5, arrowMidY + arrowLen - 7)
      ctx.stroke()

      ctx.fillStyle = "#FF6B35"
      ctx.fillText(`G=${result.gravityForce.toFixed(4)}N`, arrowX + 8, arrowMidY + arrowLen / 2)

      ctx.fillStyle = "rgba(0, 229, 204, 0.6)"
      ctx.font = "11px monospace"
      ctx.textAlign = "left"
      const infoX = trackLeft
      const infoY = h * 0.12
      ctx.fillText(`间距: ${params.magnetSpacing} mm`, infoX, infoY)
      ctx.fillText(`质量: ${params.vehicleMass} g`, infoX, infoY + 18)
      ctx.fillText(`电流: ${params.current} A`, infoX + 180, infoY)
      ctx.fillText(`轨道: ${params.trackLength} mm`, infoX + 180, infoY + 18)
      ctx.fillText(`扰动: ${params.disturbance} mm`, infoX + 360, infoY)

      const statusColors: Record<string, string> = {
        stable: "#00E5CC",
        critical: "#FFD700",
        unstable: "#FF4444",
      }
      const statusLabels: Record<string, string> = {
        stable: "● 稳定悬浮",
        critical: "● 临界振荡",
        unstable: "● 不稳定",
      }
      ctx.fillStyle = statusColors[result.status] || "#888"
      ctx.font = "bold 14px monospace"
      ctx.textAlign = "right"
      ctx.fillText(statusLabels[result.status] || "未知", trackRight, infoY)

      ctx.fillStyle = "rgba(255,255,255,0.35)"
      ctx.font = "10px monospace"
      ctx.textAlign = "right"
      ctx.fillText(`F/G = ${result.ratio.toFixed(4)}`, trackRight, infoY + 18)

      oscillationHistoryRef.current.push(cartYRef.current)
      if (oscillationHistoryRef.current.length > 200) {
        oscillationHistoryRef.current = oscillationHistoryRef.current.slice(-200)
      }
    },
    [params, result]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }
    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const animate = () => {
      const rect = canvas.getBoundingClientRect()
      draw(ctx, rect.width, rect.height)
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animRef.current)
      observer.disconnect()
    }
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-xl"
      style={{ display: "block" }}
    />
  )
}
