import { useCubeStore } from '@/store/useCubeStore'
import { ChevronDown, Eye, EyeOff, SlidersHorizontal } from 'lucide-react'
import { regions } from '@/data/mockData'

export default function ParameterPanel() {
  const parameters = useCubeStore(s => s.parameters)
  const typhoonEvents = useCubeStore(s => s.typhoonEvents)
  const setParameters = useCubeStore(s => s.setParameters)

  const currentTyphoon = typhoonEvents.find(e => e.id === parameters.typhoonId)
  const timeStart = new Date(parameters.timeRange[0])
  const timeEnd = new Date(parameters.timeRange[1])

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('zh-CN')

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[#00D4FF]">
        <SlidersHorizontal size={16} />
        <span className="text-sm font-semibold tracking-wide">参数控制</span>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs text-[#7B8CA8] mb-1 block">台风事件</span>
          <div className="relative">
            <select
              value={parameters.typhoonId}
              onChange={e => {
                const ty = typhoonEvents.find(t => t.id === e.target.value)
                if (ty) {
                  setParameters({
                    typhoonId: ty.id,
                    timeRange: [
                      new Date(ty.startDate).getTime(),
                      new Date(ty.endDate).getTime(),
                    ],
                  })
                }
              }}
              className="w-full bg-[#0D1B2E] border border-[#1B3054] text-[#E0E8F0] text-xs rounded px-3 py-2 appearance-none focus:border-[#00D4FF] focus:outline-none transition-colors"
            >
              {typhoonEvents.map(ty => (
                <option key={ty.id} value={ty.id}>
                  {ty.name} ({ty.category})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-2.5 text-[#5A6E8A] pointer-events-none" />
          </div>
        </label>

        <label className="block">
          <span className="text-xs text-[#7B8CA8] mb-1 block">
            时间范围: {formatDate(parameters.timeRange[0])} — {formatDate(parameters.timeRange[1])}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={0}
            onChange={e => {
              const span = parameters.timeRange[1] - parameters.timeRange[0]
              const offset = Number(e.target.value) / 100 * span * 0.5
              setParameters({
                timeRange: [
                  parameters.timeRange[0] + offset,
                  parameters.timeRange[1],
                ],
              })
            }}
            className="w-full h-1 bg-[#1B3054] rounded-lg appearance-none cursor-pointer accent-[#00D4FF]"
          />
        </label>

        <label className="block">
          <span className="text-xs text-[#7B8CA8] mb-1 block">
            赔付阈值: ¥{(parameters.claimThreshold / 10000).toFixed(0)}万
          </span>
          <input
            type="range"
            min={0}
            max={5000000}
            step={100000}
            value={parameters.claimThreshold}
            onChange={e => setParameters({ claimThreshold: Number(e.target.value) })}
            className="w-full h-1 bg-[#1B3054] rounded-lg appearance-none cursor-pointer accent-[#00D4FF]"
          />
        </label>

        <div className="space-y-1.5">
          <span className="text-xs text-[#7B8CA8] block">地区筛选</span>
          <div className="grid grid-cols-2 gap-1">
            {regions.map(r => {
              const selected = parameters.regionIds.includes(r.id)
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    const newIds = selected
                      ? parameters.regionIds.filter(id => id !== r.id)
                      : [...parameters.regionIds, r.id]
                    if (newIds.length > 0) setParameters({ regionIds: newIds })
                  }}
                  className={`text-xs px-2 py-1 rounded transition-all ${
                    selected
                      ? 'bg-[#00D4FF]/15 text-[#00D4FF] border border-[#00D4FF]/40'
                      : 'bg-[#0D1B2E] text-[#5A6E8A] border border-[#1B3054] hover:border-[#2A4060]'
                  }`}
                >
                  {r.name}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-[#1B3054] pt-3 space-y-2">
        <span className="text-xs text-[#7B8CA8] block">显示图层</span>
        {[
          { key: 'showTyphoonPath' as const, label: '台风路径', color: '#00D4FF' },
          { key: 'showPolicyDistribution' as const, label: '保单分布', color: '#00E676' },
          { key: 'showClaims' as const, label: '赔付标记', color: '#FF6B35' },
        ].map(layer => (
          <button
            key={layer.key}
            onClick={() => setParameters({ [layer.key]: !parameters[layer.key] })}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded bg-[#0D1B2E] border border-[#1B3054] hover:border-[#2A4060] transition-all text-xs"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: layer.color }} />
              <span className={parameters[layer.key] ? 'text-[#E0E8F0]' : 'text-[#5A6E8A]'}>
                {layer.label}
              </span>
            </span>
            {parameters[layer.key] ? (
              <Eye size={14} className="text-[#00D4FF]" />
            ) : (
              <EyeOff size={14} className="text-[#3A4A60]" />
            )}
          </button>
        ))}
      </div>

      {currentTyphoon && (
        <div className="bg-[#0A1422] rounded p-3 border border-[#1B3054]">
          <div className="text-[10px] text-[#5A6E8A] mb-1">当前台风</div>
          <div className="text-sm text-[#E0E8F0] font-semibold">{currentTyphoon.name}</div>
          <div className="text-[10px] text-[#7B8CA8] mt-1">
            {currentTyphoon.category} · {timeStart.toLocaleDateString('zh-CN')} — {timeEnd.toLocaleDateString('zh-CN')}
          </div>
        </div>
      )}
    </div>
  )
}
