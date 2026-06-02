import { useStore } from '@/store/useStore'
import { STATUS_COLORS, STATUS_LABELS } from '@/types'
import type { PointStatus } from '@/types'
import { CheckCircle2, HelpCircle, Eye, AlertTriangle, Copy } from 'lucide-react'

const statusIcon: Record<PointStatus, typeof CheckCircle2> = {
  completed: CheckCircle2,
  pending_verify: HelpCircle,
  need_onsite: Eye,
}

export default function UndergroundMap() {
  const { points, selectedPointId, selectPoint } = useStore()

  return (
    <svg viewBox="0 0 960 500" className="w-full h-full" style={{ minHeight: 400 }}>
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(71,85,105,0.3)" strokeWidth="0.5" />
        </pattern>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="bg-grad" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="rgba(30,41,59,0.8)" />
          <stop offset="100%" stopColor="rgba(15,23,42,0.95)" />
        </radialGradient>
      </defs>

      <rect width="960" height="500" fill="url(#bg-grad)" />
      <rect width="960" height="500" fill="url(#grid)" />

      <g opacity="0.25">
        <rect x="60" y="40" width="340" height="160" rx="8" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />
        <text x="230" y="30" textAnchor="middle" fill="#94A3B8" fontSize="11" fontFamily="'Noto Sans SC'">B1层 西区</text>

        <rect x="440" y="40" width="260" height="160" rx="8" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />
        <text x="570" y="30" textAnchor="middle" fill="#94A3B8" fontSize="11" fontFamily="'Noto Sans SC'">B1层 东区</text>

        <rect x="60" y="240" width="400" height="220" rx="8" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />
        <text x="260" y="230" textAnchor="middle" fill="#94A3B8" fontSize="11" fontFamily="'Noto Sans SC'">B2层 西区</text>

        <rect x="500" y="240" width="400" height="220" rx="8" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />
        <text x="700" y="230" textAnchor="middle" fill="#94A3B8" fontSize="11" fontFamily="'Noto Sans SC'">B2层 东区</text>

        <line x1="400" y1="120" x2="440" y2="120" stroke="#475569" strokeWidth="1.5" strokeDasharray="6 3" />
        <line x1="460" y1="200" x2="500" y2="260" stroke="#475569" strokeWidth="1.5" strokeDasharray="6 3" />
        <line x1="260" y1="200" x2="300" y2="240" stroke="#475569" strokeWidth="1.5" strokeDasharray="6 3" />
      </g>

      {points.map((point) => {
        const color = STATUS_COLORS[point.status]
        const isSelected = selectedPointId === point.id
        const Icon = statusIcon[point.status]
        const sameNamePoints = points.filter((p) => p.intersectionName === point.intersectionName && p.id !== point.id)

        return (
          <g
            key={point.id}
            onClick={() => selectPoint(point.id)}
            className="cursor-pointer"
            filter={isSelected ? 'url(#glow)' : undefined}
          >
            {point.coordDrift && (
              <circle
                cx={point.coordX}
                cy={point.coordY}
                r="24"
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeDasharray="4 3"
                opacity="0.5"
                className="pulse-dot"
              />
            )}

            <circle
              cx={point.coordX}
              cy={point.coordY}
              r={isSelected ? 14 : 10}
              fill={isSelected ? color : `${color}33`}
              stroke={color}
              strokeWidth={isSelected ? 2.5 : 1.5}
              className="transition-all duration-200"
            />

            {isSelected && (
              <circle
                cx={point.coordX}
                cy={point.coordY}
                r="20"
                fill="none"
                stroke={color}
                strokeWidth="1"
                opacity="0.3"
              />
            )}

            <text
              x={point.coordX}
              y={point.coordY + 4}
              textAnchor="middle"
              fill={isSelected ? '#0F172A' : color}
              fontSize="8"
              fontWeight="600"
              fontFamily="'JetBrains Mono'"
            >
              {point.intersectionCode}
            </text>

            <text
              x={point.coordX}
              y={point.coordY - 16}
              textAnchor="middle"
              fill="#F1F5F9"
              fontSize="10"
              fontWeight="500"
              fontFamily="'Noto Sans SC'"
            >
              {point.intersectionName}
            </text>

            <text
              x={point.coordX}
              y={point.coordY + 24}
              textAnchor="middle"
              fill={color}
              fontSize="8"
              fontFamily="'Noto Sans SC'"
            >
              {STATUS_LABELS[point.status]}
            </text>

            {point.coordDrift && (
              <g transform={`translate(${point.coordX + 18}, ${point.coordY - 22})`}>
                <AlertTriangle size={12} color="#F59E0B" />
              </g>
            )}

            {sameNamePoints.length > 0 && (
              <g transform={`translate(${point.coordX - 20}, ${point.coordY - 22})`}>
                <Copy size={10} color="#F59E0B" />
              </g>
            )}
          </g>
        )
      })}

      <g transform="translate(20, 460)">
        <circle cx="8" cy="6" r="5" fill="#10B98133" stroke="#10B981" strokeWidth="1.5" />
        <text x="20" y="10" fill="#94A3B8" fontSize="9" fontFamily="'Noto Sans SC'">已处理</text>

        <circle cx="78" cy="6" r="5" fill="#F9731633" stroke="#F97316" strokeWidth="1.5" />
        <text x="90" y="10" fill="#94A3B8" fontSize="9" fontFamily="'Noto Sans SC'">待核实</text>

        <circle cx="148" cy="6" r="5" fill="#EF444433" stroke="#EF4444" strokeWidth="1.5" />
        <text x="160" y="10" fill="#94A3B8" fontSize="9" fontFamily="'Noto Sans SC'">需现场复看</text>

        <line x1="232" y1="6" x2="248" y2="6" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="4 3" />
        <text x="254" y="10" fill="#94A3B8" fontSize="9" fontFamily="'Noto Sans SC'">坐标偏移</text>
      </g>
    </svg>
  )
}
