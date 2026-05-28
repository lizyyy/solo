import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'

const COLORS = ['#3b82f6', '#8b5cf6', '#d4a843', '#22c55e', '#f97316']

export default function PriceChart() {
  const priceHistory = useStore(s => s.priceHistory)
  const selectedId = useStore(s => s.selectedBondId)
  const bonds = useStore(s => s.bonds)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const padLeft = 40
    const padTop = 20
    const padBottom = 30
    const chartW = w - padLeft - 10
    const chartH = h - padTop - padBottom

    ctx.fillStyle = '#151f36'
    ctx.fillRect(0, 0, w, h)

    const relevantBonds = selectedId ? bonds.filter(b => b.id === selectedId) : bonds
    const histories = relevantBonds.map(b => ({
      bond: b,
      records: priceHistory.filter(r => r.bondId === b.id).slice(-60)
    })).filter(h => h.records.length > 2)

    if (histories.length === 0) {
      ctx.fillStyle = '#475569'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('拖动曲线开始记录价格走势', w / 2, h / 2)
      return
    }

    const allPrices = histories.flatMap(h => h.records.map(r => r.price))
    const minP = Math.floor(Math.min(...allPrices) - 1)
    const maxP = Math.ceil(Math.max(...allPrices) + 1)

    ctx.strokeStyle = '#1e3a5f'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = padTop + (i / 4) * chartH
      const price = maxP - (i / 4) * (maxP - minP)
      ctx.beginPath()
      ctx.moveTo(padLeft, y)
      ctx.lineTo(w - 10, y)
      ctx.stroke()
      ctx.fillStyle = '#64748b'
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.textAlign = 'right'
      ctx.fillText(price.toFixed(1), padLeft - 6, y + 3)
    }

    histories.forEach(({ bond, records }, idx) => {
      const color = COLORS[idx % COLORS.length]
      const maxPoints = 60
      const startIdx = Math.max(0, records.length - maxPoints)
      const display = records.slice(startIdx)
      if (display.length < 2) return

      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()

      display.forEach((r, i) => {
        const x = padLeft + (i / (display.length - 1)) * chartW
        const y = padTop + (1 - (r.price - minP) / (maxP - minP)) * chartH
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()

      const last = display[display.length - 1]
      const lastX = padLeft + ((display.length - 1) / (display.length - 1)) * chartW
      const lastY = padTop + (1 - (last.price - minP) / (maxP - minP)) * chartH

      ctx.beginPath()
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()

      ctx.fillStyle = color
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(bond.name, 10, padTop + 14 + idx * 14)
    })

    ctx.fillStyle = '#475569'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('时间 →', w / 2, h - 10)
  }, [priceHistory, selectedId, bonds])

  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300">价格走势</h3>
        <span className="text-xs text-slate-500">
          {selectedId ? bonds.find(b => b.id === selectedId)?.name : '全部债券'}
        </span>
      </div>
      <canvas ref={canvasRef} className="w-full h-40 rounded" style={{ background: '#151f36' }} />
    </div>
  )
}
