import { useState } from 'react'
import type { WeightRecord, RecordSource } from '../../types'

const sourceStyle: Record<RecordSource, { color: string; strokeWidth: number; dash?: string; dotR: number; stroke: string }> = {
  official: { color: '#8FA68C', strokeWidth: 2.2, dotR: 4, stroke: '#8FA68C' },
  old_version: { color: '#B5523A', strokeWidth: 2, dash: '6 4', dotR: 3, stroke: '#B5523A' },
  name_change: { color: '#C87941', strokeWidth: 1.8, dotR: 3, stroke: '#C87941' },
  verbal: { color: '#565264', strokeWidth: 1.6, dash: '2 3', dotR: 3, stroke: '#565264' },
  missing_vaccine: { color: '#DDA070', strokeWidth: 1.5, dash: '6 4', dotR: 3, stroke: '#DDA070' },
}

const sourceLabel: Record<RecordSource, string> = {
  official: '官方称重',
  old_version: '旧版曲线',
  name_change: '改名记录',
  verbal: '口头备注',
  missing_vaccine: '疫苗缺失',
}

const sourceOrder: RecordSource[] = ['official', 'old_version', 'name_change', 'verbal', 'missing_vaccine']

interface Props {
  records: WeightRecord[]
  petName: string
}

interface ActivePoint {
  id: string
  x: number
  y: number
  record: WeightRecord
}

export default function WeightChart({ records, petName }: Props) {
  const [activePoint, setActivePoint] = useState<ActivePoint | null>(null)

  const sortedDates = Array.from(new Set(records.map((r) => r.date))).sort()
  if (sortedDates.length < 2) {
    return (
      <div className="card p-6">
        <h3 className="font-kai text-xl text-clay-800 mb-4">体重曲线（多版本对比）</h3>
        <div className="h-[320px] flex items-center justify-center text-graphite-400">称重记录不足，无法绘制曲线</div>
      </div>
    )
  }

  const weights = records.map((r) => r.weight)
  const minW = Math.min(...weights) - 0.2
  const maxW = Math.max(...weights) + 0.2
  const rangeW = maxW - minW

  const paddingL = 40
  const paddingR = 50
  const paddingT = 20
  const paddingB = 40
  const chartW = 800
  const chartH = 320
  const plotW = chartW - paddingL - paddingR
  const plotH = chartH - paddingT - paddingB

  const getX = (date: string) => {
    const idx = sortedDates.indexOf(date)
    return paddingL + (idx / (sortedDates.length - 1)) * plotW
  }
  const getY = (w: number) => paddingT + plotH - ((w - minW) / rangeW) * plotH

  const gridLines: number[] = []
  for (let i = 0; i <= 4; i++) {
    gridLines.push(minW + (rangeW * i) / 4)
  }

  const bySource: Record<RecordSource, WeightRecord[]> = {
    official: [], old_version: [], name_change: [], verbal: [], missing_vaccine: [],
  }
  records.forEach((r) => bySource[r.source].push(r))

  const buildPath = (recs: WeightRecord[]) => {
    const sorted = [...recs].sort((a, b) => a.date.localeCompare(b.date))
    return sorted
      .map((r, i) => `${i === 0 ? 'M' : 'L'} ${getX(r.date)} ${getY(r.weight)}`)
      .join(' ')
  }

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-3 gap-4 flex-wrap">
        <div>
          <h3 className="font-kai text-xl text-clay-800">体重曲线 · 多版本对比</h3>
          <div className="text-xs text-graphite-400 mt-0.5">{petName} · 共 {records.length} 条记录，{sortedDates.length} 个称重日</div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {sourceOrder.map((s) => {
            const sty = sourceStyle[s]
            const count = bySource[s].length
            if (count === 0) return null
            return (
              <div key={s} className="flex items-center gap-1.5 text-xs text-graphite-600">
                <svg width="28" height="12">
                  <line
                    x1="0" y1="6" x2="28" y2="6"
                    stroke={sty.color}
                    strokeWidth={sty.strokeWidth}
                    strokeDasharray={sty.dash}
                  />
                </svg>
                <span className="font-medium">{sourceLabel[s]}</span>
                <span className="text-graphite-400">×{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="relative w-full overflow-x-auto scrollbar-thin">
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-[320px] min-w-[600px]" preserveAspectRatio="xMidYMid meet">
          {gridLines.map((w, i) => (
            <g key={i}>
              <line
                x1={paddingL} y1={getY(w)} x2={chartW - paddingR} y2={getY(w)}
                stroke="#F4E0CE" strokeWidth="1" strokeDasharray="3 3"
              />
              <text
                x={chartW - paddingR + 6} y={getY(w) + 4}
                fill="#565264" fontSize="11" fontFamily="'JetBrains Mono', monospace"
              >
                {w.toFixed(1)}
              </text>
            </g>
          ))}

          {sortedDates.map((d, i) => {
            if (i % Math.ceil(sortedDates.length / 8) !== 0 && i !== sortedDates.length - 1) return null
            return (
              <text
                key={d}
                x={getX(d)} y={chartH - paddingB + 18}
                textAnchor="middle" fill="#565264" fontSize="10"
              >
                {d.slice(5)}
              </text>
            )
          })}

          {sourceOrder.map((s) => {
            const recs = bySource[s]
            if (recs.length < 2) return null
            const sty = sourceStyle[s]
            return (
              <path
                key={s}
                d={buildPath(recs)}
                fill="none"
                stroke={sty.color}
                strokeWidth={sty.strokeWidth}
                strokeDasharray={sty.dash}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-draw"
              />
            )
          })}

          {sourceOrder.map((s) =>
            bySource[s].map((r) => {
              const sty = sourceStyle[s]
              const cx = getX(r.date)
              const cy = getY(r.weight)
              const isActive = activePoint?.id === r.id
              const isMissing = s === 'missing_vaccine'

              return (
                <g key={r.id} className="cursor-pointer" onClick={(e) => {
                  e.stopPropagation()
                  if (isActive) setActivePoint(null)
                  else setActivePoint({ id: r.id, x: cx, y: cy, record: r })
                }}>
                  {isMissing && (
                    <>
                      <line x1={cx - 5} y1={cy - 5} x2={cx + 5} y2={cy + 5} stroke={sty.color} strokeWidth="1.2" />
                      <line x1={cx + 5} y1={cy - 5} x2={cx - 5} y2={cy + 5} stroke={sty.color} strokeWidth="1.2" />
                    </>
                  )}
                  <circle
                    cx={cx} cy={cy} r={sty.dotR + (isActive ? 2 : 0)}
                    fill="white"
                    stroke={sty.color}
                    strokeWidth={2}
                  />
                </g>
              )
            })
          )}

          <line x1={paddingL} y1={chartH - paddingB} x2={chartW - paddingR} y2={chartH - paddingB} stroke="#E8C29F" strokeWidth="1" />
        </svg>

        {activePoint && (
          <div
            className="absolute z-10 pointer-events-none"
            style={{
              left: `${(activePoint.x / chartW) * 100}%`,
              top: `${(activePoint.y / chartH) * 100}%`,
              transform: 'translate(-50%, -100%) translateY(-14px)',
            }}
          >
            <div className="bg-white rounded-xl shadow-lg border border-clay-100 p-3 w-56 animate-zoom-in">
              <div className="flex items-center justify-between mb-1.5">
                <div className="num font-bold text-clay-800 text-sm">{activePoint.record.date}</div>
                <div
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: `${sourceStyle[activePoint.record.source].color}20`, color: sourceStyle[activePoint.record.source].color }}
                >
                  {sourceLabel[activePoint.record.source]}
                </div>
              </div>
              <div className="num text-lg font-bold text-clay-900">{activePoint.record.weight.toFixed(1)} <span className="text-xs font-normal text-graphite-500">kg</span></div>
              <div className="mt-2 text-[11px] text-graphite-600 space-y-0.5">
                {activePoint.record.capturedByName && activePoint.record.capturedByName !== petName && (
                  <div className="text-rust-600">当时称名: {activePoint.record.capturedByName}</div>
                )}
                <div className="flex items-center gap-0.5">
                  <span>可信度</span>
                  <span className="text-clay-500 tracking-tight">
                    {'★'.repeat(activePoint.record.credibility)}
                    <span className="text-clay-200">{'★'.repeat(5 - activePoint.record.credibility)}</span>
                  </span>
                </div>
                {activePoint.record.note && (
                  <div className="pt-1 border-t border-clay-50 text-graphite-500 leading-snug">{activePoint.record.note}</div>
                )}
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-2">
                <div className="w-4 h-4 bg-white border-r border-b border-clay-100 rotate-45" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
