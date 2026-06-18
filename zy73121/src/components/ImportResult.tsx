import { CheckCircle, XCircle, AlertTriangle, Info, X, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface ImportResultProps {
  result: {
    added: number
    skipped: number
    boundary: number
    suspended: number
  }
  onClose: () => void
}

export default function ImportResult({ result, onClose }: ImportResultProps) {
  const navigate = useNavigate()

  const stats = [
    {
      label: '成功导入',
      value: result.added,
      icon: CheckCircle,
      color: 'text-neon',
      bg: 'bg-neon/10',
      border: 'border-neon/30',
    },
    {
      label: '跳过重复',
      value: result.skipped,
      icon: XCircle,
      color: 'text-muted',
      bg: 'bg-ocean-700/50',
      border: 'border-ocean-600',
    },
    {
      label: '边界样本',
      value: result.boundary,
      icon: Info,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
    },
    {
      label: '挂起待确认',
      value: result.suspended,
      icon: AlertTriangle,
      color: 'text-alert',
      bg: 'bg-alert/10',
      border: 'border-alert/30',
      pulse: result.suspended > 0,
    },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-ocean-800 border border-ocean-700 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ocean-700 bg-ocean-800/50">
          <h3 className="font-semibold text-surface font-display text-lg">导入完成</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-surface hover:bg-ocean-700/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            {stats.map((stat, idx) => (
              <div
                key={idx}
                className={cn(
                  'rounded-xl p-4 border transition-all',
                  stat.bg,
                  stat.border,
                  stat.pulse && 'animate-pulse-slow'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn('p-1.5 rounded-lg', stat.bg)}>
                    <stat.icon className={cn('w-4 h-4', stat.color)} />
                  </div>
                  <span className="text-sm text-muted">{stat.label}</span>
                </div>
                <p className={cn('text-2xl font-bold font-mono font-display', stat.color)}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-ocean-900/50 text-sm">
              <CheckCircle className="w-4 h-4 text-neon flex-shrink-0 mt-0.5" />
              <p className="text-muted">
                已导入 <span className="text-surface font-medium">{result.added}</span> 条船上记录，
                重复数据已自动跳过，原有备注未被覆盖
              </p>
            </div>
            {result.suspended > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-alert/10 text-sm border border-alert/30">
                <AlertTriangle className="w-4 h-4 text-alert flex-shrink-0 mt-0.5" />
                <p className="text-muted">
                  <span className="text-alert font-medium">{result.suspended}</span> 条记录因经纬度疑似反写已自动挂起，
                  需接手同事确认后方可解除
                </p>
              </div>
            )}
            {result.boundary > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 text-sm border border-blue-500/30">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-muted">
                  包含 <span className="text-blue-400 font-medium">{result.boundary}</span> 条边界样本，
                  可用于验证异常判定逻辑的临界阈值
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg bg-ocean-700 text-surface hover:bg-ocean-600 transition-colors font-medium"
            >
              继续导入
            </button>
            <button
              onClick={() => {
                onClose()
                navigate('/')
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-neon text-ocean-950 hover:bg-neon/90 transition-colors font-semibold"
            >
              查看异常队列
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
