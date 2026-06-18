import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricBarProps {
  totalAnomalies: number
  suspendedCount: number
  todayNew: number
}

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const duration = 800
    const start = 0
    const startTime = performance.now()

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + (value - start) * easeOut))
      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [value])

  return <span className={cn('font-mono tabular-nums', className)}>{display}</span>
}

export default function MetricBar({ totalAnomalies, suspendedCount, todayNew }: MetricBarProps) {
  const metrics = [
    {
      label: '异常总数',
      value: totalAnomalies,
      icon: Activity,
      color: 'text-neon',
      bg: 'bg-neon/10',
      border: 'border-neon/20',
    },
    {
      label: '挂起待确认',
      value: suspendedCount,
      icon: AlertTriangle,
      color: 'text-alert',
      bg: 'bg-alert/10',
      border: 'border-alert/20',
      pulse: suspendedCount > 0,
    },
    {
      label: '今日新增',
      value: todayNew,
      icon: TrendingUp,
      color: 'text-surface',
      bg: 'bg-surface/10',
      border: 'border-surface/20',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {metrics.map((metric, idx) => (
        <div
          key={idx}
          className={cn(
            'relative overflow-hidden rounded-xl p-5 border backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]',
            metric.bg,
            metric.border,
            metric.pulse && 'animate-pulse-slow'
          )}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-muted text-sm mb-1">{metric.label}</p>
              <AnimatedNumber
                value={metric.value}
                className={cn('text-3xl font-bold font-display', metric.color, 'text-shadow-glow')}
              />
            </div>
            <div className={cn('p-3 rounded-lg', metric.bg)}>
              <metric.icon className={cn('w-6 h-6', metric.color)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
