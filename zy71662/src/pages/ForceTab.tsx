import { useStore } from '@/store/useStore'
import { ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'
import { formatForce, formatWeight } from '@/lib/helpers'

export default function ForceTab() {
  const schemeDetail = useStore((s) => s.schemeDetail)
  if (!schemeDetail) return null

  const decomp = schemeDetail.decompositions
  const pts = schemeDetail.points
  const maxV = Math.max(...decomp.map((d) => d.verticalForceN), 1)
  const maxH = Math.max(...decomp.map((d) => d.horizontalForceN), 1)

  const svgW = 800
  const svgH = 280
  const pad = 60
  const arrowLen = 120
  const gap = pts.length > 1 ? (svgW - 2 * pad) / (pts.length - 1) : 0

  return (
    <div className="space-y-6">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full bg-zinc-900 rounded border border-zinc-700">
        {decomp.map((d, i) => {
          const cx = pts.length === 1 ? svgW / 2 : pad + i * gap
          const cy = 60
          const vLen = (d.verticalForceN / maxV) * arrowLen
          const hLen = (d.horizontalForceN / maxH) * arrowLen * 0.7
          return (
            <g key={d.pointId}>
              <circle cx={cx} cy={cy} r={5} fill="#6d5dfc" />
              <text x={cx} y={cy - 14} textAnchor="middle" className="fill-zinc-300 text-[11px]">{d.pointLabel}</text>
              <line x1={cx} y1={cy} x2={cx} y2={cy + vLen} stroke="#4ade80" strokeWidth={2} markerEnd="url(#arrowG)" />
              <text x={cx + 8} y={cy + vLen / 2} className="fill-green-400 text-[10px]">{formatForce(d.verticalForceN)}</text>
              {d.horizontalForceN > 0 && (
                <>
                  <line x1={cx} y1={cy} x2={cx + (d.angleDirection === 'right' ? hLen : -hLen)} y2={cy}
                    stroke="#fbbf24" strokeWidth={2} markerEnd={d.angleDirection === 'right' ? 'url(#arrowR)' : 'url(#arrowL)'} />
                  <text x={cx + (d.angleDirection === 'right' ? hLen / 2 : -hLen / 2)} y={cy - 8}
                    textAnchor="middle" className="fill-amber-400 text-[10px]">{formatForce(d.horizontalForceN)}</text>
                </>
              )}
            </g>
          )
        })}
        <defs>
          <marker id="arrowG" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6" fill="#4ade80" /></marker>
          <marker id="arrowR" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6" fill="#fbbf24" /></marker>
          <marker id="arrowL" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto-start-reverse"><path d="M8,0 L0,3 L8,6" fill="#fbbf24" /></marker>
        </defs>
      </svg>
      <div className="flex gap-4 text-xs text-zinc-400 mb-2">
        <span className="flex items-center gap-1"><ArrowDown size={12} className="text-green-400" /> 垂直分力</span>
        <span className="flex items-center gap-1"><ArrowRight size={12} className="text-amber-400" /> 水平分力</span>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-zinc-400 border-b border-zinc-700">
          <th className="text-left py-2 px-2">标签</th><th className="py-2 px-2">总重量</th><th className="py-2 px-2">垂直分力</th>
          <th className="py-2 px-2">水平分力</th><th className="py-2 px-2">角度</th><th className="py-2 px-2">方向</th>
        </tr></thead>
        <tbody>
          {decomp.map((d) => (
            <tr key={d.pointId} className="border-b border-zinc-800 hover:bg-zinc-800/40">
              <td className="py-2 px-2">{d.pointLabel}</td>
              <td className="py-2 px-2 text-center">{formatWeight(d.totalWeightKg, 'kg')}</td>
              <td className="py-2 px-2 text-center text-green-400">{formatForce(d.verticalForceN)}</td>
              <td className="py-2 px-2 text-center text-amber-400">{formatForce(d.horizontalForceN)}</td>
              <td className="py-2 px-2 text-center">{d.angleDeg}°</td>
              <td className="py-2 px-2 text-center">{d.angleDirection === 'left' ? '← 左' : '→ 右'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
