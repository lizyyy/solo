import { Clock, User, ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import { useStore } from "@/store/useStore"

export default function AuditLogPanel() {
  const auditLogs = useStore((s) => s.scene.auditLogs)
  const fixtures = useStore((s) => s.scene.fixtures)
  const lightBars = useStore((s) => s.scene.lightBars)
  const hangingPoints = useStore((s) => s.scene.hangingPoints)
  const actorRoutes = useStore((s) => s.scene.actorRoutes)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

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

  const formatValue = (value: unknown): string => {
    if (value == null) return "空"
    if (typeof value === "number") return value.toString()
    if (typeof value === "string") return value
    if (Array.isArray(value)) {
      return `[${value.map((v) => formatValue(v)).join(", ")}]`
    }
    if (typeof value === "object") {
      const v = value as { x?: number; y?: number; z?: number }
      if ("x" in v && "y" in v && "z" in v) {
        return `(${v.x?.toFixed(1)}, ${v.y?.toFixed(1)}, ${v.z?.toFixed(1)})`
      }
      return JSON.stringify(value)
    }
    return String(value)
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (auditLogs.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Clock size={48} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">暂无修正记录</p>
        <p className="text-xs text-gray-600 mt-1">人工修正参数后将在此处显示</p>
      </div>
    )
  }

  const sortedLogs = [...auditLogs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )

  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
      {sortedLogs.map((log) => {
        const isExpanded = expandedIds.has(log.id)
        return (
          <div
            key={log.id}
            className="border border-gray-700 rounded overflow-hidden"
          >
            <button
              onClick={() => toggleExpand(log.id)}
              className="w-full flex items-center gap-2 p-2 text-left hover:bg-gray-800 transition-colors"
            >
              <div className="text-gray-500">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Clock size={10} />
                    {formatTime(log.timestamp)}
                  </span>
                  <span className="text-gray-500">|</span>
                  <span className="text-gray-400 flex items-center gap-1">
                    <User size={10} />
                    {log.operator}
                  </span>
                </div>
                <div className="text-sm text-gray-200 truncate mt-0.5">
                  <span className="text-blue-400">{getElementTypeLabel(log.elementType)}</span>
                  <span className="text-gray-500 mx-1">·</span>
                  <span className="text-white">{getElementName(log.elementType, log.elementId)}</span>
                  <span className="text-gray-500 mx-1">·</span>
                  <span className="text-gray-300">{log.field}</span>
                </div>
              </div>
            </button>

            {isExpanded && (
              <div className="p-3 pt-0 space-y-2 border-t border-gray-700">
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="p-2 bg-red-900/30 rounded">
                    <div className="text-xs text-gray-400 mb-1">旧值</div>
                    <div className="text-sm text-red-400 font-mono line-through">
                      {formatValue(log.oldValue)}
                    </div>
                  </div>
                  <div className="p-2 bg-green-900/30 rounded">
                    <div className="text-xs text-gray-400 mb-1">新值</div>
                    <div className="text-sm text-green-400 font-mono">
                      {formatValue(log.newValue)}
                    </div>
                  </div>
                </div>

                <div className="p-2 bg-gray-800 rounded">
                  <div className="text-xs text-gray-400 mb-1">修正理由</div>
                  <div className="text-sm text-gray-300 italic">"{log.reason}"</div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
