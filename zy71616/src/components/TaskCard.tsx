import { ArrowLeft, RotateCcw, Star } from 'lucide-react'
import type { LevelConfig } from '@/types'

interface TaskCardProps {
  config: LevelConfig
  attemptCount: number
  selectedAnswer: string | null
  onSelectAnswer: (answer: string) => void
  onSubmit: () => void
  onBack: () => void
  onReset: () => void
  passed: boolean
  stars: number
}

export default function TaskCard({
  config,
  attemptCount,
  selectedAnswer,
  onSelectAnswer,
  onSubmit,
  onBack,
  onReset,
  passed,
  stars,
}: TaskCardProps) {
  return (
    <div
      className="relative glow-border rounded-2xl p-6"
      style={{
        background: 'var(--bg-card)',
        borderColor: passed ? 'var(--success-green)' : 'var(--border-glow)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium transition hover:scale-105"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          返回关卡选择
        </button>
        <div className="flex items-center gap-1">
          {[1, 2, 3].map(n => (
            <Star
              key={n}
              className="w-5 h-5"
              style={{
                color: n <= stars ? 'var(--warning-amber)' : 'var(--text-muted)',
                fill: n <= stars ? 'var(--warning-amber)' : 'transparent',
              }}
            />
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display font-bold text-lg" style={{ color: 'var(--accent-cyan)' }}>
            任务：{config.name}
          </h3>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            尝试 {attemptCount} 次
          </span>
        </div>
        <p className="text-base" style={{ color: 'var(--text-primary)' }}>
          {config.taskPrompt}
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--accent-purple)' }}>
          💡 提示：{config.hint}
        </p>
      </div>

      {passed ? (
        <div className="text-center py-6">
          <div className="text-2xl mb-2">🎉</div>
          <p className="font-bold text-lg mb-4" style={{ color: 'var(--success-green)' }}>
            恭喜通过！获得 {stars} 星评价
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition hover:scale-105"
              style={{ background: 'var(--bg-card-hover)', color: 'var(--accent-cyan)', borderWidth: 1, borderColor: 'var(--accent-cyan)' }}
            >
              <RotateCcw className="w-4 h-4" />
              再来一次
            </button>
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition hover:scale-105"
              style={{ background: 'var(--accent-cyan)', color: 'var(--bg-deep)' }}
            >
              选择下一关
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mb-4">
            {config.answerOptions.map(option => (
              <button
                key={option}
                onClick={() => onSelectAnswer(option)}
                className={`p-3 rounded-lg font-medium transition-all ${
                  selectedAnswer === option ? 'scale-105' : 'hover:scale-102'
                }`}
                style={{
                  background: selectedAnswer === option ? 'var(--accent-cyan)' : 'var(--bg-deep)',
                  color: selectedAnswer === option ? 'var(--bg-deep)' : 'var(--text-primary)',
                  borderWidth: 1,
                  borderColor: selectedAnswer === option ? 'var(--accent-cyan)' : 'var(--border-glow)',
                  boxShadow: selectedAnswer === option ? '0 0 15px rgba(0,245,212,0.4)' : 'none',
                }}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition hover:scale-105"
              style={{ background: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
            >
              <RotateCcw className="w-4 h-4" />
              重置实验
            </button>
            <button
              onClick={onSubmit}
              disabled={!selectedAnswer}
              className="flex-1 px-5 py-2 rounded-lg font-bold transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent-cyan)', color: 'var(--bg-deep)' }}
            >
              提交答案
            </button>
          </div>
        </>
      )}
    </div>
  )
}
