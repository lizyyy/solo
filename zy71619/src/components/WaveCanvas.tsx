import { useRef, useEffect, useCallback } from "react"
import type { WaveCard, SurfboardState, SamplePoint } from "@/types"
import { synthesizeWave, getWaveYAtX, X_RANGE_TOTAL } from "@/engine/wave"
import { updateSurfboard, CANVAS_Y_MIN, CANVAS_Y_MAX, initSurfboard } from "@/engine/physics"
import { useGameStore } from "@/store/gameStore"
import { COLORS } from "@/utils/colors"

const PADDING = 40

function mapX(x: number, canvasWidth: number): number {
  return PADDING + (x / X_RANGE_TOTAL) * (canvasWidth - 2 * PADDING)
}

function mapY(y: number, canvasHeight: number): number {
  const drawHeight = canvasHeight - 2 * PADDING
  return PADDING + ((CANVAS_Y_MAX - y) / (CANVAS_Y_MAX - CANVAS_Y_MIN)) * drawHeight
}

function drawOceanBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, COLORS.oceanDeep)
  gradient.addColorStop(0.5, COLORS.oceanMid)
  gradient.addColorStop(1, COLORS.waveTeal)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

function drawBoundaryLines(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const yMin = mapY(CANVAS_Y_MIN, height)
  const yMax = mapY(CANVAS_Y_MAX, height)

  ctx.strokeStyle = COLORS.textMuted
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.3
  ctx.setLineDash([6, 4])

  ctx.beginPath()
  ctx.moveTo(PADDING, yMax)
  ctx.lineTo(width - PADDING, yMax)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(PADDING, yMin)
  ctx.lineTo(width - PADDING, yMin)
  ctx.stroke()

  ctx.setLineDash([])
  ctx.globalAlpha = 1
}

function drawWavePoints(
  ctx: CanvasRenderingContext2D,
  points: SamplePoint[],
  width: number,
  height: number,
  color: string,
  lineWidth: number,
  dashed: boolean
) {
  if (points.length === 0) return

  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  if (dashed) {
    ctx.setLineDash([8, 6])
  } else {
    ctx.setLineDash([])
  }

  ctx.beginPath()
  ctx.moveTo(mapX(points[0].x, width), mapY(points[0].y, height))
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(mapX(points[i].x, width), mapY(points[i].y, height))
  }
  ctx.stroke()
  ctx.setLineDash([])
}

function drawGlowWave(
  ctx: CanvasRenderingContext2D,
  points: SamplePoint[],
  width: number,
  height: number
) {
  if (points.length === 0) return

  ctx.shadowColor = COLORS.waveTeal
  ctx.shadowBlur = 12
  ctx.strokeStyle = COLORS.foam
  ctx.lineWidth = 2.5
  ctx.setLineDash([])

  ctx.beginPath()
  ctx.moveTo(mapX(points[0].x, width), mapY(points[0].y, height))
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(mapX(points[i].x, width), mapY(points[i].y, height))
  }
  ctx.stroke()

  ctx.shadowColor = "transparent"
  ctx.shadowBlur = 0
}

function drawSurfboard(
  ctx: CanvasRenderingContext2D,
  board: SurfboardState,
  width: number,
  height: number
) {
  const cx = mapX(board.x, width)
  const cy = mapY(board.y, height)

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-board.angle)

  const boardWidth = 24
  const boardHeight = 8

  ctx.beginPath()
  ctx.ellipse(0, 0, boardWidth, boardHeight, 0, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.sunsetOrange
  ctx.shadowColor = COLORS.sunsetOrange
  ctx.shadowBlur = 8
  ctx.fill()

  ctx.strokeStyle = COLORS.foam
  ctx.lineWidth = 1
  ctx.shadowBlur = 0
  ctx.stroke()

  ctx.beginPath()
  ctx.ellipse(0, -1, boardWidth * 0.6, boardHeight * 0.4, 0, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.foamDim
  ctx.globalAlpha = 0.4
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.restore()
}

export default function WaveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  const targetWave = useGameStore((s) => s.targetWave)
  const playerWave = useGameStore((s) => s.playerWave)
  const surfboard = useGameStore((s) => s.surfboard)
  const gameTime = useGameStore((s) => s.gameTime)
  const isRunning = useGameStore((s) => s.isRunning)
  const storeUpdateSurfboard = useGameStore((s) => s.updateSurfboard)
  const storeSetGameTime = useGameStore((s) => s.setGameTime)
  const recalculateScore = useGameStore((s) => s.recalculateScore)

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.clearRect(0, 0, width, height)
      drawOceanBackground(ctx, width, height)
      drawBoundaryLines(ctx, width, height)

      const targetPoints = synthesizeWave(targetWave, gameTime)
      drawWavePoints(ctx, targetPoints, width, height, COLORS.foamDim, 1.5, true)

      const playerPoints = synthesizeWave(playerWave, gameTime)
      drawGlowWave(ctx, playerPoints, width, height)

      for (const card of playerWave) {
        const cardPoints = synthesizeWave([card], gameTime)
        drawWavePoints(ctx, cardPoints, width, height, card.color, 1, false)
      }

      drawSurfboard(ctx, surfboard, width, height)
    },
    [targetWave, playerWave, surfboard, gameTime]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.scale(dpr, dpr)
      }
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isRunning) {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      const width = canvas.width / dpr
      const height = canvas.height / dpr
      draw(ctx, width, height)
      return
    }

    lastTimeRef.current = performance.now()

    const loop = (timestamp: number) => {
      const deltaTime = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1)
      lastTimeRef.current = timestamp

      const newTime = gameTime + deltaTime
      storeSetGameTime(newTime)

      const newBoard = updateSurfboard(surfboard, playerWave, newTime, deltaTime)
      storeUpdateSurfboard(newBoard)
      recalculateScore()

      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      const width = canvas.width / dpr
      const height = canvas.height / dpr
      draw(ctx, width, height)

      frameRef.current = requestAnimationFrame(loop)
    }

    frameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameRef.current)
  }, [isRunning, draw, gameTime, surfboard, playerWave, storeUpdateSurfboard, storeSetGameTime, recalculateScore])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const width = canvas.width / dpr
    const height = canvas.height / dpr
    draw(ctx, width, height)
  }, [draw])

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 12,
        border: `1px solid ${COLORS.cardBorder}`,
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  )
}
