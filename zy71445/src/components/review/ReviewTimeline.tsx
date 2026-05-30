import { Clock, ArrowRight, Circle } from "lucide-react"
import { useStore } from "@/store/useStore"
import type { AuditLog } from "@/types"

interface Props {
  logs: AuditLog[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function ReviewTimeline({ logs, selectedId, onSelect }: Props) {
  const fixtures = useStore((s) => s.scene.fixtures)
  const lightBars = useStore((s) => s.scene.lightBars)
  const hangingPoints = useStore((s) => s.scene.hangingPoints)
  const actorRoutes = useStore((s) => s.scene.actorRoutes)

  const getElementName = (type: string, id: string) => {
    switch (type) {
      case "fixture":
        return fixtures.find((f) => f.id === id)?.name || id
      case "lightBar":
        return lightBars.find((lb) => lb.id === id)?.name || id
      case "hangingPoint":
        return hangingPoints.find((hp) => hp.id === id)?.name || id
      case "actorRoute":
        return actorRoutes.find((ar) => ar.id === id)?.name || id
      default:
        return id
    }
  }

  const getElementTypeLabel = (type: string) => {
    switch (type) {
      case "fixture": return "灯具"
      case "lightBar": return "灯杆"
      case "hangingPoint": return "吊点"
      case "actorRoute": return "演员动线"
      default: return type
    }
  }

  const groupedByDate = logs.reduce((acc, log) => {
    const date = new Date(log.timestamp).toLocaleDateString("zh-CN")
    if (!acc[date]) acc[date] = []
    acc[date].push(log)
    return acc
  }, {} as Record<string, AuditLog[]>)

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-700" />

      {Object.entries(groupedByDate).map(([date, dateLogs]) => (
        <div key={date} className="mb-6">
          <div className="absolute -left-6 mt-1">
            <div className="w-4 h-4 bg-red-600 rounded-full border-2 border-[#1a1a2e]" />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-gray-400" />
            <span className="text-sm font-bold text-white">{date}</span>
            <span className="text-xs text-gray-500">
              {dateLogs.length} 条修正记录
            </span>
          </div>

          <div className="space-y-2 pl-4">
            {dateLogs.map((log) => (
              <button
                key={log.id}
                onClick={() => onSelect(log.id)}
                className={`w-full text-left p-3 rounded border transition-all ${
                  selectedId === log.id
                    ? "bg-red-900/30 border-red-700"
                    : "bg-gray-800/50 border-gray-700 hover:bg-gray-800"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      selectedId === log.id ? "bg-red-500" : "bg-gray-600"
                    }`} />
                    <span className="text-xs text-gray-400">{formatTime(log.timestamp)}</span>
                    <span className="text-xs text-blue-400">{getElementTypeLabel(log.elementType)}</span>
                  </div>
                  <span className="text-xs text-gray-500">{log.operator}</span>
                </div>
                <div className="text-sm text-white">{getElementName(log.elementType, log.elementId)}</div>
                <div className="text-xs text-gray-400 mt-1">{log.field}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
