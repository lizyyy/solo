import { useStore } from '@/store/useStore'
import { ALERT_CONFIG } from '@/utils/scenarioDetect'
import { X } from 'lucide-react'

export default function AlertToast() {
  const alerts = useStore(s => s.alerts)
  const clearAll = useStore(s => s.clearAlerts)

  if (alerts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      <div className="flex justify-end mb-1">
        <button
          onClick={clearAll}
          className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
        >
          <X size={12} /> 全部清除
        </button>
      </div>
      {alerts.map((alert, idx) => {
        const cfg = ALERT_CONFIG[alert.type]
        const time = new Date(alert.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        return (
          <div
            key={alert.id}
            className="glass-panel rounded-lg p-3 animate-slide-up border-l-4"
            style={{
              borderLeftColor: cfg.color,
              backgroundColor: cfg.bgColor,
              animationDelay: `${idx * 80}ms`
            }}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg" style={{ color: cfg.color }}>{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm" style={{ color: cfg.color }}>{cfg.label}</span>
                  <span className="text-xs text-slate-500 font-mono">{time}</span>
                </div>
                <p className="text-xs text-slate-300 mt-1">{alert.details}</p>
                <p className="text-xs text-slate-400 mt-1 italic">💡 {alert.suggestion}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
