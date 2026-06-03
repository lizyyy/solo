import { useRef, useEffect, useState, useCallback } from "react"
import { Play, RotateCcw } from "lucide-react"
import useAppStore from "@/store/useAppStore"
import { runGradientDescent } from "@/utils/gradient"
import type { GradientPoint, GradientConfig } from "@/types"

function evalFunc(x: number, y: number, type: GradientConfig["funcType"]): number {
  switch (type) {
    case "quadratic": return x * x + y * y
    case "rosenbrock": return (1 - x) ** 2 + 100 * (y - x * x) ** 2
    case "rastrigin": return 20 + x * x - 10 * Math.cos(2 * Math.PI * x) + y * y - 10 * Math.cos(2 * Math.PI * y)
  }
}

function mapToCanvas(px: number, py: number, width: number, height: number, bounds: { xMin: number; xMax: number; yMin: number; yMax: number }) {
  const cx = ((px - bounds.xMin) / (bounds.xMax - bounds.xMin)) * width
  const cy = height - ((py - bounds.yMin) / (bounds.yMax - bounds.yMin)) * height
  return { cx, cy }
}

export default function GradientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const gradientConfig = useAppStore((s) => s.gradientConfig)
  const setGradientConfig = useAppStore((s) => s.setGradientConfig)
  const [path, setPath] = useState<GradientPoint[]>([])
  const [animStep, setAnimStep] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const animRef = useRef<number>(0)

  const bounds = { xMin: -4, xMax: 4, yMin: -4, yMax: 4 }

  const drawScene = useCallback((currentPath: GradientPoint[], step: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height

    ctx.fillStyle = "#0d0d1f"
    ctx.fillRect(0, 0, w, h)

    const gridStep = 8
    for (let px = 0; px < w; px += gridStep) {
      for (let py = 0; py < h; py += gridStep) {
        const x = bounds.xMin + (px / w) * (bounds.xMax - bounds.xMin)
        const y = bounds.yMax - (py / h) * (bounds.yMax - bounds.yMin)
        const val = evalFunc(x, y, gradientConfig.funcType)
        const logVal = Math.log(val + 1)
        const intensity = Math.min(logVal / 5, 1)
        ctx.fillStyle = `rgba(15, 240, 179, ${intensity * 0.12})`
        ctx.fillRect(px, py, gridStep, gridStep)
      }
    }

    ctx.strokeStyle = "rgba(15, 240, 179, 0.08)"
    ctx.lineWidth = 0.5
    for (let v = -3; v <= 3; v += 1) {
      const { cx: x1, cy: y1 } = mapToCanvas(v, bounds.yMin, w, h, bounds)
      const { cx: x2, cy: y2 } = mapToCanvas(v, bounds.yMax, w, h, bounds)
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
      const { cx: x3, cy: y3 } = mapToCanvas(bounds.xMin, v, w, h, bounds)
      const { cx: x4, cy: y4 } = mapToCanvas(bounds.xMax, v, w, h, bounds)
      ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke()
    }

    if (currentPath.length > 1) {
      const drawCount = Math.min(step + 1, currentPath.length)
      ctx.lineWidth = 2
      ctx.lineCap = "round"
      for (let i = 1; i < drawCount; i++) {
        const t = i / currentPath.length
        const r = Math.round(255 * t)
        const g = Math.round(200 - 100 * t)
        const b = Math.round(50)
        ctx.strokeStyle = `rgb(${r},${g},${b})`
        const p1 = mapToCanvas(currentPath[i - 1].x, currentPath[i - 1].y, w, h, bounds)
        const p2 = mapToCanvas(currentPath[i].x, currentPath[i].y, w, h, bounds)
        ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke()
      }

      const startP = mapToCanvas(currentPath[0].x, currentPath[0].y, w, h, bounds)
      ctx.fillStyle = "#0ff0b3"
      ctx.beginPath(); ctx.arc(startP.cx, startP.cy, 5, 0, Math.PI * 2); ctx.fill()

      const lastIdx = drawCount - 1
      const endP = mapToCanvas(currentPath[lastIdx].x, currentPath[lastIdx].y, w, h, bounds)
      ctx.fillStyle = "#ff9f1c"
      ctx.beginPath(); ctx.arc(endP.cx, endP.cy, 6, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = "#ff9f1c"
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(endP.cx, endP.cy, 10, 0, Math.PI * 2); ctx.stroke()
    }
  }, [gradientConfig.funcType])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ro = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      drawScene(path, animStep)
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [drawScene, path, animStep])

  useEffect(() => {
    drawScene(path, animStep)
  }, [drawScene, path, animStep])

  const handleRun = () => {
    const newPath = runGradientDescent(gradientConfig)
    setPath(newPath)
    setAnimStep(0)
    setIsAnimating(true)
  }

  useEffect(() => {
    if (!isAnimating || path.length === 0) return
    if (animStep >= path.length - 1) {
      setIsAnimating(false)
      return
    }
    const timer = setTimeout(() => {
      setAnimStep((s) => s + 1)
    }, 30)
    return () => clearTimeout(timer)
  }, [isAnimating, animStep, path.length])

  const currentLoss = path.length > 0 && animStep < path.length
    ? evalFunc(path[animStep].x, path[animStep].y, gradientConfig.funcType)
    : null

  return (
    <div className="bg-[#16163a] rounded-xl border border-[#2a2a4a] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#2a2a4a] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#e0e0f0]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          学习率演示
        </h3>
        <div className="flex items-center gap-2 text-xs text-[#8888aa]">
          {currentLoss !== null && <span>步数: {animStep} · 损失: {currentLoss.toFixed(6)}</span>}
        </div>
      </div>
      <div ref={containerRef} className="relative" style={{ height: 340 }}>
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
      <div className="px-5 py-4 border-t border-[#2a2a4a] space-y-3">
        <div className="flex items-center gap-4">
          <label className="text-xs text-[#8888aa] w-20 shrink-0">学习率 (lr)</label>
          <input
            type="range"
            min={0.001}
            max={1}
            step={0.001}
            value={gradientConfig.learningRate}
            onChange={(e) => setGradientConfig({ learningRate: parseFloat(e.target.value) })}
            className="flex-1 accent-[#0ff0b3]"
          />
          <span className="text-xs text-[#0ff0b3] w-16 text-right font-mono">{gradientConfig.learningRate.toFixed(3)}</span>
        </div>
        <div className="flex items-center gap-4">
          <label className="text-xs text-[#8888aa] w-20 shrink-0">目标函数</label>
          <select
            value={gradientConfig.funcType}
            onChange={(e) => setGradientConfig({ funcType: e.target.value as GradientConfig["funcType"] })}
            className="bg-[#0d0d1f] border border-[#2a2a4a] text-[#e0e0f0] text-xs rounded px-2 py-1.5"
          >
            <option value="quadratic">二次函数 f(x,y)=x²+y²</option>
            <option value="rosenbrock">Rosenbrock</option>
            <option value="rastrigin">Rastrigin</option>
          </select>
        </div>
        <div className="flex items-center gap-4">
          <label className="text-xs text-[#8888aa] w-20 shrink-0">起始点</label>
          <span className="text-xs text-[#e0e0f0] font-mono">({gradientConfig.startX}, {gradientConfig.startY})</span>
          <button
            onClick={() => setGradientConfig({ startX: -2, startY: -2 })}
            className="text-xs text-[#8888aa] hover:text-[#0ff0b3]"
          >
            <RotateCcw size={14} />
          </button>
        </div>
        <button
          onClick={handleRun}
          disabled={isAnimating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0ff0b3] text-[#0d0d1f] text-sm font-semibold hover:shadow-[0_0_15px_rgba(15,240,179,0.4)] transition-all disabled:opacity-40"
        >
          <Play size={14} /> 运行
        </button>
      </div>
    </div>
  )
}
