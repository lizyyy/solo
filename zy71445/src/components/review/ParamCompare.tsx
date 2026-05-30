import { useStore } from "@/store/useStore"
import type { AuditLog } from "@/types"

interface Props {
  log: AuditLog | null
}

export default function ParamCompare({ log }: Props) {
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
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("zh-CN")
  }

  if (!log) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-6xl mb-4 opacity-10">↔</div>
          <p className="text-sm">点击左侧时间线中的修正记录</p>
          <p className="text-xs text-gray-600 mt-1">查看修正前后的参数对比</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-bold">{getElementName(log.elementType, log.elementId)}</h3>
          <span className="text-xs text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">
            {getElementTypeLabel(log.elementType)}
          </span>
        </div>
        <div className="text-xs text-gray-400">
          <span className="text-gray-500">{formatTime(log.timestamp)}</span>
          <span className="mx-2">·</span>
          <span>{log.operator}</span>
        </div>
        <div className="mt-2 text-sm text-gray-300">
          字段：<span className="text-white font-mono">{log.field}</span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-sm font-bold text-gray-300">修正前</span>
            <span className="text-xs text-gray-500">（旧值）</span>
          </div>
          <div className="h-full bg-red-900/20 border border-red-800 rounded p-4">
            <pre className="text-red-400 font-mono text-sm whitespace-pre-wrap break-words line-through opacity-70">
              {formatValue(log.oldValue)}
            </pre>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm font-bold text-gray-300">修正后</span>
            <span className="text-xs text-gray-500">（新值）</span>
          </div>
          <div className="h-full bg-green-900/20 border border-green-800 rounded p-4">
            <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap break-words">
              {formatValue(log.newValue)}
            </pre>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold text-gray-300">修正理由</span>
        </div>
        <div className="bg-gray-800 rounded p-4">
          <blockquote className="text-gray-300 italic">
            &ldquo;{log.reason}&rdquo;
          </blockquote>
        </div>
      </div>
    </div>
  )
}
