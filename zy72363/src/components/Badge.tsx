import { clsx } from 'clsx'

type ReviewStatusType = 'pending' | 'approved' | 'rollback'
type SourceType = 'auto' | 'manual'

interface BadgeBaseProps {
  size?: 'sm' | 'md'
  className?: string
}

interface ReviewStatusBadgeProps extends BadgeBaseProps {
  type: 'reviewStatus'
  status: ReviewStatusType
}

interface SourceBadgeProps extends BadgeBaseProps {
  type: 'source'
  source: SourceType
}

interface NoReasonBadgeProps extends BadgeBaseProps {
  type: 'noReason'
}

type BadgeProps = ReviewStatusBadgeProps | SourceBadgeProps | NoReasonBadgeProps

const reviewStatusConfig: Record<ReviewStatusType, { label: string; className: string }> = {
  pending: { label: '待复核', className: 'bg-warning text-white' },
  approved: { label: '已通过', className: 'bg-success text-white' },
  rollback: { label: '已回滚', className: 'bg-muted text-white' },
}

const sourceConfig: Record<SourceType, { label: string; className: string }> = {
  auto: { label: '自动生成', className: 'bg-blue-500 text-white' },
  manual: { label: '人工修改', className: 'bg-purple-500 text-white' },
}

export default function Badge(props: BadgeProps) {
  const { size = 'md', className } = props

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  }

  if (props.type === 'reviewStatus') {
    const config = reviewStatusConfig[props.status]
    return (
      <span
        className={clsx(
          'inline-flex items-center rounded-full font-medium',
          sizeClasses[size],
          config.className,
          className
        )}
      >
        {config.label}
      </span>
    )
  }

  if (props.type === 'source') {
    const config = sourceConfig[props.source]
    return (
      <span
        className={clsx(
          'inline-flex items-center rounded-full font-medium',
          sizeClasses[size],
          config.className,
          className
        )}
      >
        {config.label}
      </span>
    )
  }

  if (props.type === 'noReason') {
    return (
      <span
        className={clsx(
          'inline-flex items-center rounded-full font-medium',
          sizeClasses[size],
          'bg-danger text-white animate-pulse-slow',
          className
        )}
      >
        无原因
      </span>
    )
  }

  return null
}
