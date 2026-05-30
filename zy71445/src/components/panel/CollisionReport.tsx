import { useState } from "react"
import { AlertTriangle, AlertCircle, CheckCircle, Eye, Lightbulb, Weight, Users } from "lucide-react"
import { useStore } from "@/store/useStore"
import type { Collision } from "@/types"

export default function CollisionReport() {
  const collisions = useStore((s) => s.scene.collisions)
  const setHoveredCollision = useStore((s) => s.setHoveredCollision)
  const setSelectedElement = useStore((s) => s.setSelectedElement)
  const resolveCollision = useStore((s) => s.resolveCollision)
  const fixtures = useStore((s) => s.scene.fixtures)
  const lightBars = useStore((s) => s.scene.lightBars)
  const hangingPoints = useStore((s) => s.scene.hangingPoints)
  const actorRoutes = useStore((s) => s.scene.actorRoutes)

  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [resolutionText, setResolutionText] = useState("")

  const sortedCollisions = [...collisions].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1
    const severityOrder = { critical: 0, warning: 1 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "view_obstruction": return <Lightbulb size={14} />
      case "overload": return <Weight size={14} />
      case "route_collision": return <Users size={14} />
      default: return <AlertCircle size={14} />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "view_obstruction": return "灯具穿帮"
      case "overload": return "吊点超载"
      case "route_collision": return "路线碰撞"
      default: return type
    }
  }

  const getElementName = (id: string) => {
    const fixture = fixtures.find((f) => f.id === id)
    if (fixture) return fixture.name
    const bar = lightBars.find((lb) => lb.id === id)
    if (bar) return bar.name
    const hp = hangingPoints.find((h) => h.id === id)
    if (hp) return hp.name
    const route = actorRoutes.find((ar) => ar.id === id)
    if (route) return route.name
    return id
  }

  const handleResolve = (collision: Collision) => {
    resolveCollision(collision.id, resolutionText)
    setResolvingId(null)
    setResolutionText("")
  }

  const handleFocusCollision = (collision: Collision) => {
    if (collision.involvedElements.length > 0) {
      const firstId = collision.involvedElements[0]
      if (collision.type === "overload") {
        setSelectedElement({ type: "hangingPoint", id: firstId })
      } else if (collision.type === "route_collision") {
        setSelectedElement({ type: "actorRoute", id: firstId })
      } else {
        setSelectedElement({ type: "fixture", id: firstId })
      }
    }
  }

  if (collisions.length === 0) {
    return (
      <div className="p-6 text-center text-green-400">
        <CheckCircle size={48} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">无碰撞检测结果</p>
        <p className="text-xs text-gray-500 mt-1">场景安全，可导出</p>
      </div>
    )
  }

  const unresolvedCount = collisions.filter((c) => !c.resolved).length
  const criticalCount = collisions.filter((c) => !c.resolved && c.severity === "critical").length
  const warningCount = collisions.filter((c) => !c.resolved && c.severity === "warning").length

  return (
    <div className="space-y-3">
      <div className="flex gap-2 p-2 bg-gray-800 rounded">
        <div className="flex-1 text-center">
          <div className="text-lg font-bold text-red-400">{unresolvedCount}</div>
          <div className="text-xs text-gray-400">待处理</div>
        </div>
        <div className="flex-1 text-center border-l border-r border-gray-700">
          <div className="text-lg font-bold text-red-500">{criticalCount}</div>
          <div className="text-xs text-gray-400">严重</div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-lg font-bold text-yellow-500">{warningCount}</div>
          <div className="text-xs text-gray-400">警告</div>
        </div>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {sortedCollisions.map((col) => (
          <div
            key={col.id}
            className={`p-3 rounded border transition-all ${
              col.resolved
                ? "bg-gray-800/50 border-gray-700 opacity-60"
                : col.severity === "critical"
                  ? "bg-red-900/20 border-red-800 hover:bg-red-900/30"
                  : "bg-yellow-900/20 border-yellow-800 hover:bg-yellow-900/30"
            }`}
            onMouseEnter={() => setHoveredCollision(col.id)}
            onMouseLeave={() => setHoveredCollision(null)}
          >
            <div className="flex items-start gap-2">
              <div className={`mt-0.5 ${
                col.resolved
                  ? "text-gray-500"
                  : col.severity === "critical"
                    ? "text-red-400"
                    : "text-yellow-400"
              }`}>
                {col.resolved ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                    col.resolved
                      ? "bg-gray-700 text-gray-400"
                      : col.severity === "critical"
                        ? "bg-red-800 text-red-200"
                        : "bg-yellow-800 text-yellow-200"
                  }`}>
                    {getTypeIcon(col.type)}
                    {getTypeLabel(col.type)}
                  </span>
                  <span className={`text-xs ${
                    col.resolved
                      ? "text-gray-500 line-through"
                      : col.severity === "critical"
                        ? "text-red-300"
                        : "text-yellow-300"
                  }`}>
                    {col.severity === "critical" ? "严重" : "警告"}
                  </span>
                </div>

                <p className={`text-sm leading-relaxed ${
                  col.resolved ? "text-gray-500" : "text-gray-200"
                }`}>
                  {col.description}
                </p>

                <div className="flex flex-wrap gap-1 mt-2">
                  {col.involvedElements.map((id) => (
                    <span
                      key={id}
                      className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono"
                    >
                      {getElementName(id)}
                    </span>
                  ))}
                </div>

                {col.resolution && (
                  <div className="mt-2 p-2 bg-green-900/20 rounded text-xs text-green-300">
                    处理: {col.resolution}
                  </div>
                )}

                {!col.resolved && resolvingId !== col.id && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleFocusCollision(col)}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                    >
                      <Eye size={12} />
                      聚焦
                    </button>
                    <button
                      onClick={() => {
                        setResolvingId(col.id)
                        setResolutionText("")
                      }}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-800 hover:bg-green-700 text-green-200 rounded transition-colors"
                    >
                      <CheckCircle size={12} />
                      标记已处理
                    </button>
                  </div>
                )}

                {resolvingId === col.id && (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="输入处理说明（用于月底复盘）"
                      className="w-full bg-gray-800 text-white px-2 py-1 rounded text-sm h-16"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolve(col)}
                        className="flex-1 text-xs px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded"
                      >
                        确认
                      </button>
                      <button
                        onClick={() => setResolvingId(null)}
                        className="flex-1 text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
