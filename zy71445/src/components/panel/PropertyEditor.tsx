import { useState, useEffect } from "react"
import { useStore } from "@/store/useStore"
import SourceLink from "./SourceLink"
import type { Vector3 } from "@/types"

export default function PropertyEditor() {
  const selectedElement = useStore((s) => s.selectedElement)
  const scene = useStore((s) => s.scene)
  const updateFixturePosition = useStore((s) => s.updateFixturePosition)
  const updateFixtureTarget = useStore((s) => s.updateFixtureTarget)
  const updateLightBarPosition = useStore((s) => s.updateLightBarPosition)
  const updateHangingPointPosition = useStore((s) => s.updateHangingPointPosition)
  const updateHangingPointLoadCapacity = useStore((s) => s.updateHangingPointLoadCapacity)
  const addAuditLog = useStore((s) => s.addAuditLog)

  const [editReason, setEditReason] = useState("")
  const [showReasonInput, setShowReasonInput] = useState(false)
  const [pendingUpdate, setPendingUpdate] = useState<() => void>(() => {})

  const getElementTypeLabel = (type: string) => {
    switch (type) {
      case "fixture": return "灯具"
      case "lightBar": return "灯杆"
      case "hangingPoint": return "吊点"
      case "actorRoute": return "演员动线"
      default: return type
    }
  }

  const getFixtureTypeName = (type: string) => {
    switch (type) {
      case "spotlight": return "聚光灯"
      case "fresnel": return "柔光灯"
      case "led_par": return "LED帕灯"
      case "moving_head": return "追光灯"
      default: return type
    }
  }

  if (!selectedElement) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p className="text-sm">点击 3D 场景中的元素以查看属性</p>
      </div>
    )
  }

  const handlePositionChange = (
    axis: "x" | "y" | "z",
    value: number,
    currentPos: Vector3,
    updater: (id: string, pos: Vector3) => void,
    elementId: string,
    fieldName: string,
  ) => {
    const newPos = { ...currentPos, [axis]: value }
    setPendingUpdate(() => () => {
      updater(elementId, newPos)
      addAuditLog({
        operator: "当前用户",
        elementType: selectedElement.type,
        elementId,
        field: fieldName,
        oldValue: currentPos,
        newValue: newPos,
        reason: editReason || "调整位置",
      })
      setEditReason("")
      setShowReasonInput(false)
    })
    setShowReasonInput(true)
  }

  const handleLoadCapacityChange = (id: string, newValue: number, oldValue: number) => {
    setPendingUpdate(() => () => {
      updateHangingPointLoadCapacity(id, newValue, editReason || "调整承重")
      setEditReason("")
      setShowReasonInput(false)
    })
    setShowReasonInput(true)
  }

  const handleConfirmUpdate = () => {
    pendingUpdate()
  }

  const handleCancelUpdate = () => {
    setShowReasonInput(false)
    setEditReason("")
  }

  if (selectedElement.type === "fixture") {
    const fixture = scene.fixtures.find((f) => f.id === selectedElement.id)
    if (!fixture) return null

    return (
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-white text-sm">{fixture.name}</h3>
            <p className="text-xs text-gray-400">{getFixtureTypeName(fixture.type)}</p>
          </div>
          <SourceLink sourceRef={fixture.sourceRef} />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">位置</label>
          <div className="grid grid-cols-3 gap-2">
            {(["x", "y", "z"] as const).map((axis) => (
              <div key={axis} className="space-y-1">
                <span className="text-xs text-gray-500 uppercase">{axis}</span>
                <input
                  type="number"
                  step="0.1"
                  value={fixture.position[axis].toFixed(1)}
                  onChange={(e) =>
                    handlePositionChange(
                      axis,
                      parseFloat(e.target.value),
                      fixture.position,
                      updateFixturePosition,
                      fixture.id,
                      "position",
                    )
                  }
                  className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm font-mono"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">投射目标</label>
          <div className="grid grid-cols-3 gap-2">
            {(["x", "y", "z"] as const).map((axis) => (
              <div key={axis} className="space-y-1">
                <span className="text-xs text-gray-500 uppercase">{axis}</span>
                <input
                  type="number"
                  step="0.1"
                  value={fixture.targetPosition[axis].toFixed(1)}
                  onChange={(e) =>
                    handlePositionChange(
                      axis,
                      parseFloat(e.target.value),
                      fixture.targetPosition,
                      (id, pos) => updateFixtureTarget(id, pos),
                      fixture.id,
                      "targetPosition",
                    )
                  }
                  className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm font-mono"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-400 text-xs">光束角度</span>
            <p className="text-white font-mono">{fixture.beamAngle}°</p>
          </div>
          <div>
            <span className="text-gray-400 text-xs">重量</span>
            <p className="text-white font-mono">{fixture.weight}kg</p>
          </div>
          <div>
            <span className="text-gray-400 text-xs">挂载于</span>
            <p className="text-white">{fixture.attachedTo}</p>
          </div>
        </div>

        {showReasonInput && (
          <div className="p-3 bg-gray-700 rounded space-y-2 mt-4">
            <label className="text-xs text-gray-300">修正理由（必填，用于月底复盘）</label>
            <textarea
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="请输入调整理由..."
              className="w-full bg-gray-800 text-white px-2 py-1 rounded text-sm h-16"
            />
            <div className="flex gap-2">
              <button
                onClick={handleConfirmUpdate}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white py-1.5 rounded text-sm transition-colors"
              >
                确认修正
              </button>
              <button
                onClick={handleCancelUpdate}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-1.5 rounded text-sm transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (selectedElement.type === "lightBar") {
    const bar = scene.lightBars.find((lb) => lb.id === selectedElement.id)
    if (!bar) return null

    return (
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-white text-sm">{bar.name}</h3>
            <p className="text-xs text-gray-400">{getElementTypeLabel(selectedElement.type)}</p>
          </div>
          <SourceLink sourceRef={bar.sourceRef} />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">位置</label>
          <div className="grid grid-cols-3 gap-2">
            {(["x", "y", "z"] as const).map((axis) => (
              <div key={axis} className="space-y-1">
                <span className="text-xs text-gray-500 uppercase">{axis}</span>
                <input
                  type="number"
                  step="0.1"
                  value={bar.position[axis].toFixed(1)}
                  onChange={(e) =>
                    handlePositionChange(
                      axis,
                      parseFloat(e.target.value),
                      bar.position,
                      updateLightBarPosition,
                      bar.id,
                      "position",
                    )
                  }
                  className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm font-mono"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="text-sm">
          <span className="text-gray-400 text-xs">长度</span>
          <p className="text-white font-mono">{bar.length}m</p>
        </div>

        <div className="text-sm">
          <span className="text-gray-400 text-xs">挂载灯具数量</span>
          <p className="text-white font-mono">
            {scene.fixtures.filter((f) => f.attachedTo === bar.id).length} 台
          </p>
        </div>

        {showReasonInput && (
          <div className="p-3 bg-gray-700 rounded space-y-2 mt-4">
            <label className="text-xs text-gray-300">修正理由（必填，用于月底复盘）</label>
            <textarea
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="请输入调整理由..."
              className="w-full bg-gray-800 text-white px-2 py-1 rounded text-sm h-16"
            />
            <div className="flex gap-2">
              <button
                onClick={handleConfirmUpdate}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white py-1.5 rounded text-sm transition-colors"
              >
                确认修正
              </button>
              <button
                onClick={handleCancelUpdate}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-1.5 rounded text-sm transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (selectedElement.type === "hangingPoint") {
    const hp = scene.hangingPoints.find((h) => h.id === selectedElement.id)
    if (!hp) return null

    const loadRatio = hp.currentLoad / hp.loadCapacity
    const loadColor = loadRatio > 1 ? "text-red-400" : loadRatio > 0.8 ? "text-yellow-400" : "text-green-400"

    return (
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-white text-sm">{hp.name}</h3>
            <p className="text-xs text-gray-400">{getElementTypeLabel(selectedElement.type)}</p>
          </div>
          <SourceLink sourceRef={hp.sourceRef} />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">位置</label>
          <div className="grid grid-cols-3 gap-2">
            {(["x", "y", "z"] as const).map((axis) => (
              <div key={axis} className="space-y-1">
                <span className="text-xs text-gray-500 uppercase">{axis}</span>
                <input
                  type="number"
                  step="0.1"
                  value={hp.position[axis].toFixed(1)}
                  onChange={(e) =>
                    handlePositionChange(
                      axis,
                      parseFloat(e.target.value),
                      hp.position,
                      updateHangingPointPosition,
                      hp.id,
                      "position",
                    )
                  }
                  className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm font-mono"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs text-gray-400">额定承重</label>
            <span className="text-xs text-gray-500">kg</span>
          </div>
          <input
            type="number"
            step="5"
            value={hp.loadCapacity}
            onChange={(e) =>
              handleLoadCapacityChange(hp.id, parseFloat(e.target.value), hp.loadCapacity)
            }
            className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm font-mono"
          />
        </div>

        <div className="p-2 bg-gray-800 rounded space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">当前负载</span>
            <span className={`font-mono font-bold ${loadColor}`}>
              {hp.currentLoad} / {hp.loadCapacity} kg
            </span>
          </div>
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${loadRatio > 1 ? "bg-red-500" : loadRatio > 0.8 ? "bg-yellow-500" : "bg-green-500"}`}
              style={{ width: `${Math.min(loadRatio * 100, 100)}%` }}
            />
          </div>
          <div className="text-right text-xs">
            <span className={loadColor}>{(loadRatio * 100).toFixed(1)}%</span>
          </div>
        </div>

        {showReasonInput && (
          <div className="p-3 bg-gray-700 rounded space-y-2 mt-4">
            <label className="text-xs text-gray-300">修正理由（必填，用于月底复盘）</label>
            <textarea
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="请输入调整理由..."
              className="w-full bg-gray-800 text-white px-2 py-1 rounded text-sm h-16"
            />
            <div className="flex gap-2">
              <button
                onClick={handleConfirmUpdate}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white py-1.5 rounded text-sm transition-colors"
              >
                确认修正
              </button>
              <button
                onClick={handleCancelUpdate}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-1.5 rounded text-sm transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (selectedElement.type === "actorRoute") {
    const route = scene.actorRoutes.find((ar) => ar.id === selectedElement.id)
    if (!route) return null

    return (
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-white text-sm">{route.name}</h3>
            <p className="text-xs text-gray-400">{route.scene}</p>
          </div>
          <SourceLink sourceRef={route.sourceRef} />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">演员身高</label>
          <p className="text-white font-mono">{route.actorHeight}m</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs text-gray-400">路径点</label>
            <span className="text-xs text-gray-500">{route.waypoints.length} 个</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {route.waypoints.map((wp, i) => (
              <div key={i} className="flex gap-2 text-xs font-mono bg-gray-800 px-2 py-1 rounded">
                <span className="text-gray-500">#{i + 1}</span>
                <span className="text-gray-300">
                  ({wp.x.toFixed(1)}, {wp.y.toFixed(1)}, {wp.z.toFixed(1)})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return null
}
