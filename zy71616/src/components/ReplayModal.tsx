import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useGameStore } from '@/store/gameStore'
import { formatTimestamp } from '@/utils/helpers'
import type { OperationSnapshot } from '@/types'

export default function ReplayModal() {
  const showReplay = useGameStore(s => s.showReplay)
  const replaySnapshotId = useGameStore(s => s.replaySnapshotId)
  const operationHistory = useGameStore(s => s.operationHistory)
  const closeReplay = useGameStore(s => s.closeReplay)

  if (!showReplay) return null

  const currentIdx = operationHistory.findIndex(s => s.id === replaySnapshotId)
  const currentSnap = operationHistory[currentIdx] as OperationSnapshot | undefined

  const goPrev = () => {
    if (currentIdx > 0) {
      // Update via store - we'll need to add a method
    }
  }

  const goNext = () => {
    if (currentIdx < operationHistory.length - 1) {
      // Update via store
    }
  }

  if (!currentSnap) return null

  const opLabels: Record<string, string> = {
    roll: '投掷骰子',
    measure: '测量骰子',
    change_sample: '更改样本量',
    reset_sample: '重置样本',
    submit_answer: '提交答案',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeReplay}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)' }} />

      <div
        className="relative w-full max-w-2xl mx-4 rounded-2xl overflow-hidden animate-fade-in-up"
        style={{ background: 'var(--bg-card)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottomWidth: 1, borderColor: 'var(--border-glow)' }}>
          <h2 className="font-display font-bold text-xl" style={{ color: 'var(--accent-cyan)' }}>
            🔄 操作回放
          </h2>
          <button
            onClick={closeReplay}
            className="p-2 rounded-lg transition hover:scale-110"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={goPrev}
              disabled={currentIdx <= 0}
              className="p-2 rounded-lg transition disabled:opacity-30"
              style={{ color: 'var(--accent-cyan)' }}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="text-center">
              <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                {opLabels[currentSnap.operationType]}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {formatTimestamp(currentSnap.timestamp)}
              </div>
            </div>
            <button
              onClick={goNext}
              disabled={currentIdx >= operationHistory.length - 1}
              className="p-2 rounded-lg transition disabled:opacity-30"
              style={{ color: 'var(--accent-cyan)' }}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {currentSnap.isAnomaly && (
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255,82,82,0.15)', color: 'var(--error-red)' }}>
              ⚠️ 异常操作标记：{currentSnap.anomalyType}
            </div>
          )}

          <div>
            <h3 className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>骰子状态</h3>
            <div className="p-4 rounded-xl" style={{ background: 'var(--bg-deep)' }}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>状态：</span>
                  <span style={{ color: 'var(--accent-cyan)' }}>
                    {currentSnap.diceState.phase === 'superposition' ? '叠加态' : '已坍缩'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>坍缩值：</span>
                  <span style={{ color: 'var(--accent-purple)' }}>
                    {currentSnap.diceState.collapsedValue !== null ? currentSnap.diceState.collapsedValue + 1 : '无'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>测量次数：</span>
                  <span style={{ color: 'var(--accent-cyan)' }}>{currentSnap.diceState.measurementCount}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>样本量：</span>
                  <span style={{ color: 'var(--accent-purple)' }}>{currentSnap.sampleSize}</span>
                </div>
              </div>
              <div className="mt-3 text-xs">
                <span style={{ color: 'var(--text-muted)' }}>概率分布：</span>
                <div className="mt-1 font-mono" style={{ color: 'var(--text-secondary)' }}>
                  [{currentSnap.diceState.probabilities.map(p => (p * 100).toFixed(0)).join('%, ')}%]
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>实验统计</h3>
            <div className="p-4 rounded-xl" style={{ background: 'var(--bg-deep)' }}>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>总投掷次数</span>
                  <span style={{ color: 'var(--accent-cyan)' }}>{currentSnap.probabilityBoard.totalRolls}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>各面计数</span>
                  <span className="font-mono" style={{ color: 'var(--accent-purple)' }}>
                    [{currentSnap.probabilityBoard.faceCounts.join(', ')}]
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>归一状态</span>
                  <span style={{ color: currentSnap.probabilityBoard.isNormalized ? 'var(--success-green)' : 'var(--error-red)' }}>
                    {currentSnap.probabilityBoard.isNormalized ? '✓ 已归一' : '✗ 未归一'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {currentSnap.answer && (
            <div>
              <h3 className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>提交的答案</h3>
              <div className="p-4 rounded-xl" style={{ background: 'var(--bg-deep)', color: 'var(--accent-pink)' }}>
                {currentSnap.answer}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
