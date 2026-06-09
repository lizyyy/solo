import { Link } from 'react-router-dom'
import { weightRecords } from '../../data/mockWeightRecords'
import { useAppStore } from '../../store/useAppStore'
import type { DeliveryCard as DeliveryCardType } from '../../types'

interface DeliveryCardProps {
  card: DeliveryCardType
  index: number
}

export default function DeliveryCard({ card, index }: DeliveryCardProps) {
  const deliveryMode = useAppStore((s) => s.deliveryMode)

  const petRecords = weightRecords
    .filter((r) => r.petId === card.petId && r.isIncluded)
    .sort((a, b) => a.date.localeCompare(b.date))

  const W = 240
  const H = 120
  const PAD_L = 24
  const PAD_R = 12
  const PAD_T = 16
  const PAD_B = 20
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B

  const weights = petRecords.map((r) => r.weight)
  const minW = weights.length > 0 ? Math.min(...weights) - 0.3 : 0
  const maxW = weights.length > 0 ? Math.max(...weights) + 0.3 : 1

  const xFor = (i: number) =>
    petRecords.length > 1
      ? PAD_L + (i / (petRecords.length - 1)) * plotW
      : PAD_L + plotW / 2

  const yFor = (w: number) =>
    PAD_T + (1 - (w - minW) / (maxW - minW)) * plotH

  const pointsStr = petRecords
    .map((r, i) => `${xFor(i)},${yFor(r.weight)}`)
    .join(' ')

  const highlightDates = card.curveHighlight.date.split(/[至\/,，]/)
  let highlightIdx = -1
  for (let i = 0; i < petRecords.length; i++) {
    for (const hd of highlightDates) {
      const trimmed = hd.trim()
      if (trimmed && petRecords[i].date.includes(trimmed)) {
        highlightIdx = i
        break
      }
    }
    if (highlightIdx >= 0) break
  }

  if (highlightIdx < 0 && petRecords.length > 0) {
    highlightIdx = Math.floor(petRecords.length / 2)
  }

  const hx = highlightIdx >= 0 ? xFor(highlightIdx) : PAD_L + plotW / 2
  const hy = highlightIdx >= 0 ? yFor(petRecords[highlightIdx]?.weight ?? (minW + maxW) / 2) : PAD_T + plotH / 2

  const arrowX2 = hx + 55
  const arrowY2 = Math.max(hy - 25, PAD_T + 8)

  const cardShadow = deliveryMode ? 'shadow-lg' : 'shadow-card'
  const hoverClass = deliveryMode ? '' : 'hover:shadow-card-hover transition-all'

  return (
    <div className={`card p-5 ${cardShadow} ${hoverClass} relative`}>
      {!deliveryMode && (
        <Link
          to={`/pet/${card.petId}`}
          className="absolute top-4 right-4 text-xs text-clay-600 hover:text-clay-800 font-medium inline-flex items-center gap-1"
        >
          🔗 详情
        </Link>
      )}

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-2 bg-paper-deep p-4 rounded-lg">
          <span className="flag-badge bg-rust mb-2 inline-block">异常 #{index + 1}</span>
          <div className="whitespace-pre-wrap text-sm text-clay-800 leading-relaxed mt-2">
            {card.summaryText}
          </div>
        </div>

        <div className="col-span-3">
          <svg width={W} height={H} className="w-full">
            <defs>
              <linearGradient id={`grad-${card.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8FA68C" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#8FA68C" stopOpacity="0" />
              </linearGradient>
            </defs>

            {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
              <line
                key={i}
                x1={PAD_L}
                y1={PAD_T + t * plotH}
                x2={W - PAD_R}
                y2={PAD_T + t * plotH}
                stroke="#E8C29F"
                strokeOpacity="0.3"
                strokeDasharray="3 3"
              />
            ))}

            {petRecords.length > 0 && (
              <>
                <polyline
                  fill="none"
                  stroke="#8FA68C"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={pointsStr}
                />
                <polygon
                  fill={`url(#grad-${card.id})`}
                  points={`${xFor(0)},${PAD_T + plotH} ${pointsStr} ${xFor(petRecords.length - 1)},${PAD_T + plotH}`}
                />
              </>
            )}

            {petRecords.map((r, i) => (
              <circle
                key={r.id}
                cx={xFor(i)}
                cy={yFor(r.weight)}
                r="2.5"
                fill="#8FA68C"
              />
            ))}

            {highlightIdx >= 0 && (
              <>
                <circle cx={hx} cy={hy} r="5" fill="#B5523A" stroke="white" strokeWidth="2" />
                <line
                  x1={hx}
                  y1={hy}
                  x2={arrowX2 - 4}
                  y2={arrowY2 + 4}
                  stroke="#B5523A"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <polygon
                  points={`${arrowX2},${arrowY2} ${arrowX2 - 6},${arrowY2 + 2} ${arrowX2 - 2},${arrowY2 + 6}`}
                  fill="#B5523A"
                />
                <text
                  x={Math.min(arrowX2, W - 8)}
                  y={arrowY2 - 6}
                  fill="#565264"
                  fontSize="9"
                  textAnchor="end"
                  className="font-medium"
                >
                  {card.curveHighlight.arrowNote}
                </text>
                <text
                  x={Math.min(arrowX2, W - 8)}
                  y={arrowY2 + 4}
                  fill="#B5523A"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="end"
                  className="num"
                >
                  {card.curveHighlight.weightDiff}
                </text>
              </>
            )}
          </svg>
        </div>
      </div>

      <div className="mt-4 col-span-5 border-2 border-dashed border-clay-200 p-3 rounded-lg bg-paper-deep/40">
        <span className="font-kai text-sm text-clay-700">
          📌 {card.impactStatement}
        </span>
      </div>
    </div>
  )
}
