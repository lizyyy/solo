import type { RiskLevel, NotificationStatus, MatchStatus } from '@/lib/api'

const RISK_CONFIG: Record<RiskLevel, { label: string; className: string }> = {
  safe: { label: '安全', className: 'bg-safe/15 text-safe border-safe/30' },
  warning: { label: '预警', className: 'bg-warning/15 text-warning border-warning/30' },
  margin_call: { label: '追保', className: 'bg-margin-call/15 text-margin-call border-margin-call/30' },
  force_liquidation: { label: '强平', className: 'bg-force-liq/15 text-force-liq border-force-liq/30' },
}

const NOTIFICATION_STATUS_CONFIG: Record<NotificationStatus, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-text-secondary/15 text-text-secondary border-text-secondary/30' },
  sent: { label: '已发送', className: 'bg-accent/15 text-accent border-accent/30' },
  confirmed: { label: '已确认', className: 'bg-safe/15 text-safe border-safe/30' },
  withdrawn: { label: '已撤回', className: 'bg-warning/15 text-warning border-warning/30' },
  partially_deducted: { label: '部分抵扣', className: 'bg-margin-call/15 text-margin-call border-margin-call/30' },
  settled: { label: '已结清', className: 'bg-safe/15 text-safe border-safe/30' },
}

const MATCH_STATUS_CONFIG: Record<MatchStatus, { label: string; className: string }> = {
  unmatched: { label: '未匹配', className: 'bg-force-liq/15 text-force-liq border-force-liq/30' },
  partially_matched: { label: '部分匹配', className: 'bg-warning/15 text-warning border-warning/30' },
  matched: { label: '已匹配', className: 'bg-safe/15 text-safe border-safe/30' },
}

type BadgeType = 'risk' | 'notification' | 'match'

interface StatusBadgeProps {
  type: BadgeType
  value: string
}

export default function StatusBadge({ type, value }: StatusBadgeProps) {
  let config: { label: string; className: string } | undefined

  if (type === 'risk') {
    config = RISK_CONFIG[value as RiskLevel]
  } else if (type === 'notification') {
    config = NOTIFICATION_STATUS_CONFIG[value as NotificationStatus]
  } else {
    config = MATCH_STATUS_CONFIG[value as MatchStatus]
  }

  if (!config) return null

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  )
}
