import { useStore } from '../store'

export default function AdjacencyDiagram() {
  const { rooms, noiseRisks } = useStore()

  const floor1 = rooms.filter((r) => r.floor === 1)
  const floor2 = rooms.filter((r) => r.floor === 2)

  const highRiskPairs = new Set<string>()
  const mediumRiskPairs = new Set<string>()
  for (const risk of noiseRisks) {
    const key = [risk.roomA, risk.roomB].sort().join('|')
    if (risk.combinedRisk === 'high') highRiskPairs.add(key)
    else if (risk.combinedRisk === 'medium') mediumRiskPairs.add(key)
  }

  const getEdgeColor = (roomA: string, roomB: string) => {
    const key = [roomA, roomB].sort().join('|')
    if (highRiskPairs.has(key)) return 'bg-red-500'
    if (mediumRiskPairs.has(key)) return 'bg-orange-500'
    return 'bg-brand-500'
  }

  const renderFloor = (floorRooms: typeof rooms, label: string) => (
    <div className="mb-4">
      <p className="text-xs text-brand-400 mb-2">{label}</p>
      <div className="flex flex-wrap gap-3">
        {floorRooms.map((room) => {
          const isHighRisk = noiseRisks.some((r) => (r.roomA === room.name || r.roomB === room.name) && r.combinedRisk === 'high')
          const isMediumRisk = noiseRisks.some((r) => (r.roomA === room.name || r.roomB === room.name) && r.combinedRisk === 'medium')
          const borderCls = isHighRisk ? 'border-red-500/60' : isMediumRisk ? 'border-orange-500/60' : 'border-brand-600'
          const bgCls = isHighRisk ? 'bg-red-500/10' : isMediumRisk ? 'bg-orange-500/10' : 'bg-brand-800'

          return (
            <div key={room.name} className={`${bgCls} border ${borderCls} rounded-lg px-4 py-3 text-center min-w-[80px]`}>
              <p className="text-sm font-medium text-brand-100">{room.name}</p>
              <p className="text-xs text-brand-400 mono mt-0.5">N{room.baseNoiseLevel}</p>
            </div>
          )
        })}
      </div>
      {floorRooms.length > 1 && (
        <div className="flex gap-3 mt-1">
          {floorRooms.slice(0, -1).map((room, i) => {
            const next = floorRooms[i + 1]
            if (!room.adjacentRooms.includes(next.name)) return <div key={room.name} className="min-w-[80px] px-4" />
            return (
              <div key={room.name} className="flex items-center min-w-[80px] px-4">
                <div className={`h-0.5 flex-1 ${getEdgeColor(room.name, next.name)}`} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div className="bg-brand-800 rounded-lg p-4 border border-brand-700">
      <h4 className="text-sm font-medium text-brand-200 mb-3">邻接关系图</h4>
      {renderFloor(floor2, '2楼')}
      <div className="border-l-2 border-brand-600 border-dashed h-6 ml-10 mb-1" />
      {renderFloor(floor1, '1楼')}
      <div className="flex items-center gap-4 mt-4 text-xs text-brand-400">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block" /> 高风险连接</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-500 inline-block" /> 中风险连接</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-brand-500 inline-block" /> 普通邻接</span>
      </div>
    </div>
  )
}
