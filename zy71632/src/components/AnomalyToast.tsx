import { useEffect, useState } from 'react'
import { AlertTriangle, X, Info, AlertCircle } from 'lucide-react'
import { useClassroomStore } from '@/store'
import { getAnomalySeverity } from '@/utils/anomaly'
import type { AnomalyEntry } from '@/types'

export default function AnomalyToast() {
  const { project } = useClassroomStore()
  const [visibleAnomalies, setVisibleAnomalies] = useState<AnomalyEntry[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const latest = project.anomalyLog.filter((a) => !dismissed.has(a.id))
    const recent = latest.filter(
      (a) => Date.now() - a.timestamp < 10000
    )
    setVisibleAnomalies(recent.slice(-3))
  }, [project.anomalyLog, dismissed])

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id))
  }

  if (visibleAnomalies.length === 0) return null

  const severityConfig = {
    info: { bg: 'bg-[#4fc3f7]/15', border: 'border-[#4fc3f7]/30', icon: Info, iconColor: 'text-[#4fc3f7]' },
    warning: { bg: 'bg-[#ff9800]/15', border: 'border-[#ff9800]/30', icon: AlertCircle, iconColor: 'text-[#ff9800]' },
    error: { bg: 'bg-[#ef5350]/15', border: 'border-[#ef5350]/30', icon: AlertTriangle, iconColor: 'text-[#ef5350]' },
  }

  return (
    <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {visibleAnomalies.map((anomaly) => {
        const severity = getAnomalySeverity(anomaly.type)
        const config = severityConfig[severity]
        const Icon = config.icon
        return (
          <div
            key={anomaly.id}
            className={`${config.bg} ${config.border} border backdrop-blur-md rounded-xl px-4 py-3 flex items-start gap-3 animate-in slide-in-from-right`}
          >
            <Icon size={16} className={`${config.iconColor} mt-0.5 shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className="text-white/90 text-xs font-medium">{anomaly.message}</p>
              <p className="text-white/50 text-[10px] mt-0.5">{anomaly.handlingNote}</p>
            </div>
            <button
              onClick={() => handleDismiss(anomaly.id)}
              className="text-white/30 hover:text-white/60 transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
