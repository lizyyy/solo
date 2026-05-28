import { X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

interface ScoreDetailModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ScoreDetailModal({ isOpen, onClose }: ScoreDetailModalProps) {
  const { score } = useStore()

  const metrics = [
    {
      key: 'coolingEfficiency',
      label: '制冷效率',
      value: score.coolingEfficiency,
      explanation: '衡量CRAC单位制冷量与机架总散热量的比值，越高表示制冷效率越好。',
    },
    {
      key: 'hotspotCount',
      label: '热点数量',
      value: 100 - score.hotspotCount,
      explanation: '检测温度超过阈值的区域数量，热点越少得分越高。',
    },
    {
      key: 'airflowUtilization',
      label: '气流利用率',
      value: score.airflowUtilization,
      explanation: '衡量有效冷却气流与总送风量的比值，反映气流组织的合理性。',
    },
    {
      key: 'overallScore',
      label: '综合评分',
      value: score.overallScore,
      explanation: '综合以上各项指标的加权总分，满分为100分。',
    },
  ]

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'bg-green-500'
    if (s >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getScoreTextColor = (s: number) => {
    if (s >= 80) return 'text-green-400'
    if (s >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-dc-panel border border-dc-border rounded-lg w-[500px] max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-dc-border">
          <h2 className="text-lg font-medium text-dc-text">评分详情</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-dc-muted hover:text-dc-text hover:bg-dc-bg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
          {metrics.map((metric) => (
            <div key={metric.key} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-dc-text">{metric.label}</span>
                <span
                  className={cn(
                    'text-sm font-bold font-mono',
                    getScoreTextColor(metric.value)
                  )}
                >
                  {metric.value.toFixed(1)}
                </span>
              </div>
              <div className="h-2 bg-dc-bg rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', getScoreColor(metric.value))}
                  style={{ width: `${Math.min(100, metric.value)}%` }}
                />
              </div>
              <p className="text-xs text-dc-muted">{metric.explanation}</p>
            </div>
          ))}

          <div className="pt-4 border-t border-dc-border">
            <h3 className="text-sm font-medium text-dc-text mb-3">计算详情</h3>
            <pre className="bg-dc-bg border border-dc-border rounded-md p-4 text-xs text-dc-muted font-mono whitespace-pre-wrap overflow-x-auto">
              {score.details}
            </pre>
          </div>
        </div>

        <div className="p-4 border-t border-dc-border flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-dc-cold text-dc-bg rounded-md text-sm font-medium hover:bg-opacity-90 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
