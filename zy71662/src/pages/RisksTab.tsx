import { useStore } from '@/store/useStore'
import { AlertTriangle, AlertOctagon, Check, X as XIcon } from 'lucide-react'
import { getSeverityColor, getSeverityBg, categoryLabel, severityLabel, statusLabel } from '@/lib/helpers'

export default function RisksTab() {
  const schemeDetail = useStore((s) => s.schemeDetail)
  const risks = useStore((s) => s.risks)
  const updateRiskStatus = useStore((s) => s.updateRiskStatus)

  if (!schemeDetail) return null
  const sid = schemeDetail.scheme.id

  const icon = (sev: string) => {
    if (sev === 'critical') return <AlertOctagon size={18} className="text-red-400" />
    if (sev === 'warning') return <AlertTriangle size={18} className="text-amber-400" />
    return <AlertTriangle size={18} className="text-blue-400" />
  }

  return (
    <div className="space-y-2">
      {risks.length === 0 && <p className="text-zinc-500 text-sm text-center py-8">暂无风险项</p>}
      {risks.map((r) => {
        const isCritical = r.severity === 'critical' && r.status === 'pending'
        return (
          <div key={r.id}
            className={`flex items-start gap-3 rounded-lg border p-4 ${
              isCritical ? 'border-red-500/60 animate-pulse' : 'border-zinc-700'
            } ${getSeverityBg(r.severity)}`}>
            <div className="mt-0.5">{icon(r.severity)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-1.5 py-0.5 rounded ${getSeverityColor(r.severity)} ${getSeverityBg(r.severity)}`}>
                  {severityLabel(r.severity)}
                </span>
                <span className="text-xs text-zinc-400">{categoryLabel(r.category)}</span>
              </div>
              <p className="text-sm text-zinc-200">{r.message}</p>
              {r.pointId && (
                <p className="text-xs text-zinc-500 mt-1">吊点: {schemeDetail.points.find((p) => p.id === r.pointId)?.label ?? r.pointId}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-zinc-400 mr-2">{statusLabel(r.status)}</span>
              {r.status === 'pending' && (
                <>
                  <button onClick={() => updateRiskStatus(sid, r.id, 'resolved')}
                    className="p-1 rounded hover:bg-green-500/20 text-green-400" title="标记已解决">
                    <Check size={14} />
                  </button>
                  <button onClick={() => updateRiskStatus(sid, r.id, 'dismissed')}
                    className="p-1 rounded hover:bg-zinc-600/40 text-zinc-400" title="忽略">
                    <XIcon size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
