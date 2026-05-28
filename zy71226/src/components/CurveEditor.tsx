import { useRef, useState, useCallback, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { TENORS, TENOR_YEARS, Tenor } from '@/types'
import { tenorToX, rateToY } from '@/utils/bondCalc'

const WIDTH = 700
const HEIGHT = 350
const PADDING = 40

export default function CurveEditor() {
  const curve = useStore(s => s.curve)
  const setCurveRate = useStore(s => s.setCurveRate)
  const isInverted = useStore(s => s.isInverted)
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState<Tenor | null>(null)

  const allRates = curve.map(p => p.rate)
  const minRate = Math.max(0, Math.floor(Math.min(...allRates) - 1))
  const maxRate = Math.ceil(Math.max(...allRates) + 1)

  const getPoint = useCallback((p: { tenor: Tenor; rate: number }) => ({
    x: tenorToX(p.tenor, WIDTH, PADDING),
    y: rateToY(p.rate, HEIGHT, PADDING, minRate, maxRate)
  }), [minRate, maxRate])

  const handleDrag = useCallback((clientY: number) => {
    if (!dragging || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const y = clientY - rect.top
    const rateRange = maxRate - minRate
    const pixelRate = rateRange / (HEIGHT - 2 * PADDING)
    const newRate = maxRate - (y - PADDING) * pixelRate
    setCurveRate(dragging, Math.round(newRate * 100) / 100)
  }, [dragging, minRate, maxRate, setCurveRate])

  useEffect(() => {
    const onMove = (e: MouseEvent) => handleDrag(e.clientY)
    const onUp = () => setDragging(null)
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length > 0) handleDrag(e.touches[0].clientY)
    }
    if (dragging) {
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      window.addEventListener('touchmove', onTouch, { passive: false })
      window.addEventListener('touchend', onUp)
    }
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('touchend', onUp)
    }
  }, [dragging, handleDrag])

  const sorted = [...curve].sort((a, b) => TENOR_YEARS[a.tenor] - TENOR_YEARS[b.tenor])
  const points = sorted.map(getPoint)

  let pathD = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    const cpx1 = p0.x + (p1.x - p0.x) / 2
    const cpx2 = p0.x + (p1.x - p0.x) / 2
    pathD += ` C ${cpx1} ${p0.y}, ${cpx2} ${p1.y}, ${p1.x} ${p1.y}`
  }

  const inverted = isInverted()

  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300">收益率曲线</h3>
        <div className={`px-2 py-0.5 rounded text-xs font-medium ${inverted ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
          {inverted ? '⚠ 曲线倒挂' : '✓ 形态正常'}
        </div>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto select-none"
      >
        <defs>
          <linearGradient id="curveGradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#d4a843" />
          </linearGradient>
          <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={inverted ? '#ef4444' : '#d4a843'} stopOpacity="0.15" />
            <stop offset="100%" stopColor={inverted ? '#ef4444' : '#d4a843'} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3, 4, 5].map(i => {
          const y = PADDING + (i / 5) * (HEIGHT - 2 * PADDING)
          const rate = maxRate - (i / 5) * (maxRate - minRate)
          return (
            <g key={i}>
              <line x1={PADDING} y1={y} x2={WIDTH - PADDING} y2={y} stroke="#1e3a5f" strokeWidth="1" />
              <text x={PADDING - 8} y={y + 4} textAnchor="end" fill="#64748b" fontSize="10" className="font-mono">
                {rate.toFixed(1)}%
              </text>
            </g>
          )
        })}

        {sorted.map(p => {
          const x = tenorToX(p.tenor, WIDTH, PADDING)
          return (
            <g key={p.tenor}>
              <line x1={x} y1={PADDING} x2={x} y2={HEIGHT - PADDING} stroke="#1e3a5f" strokeWidth="1" />
              <text x={x} y={HEIGHT - PADDING + 18} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="500">
                {p.tenor}
              </text>
            </g>
          )
        })}

        <path
          d={`${pathD} L ${points[points.length - 1].x} ${HEIGHT - PADDING} L ${points[0].x} ${HEIGHT - PADDING} Z`}
          fill="url(#areaGradient)"
        />
        <path
          d={pathD}
          fill="none"
          stroke={inverted ? '#ef4444' : 'url(#curveGradient)'}
          strokeWidth="2.5"
          strokeLinecap="round"
          className={inverted ? 'animate-pulse' : ''}
        />

        {sorted.map(p => {
          const { x, y } = getPoint(p)
          const isShort = TENOR_YEARS[p.tenor] <= 1
          const color = isShort ? '#3b82f6' : '#d4a843'
          return (
            <g key={p.tenor}>
              <circle
                cx={x}
                cy={y}
                r="12"
                fill="#0f1729"
                stroke={inverted ? '#ef4444' : color}
                strokeWidth="2.5"
                className={`cursor-grab active:cursor-grabbing transition-all ${inverted ? 'animate-pulse' : ''}`}
                style={{ filter: inverted ? 'drop-shadow(0 0 6px rgba(239,68,68,0.6))' : `drop-shadow(0 0 4px ${color}80)` }}
                onMouseDown={(e) => { e.preventDefault(); setDragging(p.tenor) }}
                onTouchStart={(e) => { e.preventDefault(); setDragging(p.tenor) }}
              />
              <circle cx={x} cy={y} r="3" fill={inverted ? '#ef4444' : color} />
              <text x={x} y={y - 18} textAnchor="middle" fill="#e2e8f0" fontSize="10" className="font-mono font-medium">
                {p.rate.toFixed(2)}%
              </text>
            </g>
          )
        })}
      </svg>
      <p className="mt-2 text-xs text-slate-500 text-center">
        上下拖拽节点调整收益率，观察债券价格变化
      </p>
    </div>
  )
}
