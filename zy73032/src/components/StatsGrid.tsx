import { Clock, CalendarCheck, AlertCircle, FileText } from 'lucide-react'
import { useReconcileStore } from '../store/useReconcileStore'

export default function StatsGrid() {
  const stats = useReconcileStore((s) => s.stats)

  const cards = [
    {
      label: '已确认课时',
      value: stats ? `${Math.round(stats.confirmed)} 条` : '—',
      sub: '已人工确认的排程',
      icon: CalendarCheck,
      tone: 'success',
    },
    {
      label: '待确认排程',
      value: stats?.pending ?? '—',
      sub: '等待人工确认',
      icon: Clock,
      tone: 'brand',
    },
    {
      label: '正常汇总',
      value: stats?.total_normal_schedules ?? '—',
      sub: '不含异常隔离',
      icon: FileText,
      tone: 'neutral',
    },
    {
      label: '别名冲突',
      value: stats?.anomalies ?? '—',
      sub: '已隔离出正常汇总',
      icon: AlertCircle,
      tone: 'danger',
      pulse: (stats?.anomalies ?? 0) > 0,
    },
  ]

  const toneMap: Record<string, string> = {
    success: 'text-success-600 bg-success-50',
    brand: 'text-brand-600 bg-brand-50',
    neutral: 'text-warm-600 bg-warm-100',
    danger: 'text-danger-600 bg-danger-50',
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className={`card animate-fade-up ${card.pulse ? 'ring-2 ring-danger-200 animate-pulse-soft' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-warm-500">{card.label}</p>
                <p className="text-2xl font-bold text-warm-800 mt-1">
                  {card.value}
                </p>
                <p className="text-xs text-warm-400 mt-1">{card.sub}</p>
              </div>
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${toneMap[card.tone]}`}
              >
                <Icon size={20} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
