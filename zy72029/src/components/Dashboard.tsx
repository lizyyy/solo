import { useEffect, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { Clock, Target, Zap, AlertTriangle } from 'lucide-react'

export function Dashboard() {
  const { score, resource, risk, riskThreshold, timeRemaining, status } = useGameStore()
  const [animateScore, setAnimateScore] = useState(false)
  const [animateRisk, setAnimateRisk] = useState(false)

  useEffect(() => {
    setAnimateScore(true)
    const timer = setTimeout(() => setAnimateScore(false), 300)
    return () => clearTimeout(timer)
  }, [score])

  useEffect(() => {
    setAnimateRisk(true)
    const timer = setTimeout(() => setAnimateRisk(false), 300)
    return () => clearTimeout(timer)
  }, [risk])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const riskPercent = Math.min((risk / riskThreshold) * 100, 100)
  const isRiskHigh = risk >= riskThreshold * 0.7
  const isTimeLow = timeRemaining <= 60

  const getRiskBgColor = () => {
    if (riskPercent >= 90) return 'bg-danger-red'
    if (riskPercent >= 70) return 'bg-warning-orange'
    return 'bg-calm-blue'
  }

  return (
    <div className="bg-charcoal border-b border-white/10 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Target size={12} />
              分数
            </div>
            <div className={`font-mono text-2xl font-bold text-success-green ${animateScore ? 'count-animate' : ''}`}>
              {score}
            </div>
          </div>

          <div className="text-center">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Zap size={12} />
              资源
            </div>
            <div className="font-mono text-2xl font-bold text-calm-blue">
              {resource}
            </div>
          </div>

          <div className="min-w-[180px]">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-1 flex items-center gap-1">
              <AlertTriangle size={12} className={isRiskHigh ? 'text-warning-orange' : ''} />
              风险值 {risk}/{riskThreshold}
            </div>
            <div className="h-3 bg-white/10 rounded-sm overflow-hidden">
              <div
                className={`h-full ${getRiskBgColor()} transition-all duration-300 ${animateRisk ? 'animate-pulse-fast' : ''}`}
                style={{ width: `${riskPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs text-white/50 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Clock size={12} className={isTimeLow ? 'text-warning-orange' : ''} />
            剩余时间
          </div>
          <div className={`font-mono text-3xl font-bold ${isTimeLow ? 'text-warning-orange animate-pulse' : 'text-paper-cream'}`}>
            {formatTime(timeRemaining)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'playing' && (
            <span className="px-3 py-1 bg-success-green/20 text-success-green text-xs font-mono border border-success-green/30">
              ● 进行中
            </span>
          )}
          {status === 'paused' && (
            <span className="px-3 py-1 bg-warning-orange/20 text-warning-orange text-xs font-mono border border-warning-orange/30 animate-pulse">
              ⏸ 已暂停
            </span>
          )}
          {status === 'completed' && (
            <span className="px-3 py-1 bg-calm-blue/20 text-calm-blue text-xs font-mono border border-calm-blue/30">
              ✓ 已完成
            </span>
          )}
          {status === 'failed' && (
            <span className="px-3 py-1 bg-danger-red/20 text-danger-red text-xs font-mono border border-danger-red/30">
              ✗ 已失败
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
