import { useExposureStore } from '@/store/exposureStore'
import type { ExposureSummary } from '@/types'

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + 'K'
  return n.toFixed(2)
}

export default function SummaryCards({ summary }: { summary: ExposureSummary }) {
  const anomalies = useExposureStore((s) => s.anomalies)
  const unresolvedCount = anomalies.filter((a) => a.resolution === 'UNRESOLVED').length

  const cards = [
    {
      label: '净敞口',
      value: fmtNum(summary.netExposure),
      sub: `多 ${fmtNum(summary.totalLong)} / 空 ${fmtNum(summary.totalShort)}`,
      color: summary.netExposure >= 0 ? 'from-accent-green/20 to-accent-green/5' : 'from-accent-red/20 to-accent-red/5',
      textColor: summary.netExposure >= 0 ? 'text-accent-green' : 'text-accent-red',
    },
    {
      label: '自然对冲比例',
      value: (summary.naturalHedgeRatio * 100).toFixed(1) + '%',
      sub: '多空互抵效果',
      color: 'from-accent-blue/20 to-accent-blue/5',
      textColor: 'text-accent-blue',
    },
    {
      label: '套保覆盖率',
      value: (summary.hedgeCoverageRatio * 100).toFixed(1) + '%',
      sub: '已套保/总敞口',
      color: 'from-accent-gold/20 to-accent-gold/5',
      textColor: 'text-accent-gold',
    },
    {
      label: '异常待处理',
      value: unresolvedCount.toString(),
      sub: unresolvedCount > 0 ? '需要关注' : '全部已处理',
      color: unresolvedCount > 0 ? 'from-accent-red/20 to-accent-red/5' : 'from-accent-green/20 to-accent-green/5',
      textColor: unresolvedCount > 0 ? 'text-accent-red' : 'text-accent-green',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <div key={c.label} className={`card bg-gradient-to-br ${c.color}`}>
          <div className="text-xs text-txt-secondary mb-1">{c.label}</div>
          <div className={`text-xl font-mono font-bold ${c.textColor}`}>{c.value}</div>
          <div className="text-xs text-txt-muted mt-1">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}
