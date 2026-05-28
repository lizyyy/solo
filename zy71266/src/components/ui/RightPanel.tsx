import { useProjectStore } from '@/store'
import { colorTempToHex } from '@/utils/dataImporter'
import { X, Lightbulb, User, Box, Route, AlertTriangle } from 'lucide-react'
import type { Light, Actor, Prop, Trajectory } from '@/types'

export function RightPanel() {
  const {
    selectedElement,
    setSelectedElement,
    lights,
    actors,
    props,
    trajectories,
    occlusionResults,
    actorLightStatus,
  } = useProjectStore()

  if (!selectedElement) {
    return (
      <div className="w-80 bg-[#1a1a2e] border-l border-[#2c2c3e] flex flex-col h-full">
        <div className="p-4 flex items-center justify-between border-b border-[#2c2c3e]">
          <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            元素详情
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          点击场景中的元素查看详情
        </div>
      </div>
    )
  }

  const getSelectedLight = (): Light | undefined => {
    if (selectedElement.type === 'light') {
      return lights.find((l) => l.id === selectedElement.id)
    }
    return undefined
  }

  const getSelectedActor = (): Actor | undefined => {
    if (selectedElement.type === 'actor') {
      return actors.find((a) => a.id === selectedElement.id)
    }
    return undefined
  }

  const getSelectedProp = (): Prop | undefined => {
    if (selectedElement.type === 'prop') {
      return props.find((p) => p.id === selectedElement.id)
    }
    return undefined
  }

  const getSelectedTrajectory = (): Trajectory | undefined => {
    if (selectedElement.type === 'trajectory') {
      return trajectories.find((t) => t.id === selectedElement.id)
    }
    return undefined
  }

  const getElementIcon = () => {
    switch (selectedElement.type) {
      case 'light':
        return <Lightbulb className="w-5 h-5 text-amber-400" />
      case 'actor':
        return <User className="w-5 h-5 text-pink-400" />
      case 'prop':
        return <Box className="w-5 h-5 text-blue-400" />
      case 'trajectory':
        return <Route className="w-5 h-5 text-green-400" />
      default:
        return null
    }
  }

  const getElementTitle = () => {
    switch (selectedElement.type) {
      case 'light':
        return '灯光详情'
      case 'actor':
        return '演员详情'
      case 'prop':
        return '道具详情'
      case 'trajectory':
        return '轨迹详情'
      default:
        return '元素详情'
    }
  }

  const renderLightDetails = (light: Light) => {
    const isOccluded = occlusionResults.some((o) => o.lightId === light.id)
    const colorHex = colorTempToHex(light.colorTemp)

    return (
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-500">色温</label>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-6 h-6 rounded" style={{ backgroundColor: colorHex }} />
            <span className="text-white">{light.colorTemp}K</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500">强度</label>
            <div className="text-white">{light.intensity}</div>
          </div>
          <div>
            <label className="text-xs text-gray-500">角度</label>
            <div className="text-white">{light.angle}°</div>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500">位置</label>
          <div className="text-white text-sm">
            X: {light.positionX.toFixed(2)}, Y: {light.positionY.toFixed(2)}, Z: {light.positionZ.toFixed(2)}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500">目标</label>
          <div className="text-white text-sm">
            X: {light.targetX.toFixed(2)}, Y: {light.targetY.toFixed(2)}, Z: {light.targetZ.toFixed(2)}
          </div>
        </div>

        {isOccluded && (
          <div className="p-3 bg-red-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">灯光被遮挡</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              遮挡道具:{' '}
              {occlusionResults
                .filter((o) => o.lightId === light.id)
                .map((o) => props.find((p) => p.id === o.propId)?.name)
                .join(', ')}
            </div>
          </div>
        )}

        {light.sourceFile && (
          <div className="text-xs text-gray-500">
            来源: {light.sourceFile}
            {light.sourceLine && `: 第 ${light.sourceLine} 行`}
          </div>
        )}
      </div>
    )
  }

  const renderActorDetails = (actor: Actor) => {
    const status = actorLightStatus.find((s) => s.actorId === actor.id)

    return (
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-500">颜色</label>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: actor.color }} />
            <span className="text-white">{actor.color}</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500">身高</label>
          <div className="text-white">{actor.height}m</div>
        </div>

        <div className={`p-3 rounded-lg ${status?.inLightCone ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
          <div className={`flex items-center gap-2 ${status?.inLightCone ? 'text-green-400' : 'text-red-400'}`}>
            {status?.inLightCone ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-sm">在灯光范围内</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-sm">不在灯光范围内</span>
              </>
            )}
          </div>
          {status?.illuminatingLights && status.illuminatingLights.length > 0 && (
            <div className="text-xs text-gray-400 mt-1">
              照亮灯光:{' '}
              {status.illuminatingLights
                .map((id) => lights.find((l) => l.id === id)?.name)
                .join(', ')}
            </div>
          )}
        </div>

        {actor.sourceFile && (
          <div className="text-xs text-gray-500">
            来源: {actor.sourceFile}
            {actor.sourceLine && `: 第 ${actor.sourceLine} 行`}
          </div>
        )}
      </div>
    )
  }

  const renderPropDetails = (prop: Prop) => {
    const occludingLights = occlusionResults.filter((o) => o.propId === prop.id)

    return (
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-500">类型</label>
          <div className="text-white capitalize">{prop.type}</div>
        </div>

        <div>
          <label className="text-xs text-gray-500">遮挡物</label>
          <div className={`text-sm ${prop.occluder ? 'text-blue-400' : 'text-gray-400'}`}>
            {prop.occluder ? '是' : '否'}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500">位置</label>
          <div className="text-white text-sm">
            X: {prop.positionX.toFixed(2)}, Y: {prop.positionY.toFixed(2)}, Z: {prop.positionZ.toFixed(2)}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500">缩放</label>
          <div className="text-white text-sm">
            X: {prop.scaleX.toFixed(2)}, Y: {prop.scaleY.toFixed(2)}, Z: {prop.scaleZ.toFixed(2)}
          </div>
        </div>

        {occludingLights.length > 0 && (
          <div className="p-3 bg-amber-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">遮挡 {occludingLights.length} 束灯光</span>
            </div>
          </div>
        )}

        {prop.sourceFile && (
          <div className="text-xs text-gray-500">
            来源: {prop.sourceFile}
            {prop.sourceLine && `: 第 ${prop.sourceLine} 行`}
          </div>
        )}
      </div>
    )
  }

  const renderTrajectoryDetails = (trajectory: Trajectory) => {
    const relatedActor = actors.find((a) => a.id === trajectory.actorId)
    const waypoints = trajectory.waypoints || []
    const times = waypoints.map((w) => w.time)
    const duration = times.length > 0 ? Math.max(...times) - Math.min(...times) : 0

    return (
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-500">关联演员</label>
          <div className="text-white">{relatedActor?.name || trajectory.actorId || '未关联'}</div>
        </div>

        <div>
          <label className="text-xs text-gray-500">路径点数量</label>
          <div className="text-white">{waypoints.length}</div>
        </div>

        <div>
          <label className="text-xs text-gray-500">时长</label>
          <div className="text-white">{duration.toFixed(1)}s</div>
        </div>

        {trajectory.sourceFile && (
          <div className="text-xs text-gray-500">
            来源: {trajectory.sourceFile}
            {trajectory.sourceLine && `: 第 ${trajectory.sourceLine} 行`}
          </div>
        )}
      </div>
    )
  }

  const light = getSelectedLight()
  const actor = getSelectedActor()
  const prop = getSelectedProp()
  const trajectory = getSelectedTrajectory()

  const selectedData = light || actor || prop || trajectory

  if (!selectedData) return null

  return (
    <div className="w-80 bg-[#1a1a2e] border-l border-[#2c2c3e] flex flex-col h-full">
      <div className="p-4 flex items-center justify-between border-b border-[#2c2c3e]">
        <div className="flex items-center gap-2">
          {getElementIcon()}
          <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            {getElementTitle()}
          </h2>
        </div>
        <button
          onClick={() => setSelectedElement(null)}
          className="p-1 hover:bg-[#2c2c3e] rounded text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4">
        <h3 className="text-white font-medium mb-1">{selectedData.name}</h3>
        <p className="text-xs text-gray-500">ID: {selectedData.id.slice(0, 8)}...</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {light && renderLightDetails(light)}
        {actor && renderActorDetails(actor)}
        {prop && renderPropDetails(prop)}
        {trajectory && renderTrajectoryDetails(trajectory)}
      </div>
    </div>
  )
}
