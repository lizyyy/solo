import type { ProbabilityBoard } from '@/types'
import { AlertTriangle, BarChart2 } from 'lucide-react'

interface ProbabilityBoardProps {
  board: ProbabilityBoard
}

export default function ProbabilityBoardComponent({ board }: ProbabilityBoardProps) {
  const maxValue = 1 / 6 + 0.05

  return (
    <div className="relative glow-border rounded-2xl p-6" style={{ background: 'var(--bg-card)' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5" style={{ color: 'var(--accent-cyan)' }} />
          <h3 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>概率板</h3>
        </div>
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          总投掷：<span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{board.totalRolls}</span> 次
        </div>
      </div>

      {!board.isNormalized && board.normalizationError && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2 rounded-lg" style={{ background: 'rgba(255,82,82,0.1)', color: 'var(--error-red)' }}>
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm font-medium">{board.normalizationError}</span>
        </div>
      )}

      <div className="flex items-end justify-between gap-2 h-40 mb-4">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className="w-full flex items-end gap-1 h-32">
              <div
                className="flex-1 rounded-t transition-all duration-500"
                style={{
                  background: 'var(--accent-cyan)',
                  height: `${(board.theoretical[i] / maxValue) * 100}%`,
                  opacity: 0.3,
                }}
              />
              <div
                className="flex-1 rounded-t transition-all duration-500"
                style={{
                  background: 'var(--accent-purple)',
                  height: `${(board.experimental[i] / maxValue) * 100}%`,
                  boxShadow: board.experimental[i] > 0 ? '0 0 10px rgba(179,136,255,0.4)' : 'none',
                }}
              />
            </div>
            <div className="mt-2 text-center">
              <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{i + 1}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {board.faceCounts[i]}次
              </div>
              <div className="text-xs" style={{ color: 'var(--accent-purple)' }}>
                {(board.experimental[i] * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded" style={{ background: 'var(--accent-cyan)', opacity: 0.3 }} />
          <span style={{ color: 'var(--text-secondary)' }}>理论概率</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded" style={{ background: 'var(--accent-purple)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>实验频率</span>
        </div>
      </div>
    </div>
  )
}
