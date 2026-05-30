import { X, RotateCcw, BarChart2, Zap, Target, AlertCircle, Play } from 'lucide-react'
import type { FailureFeedback } from '@/types'
import { useGameStore } from '@/store/gameStore'

interface FailurePanelProps {
  feedback: FailureFeedback
}

export default function FailurePanel({ feedback }: FailurePanelProps) {
  const dismissFailure = useGameStore(s => s.dismissFailure)
  const openReplay = useGameStore(s => s.openReplay)

  const categoryInfo: Record<string, { color: string; label: string; icon: typeof BarChart2 }> = {
    probability: { color: 'var(--accent-purple)', label: '概率理解', icon: BarChart2 },
    measurement: { color: 'var(--accent-cyan)', label: '测量坍缩', icon: Zap },
    sample: { color: 'var(--warning-amber)', label: '样本偏差', icon: BarChart2 },
    concept: { color: 'var(--accent-pink)', label: '概念错误', icon: Target },
    operation: { color: 'var(--text-secondary)', label: '操作失误', icon: AlertCircle },
  }

  const info = categoryInfo[feedback.errorCategory] || categoryInfo.concept
  const CategoryIcon = info.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end" onClick={dismissFailure}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} />

      <div
        className="relative w-full max-w-md h-full overflow-y-auto animate-slide-in-right"
        style={{ background: 'var(--bg-card)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4" style={{ background: 'var(--bg-card)', borderBottomWidth: 1, borderColor: 'var(--border-glow)' }}>
          <h2 className="font-display font-bold text-xl" style={{ color: 'var(--error-red)' }}>
            实验失败
          </h2>
          <button
            onClick={dismissFailure}
            className="p-2 rounded-lg transition hover:scale-110"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(255,82,82,0.1)' }}>
            <div className="p-3 rounded-full" style={{ background: info.color, color: 'var(--bg-deep)' }}>
              <CategoryIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: info.color }}>{info.label}</div>
              <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{feedback.errorDescription}</div>
            </div>
          </div>

          <div>
            <h3 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>📊 概率更新状态</h3>
            <div className="space-y-2 p-4 rounded-xl" style={{ background: 'var(--bg-deep)' }}>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>实验频率</span>
                <span style={{ color: 'var(--accent-purple)' }}>
                  [{feedback.probabilityUpdateStatus.after.map(p => (p * 100).toFixed(1)).join('%, ')}%]
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>理论概率</span>
                <span style={{ color: 'var(--accent-cyan)' }}>
                  [16.7%, 16.7%, 16.7%, 16.7%, 16.7%, 16.7%]
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>最大偏差</span>
                <span style={{ color: 'var(--error-red)' }}>
                  {(Math.max(...feedback.probabilityUpdateStatus.delta.map(Math.abs)) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>⚡ 测量状态</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl text-center" style={{ background: 'var(--bg-deep)' }}>
                <div className="text-2xl font-display font-bold" style={{ color: feedback.measurementState.collapsed ? 'var(--success-green)' : 'var(--accent-cyan)' }}>
                  {feedback.measurementState.collapsed ? '已坍缩' : '叠加态'}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>骰子状态</div>
              </div>
              <div className="p-4 rounded-xl text-center" style={{ background: 'var(--bg-deep)' }}>
                <div className="text-2xl font-display font-bold" style={{ color: feedback.measurementState.repeatedCount > 3 ? 'var(--error-red)' : 'var(--accent-purple)' }}>
                  {feedback.measurementState.repeatedCount}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>重复测量次数</div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>📈 样本统计</h3>
            <div className="space-y-3 p-4 rounded-xl" style={{ background: 'var(--bg-deep)' }}>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>样本量</span>
                <span style={{ color: 'var(--accent-cyan)' }}>{feedback.sampleStatistics.size}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>均值</span>
                <span style={{ color: 'var(--accent-purple)' }}>{feedback.sampleStatistics.mean.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>方差</span>
                <span style={{ color: feedback.sampleStatistics.variance > 3 ? 'var(--error-red)' : 'var(--success-green)' }}>
                  {feedback.sampleStatistics.variance.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={() => {
                openReplay(feedback.replaySnapshotId)
                dismissFailure()
              }}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-bold transition hover:scale-105"
              style={{ background: 'var(--accent-cyan)', color: 'var(--bg-deep)' }}
            >
              <Play className="w-5 h-5" />
              回看失败时刻
            </button>
          </div>

          <div className="pt-2">
            <button
              onClick={dismissFailure}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-medium transition hover:scale-105"
              style={{ background: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
            >
              <RotateCcw className="w-5 h-5" />
              重新尝试
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
