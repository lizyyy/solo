import { Play, RefreshCcw, BarChart3, Zap, Layers, TrendingUp } from 'lucide-react'
import { SAMPLE_SIZES } from '@/utils/constants'

interface SampleControlProps {
  sampleSize: number
  onChangeSize: (size: number) => void
  onRoll: () => void
  onReset: () => void
  disabled?: boolean
}

const ICONS: Record<number, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  1: Zap,
  10: Layers,
  100: BarChart3,
  1000: TrendingUp,
}

export default function SampleControl({ sampleSize, onChangeSize, onRoll, onReset, disabled }: SampleControlProps) {
  return (
    <div className="relative glow-border rounded-2xl p-6" style={{ background: 'var(--bg-card)' }}>
      <h3 className="font-display font-bold text-lg mb-4" style={{ color: 'var(--text-primary)' }}>
        样本控制
      </h3>

      <div className="mb-5">
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>一次投掷多少个骰子？</p>
        <div className="flex gap-2">
          {SAMPLE_SIZES.map(size => {
            const Icon = ICONS[size]
            const isActive = size === sampleSize
            return (
              <button
                key={size}
                onClick={() => onChangeSize(size)}
                className="flex-1 flex flex-col items-center gap-1 p-3 rounded-lg font-medium transition-all"
                style={{
                  background: isActive ? 'var(--accent-cyan)' : 'var(--bg-deep)',
                  color: isActive ? 'var(--bg-deep)' : 'var(--text-primary)',
                  borderWidth: 1,
                  borderColor: isActive ? 'var(--accent-cyan)' : 'var(--border-glow)',
                  boxShadow: isActive ? '0 0 15px rgba(0,245,212,0.4)' : 'none',
                }}
              >
                <Icon className="w-5 h-5" />
                <span>{size}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onRoll}
          disabled={disabled}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-bold transition hover:scale-105 active:scale-95 disabled:opacity-40"
          style={{ background: 'var(--accent-purple)', color: 'var(--bg-deep)' }}
        >
          <Play className="w-5 h-5" />
          投掷
        </button>
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-medium transition hover:scale-105"
          style={{ background: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
        >
          <RefreshCcw className="w-5 h-5" />
          清零
        </button>
      </div>

      <p className="text-xs mt-4 text-center" style={{ color: 'var(--text-muted)' }}>
        大数定律：样本量越大，实验频率越接近理论概率
      </p>
    </div>
  )
}
