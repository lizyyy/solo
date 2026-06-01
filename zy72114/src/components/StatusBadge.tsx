import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: 'draft' | 'validating' | 'calculated' | 'reported' | 'archived'
  size?: 'sm' | 'md'
}

const statusConfig = {
  draft: { label: '草稿', color: 'eng-badge-info' },
  validating: { label: '校验中', color: 'eng-badge-warning' },
  calculated: { label: '已计算', color: 'eng-badge-safe' },
  reported: { label: '已报告', color: 'eng-badge-safe' },
  archived: { label: '已归档', color: 'eng-badge' },
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status]
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : ''

  return (
    <span className={cn(config.color, sizeClass)}>
      {config.label}
    </span>
  )
}
