import { cn } from '@/lib/utils'

type StatusType = 'pending' | 'normal' | 'abnormal' | 'onsite' | 'completed' | 'verify' | 'blocked'

interface StatusBadgeProps {
  status: StatusType
}

const statusConfig: Record<StatusType, { text: string; className: string }> = {
  pending: {
    text: '待复核',
    className: 'bg-warning-100 text-warning-700 border-warning-300',
  },
  normal: {
    text: '正常',
    className: 'bg-success-100 text-success-700 border-success-300',
  },
  abnormal: {
    text: '异常',
    className: 'bg-red-100 text-red-700 border-red-300',
  },
  onsite: {
    text: '需现场',
    className: 'bg-caution-100 text-caution-700 border-caution-300',
  },
  completed: {
    text: '已完成',
    className: 'bg-success-100 text-success-700 border-success-300',
  },
  verify: {
    text: '待核实',
    className: 'bg-caution-100 text-caution-700 border-caution-300',
  },
  blocked: {
    text: '被阻断',
    className: 'bg-warning-100 text-warning-700 border-warning-300',
  },
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border',
        config.className
      )}
    >
      {config.text}
    </span>
  )
}
