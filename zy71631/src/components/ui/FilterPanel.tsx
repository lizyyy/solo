import { ChevronDown, ChevronRight, AlertTriangle, Waves, Clock } from 'lucide-react'
import type { AnomalyType } from '@/types'
import useFilterStore from '@/stores/filterStore'
import useDataStore from '@/stores/dataStore'

const ANOMALY_TYPE_CONFIG: Record<AnomalyType, { label: string; icon: typeof AlertTriangle; color: string }> = {
  frequency_mismatch: { label: '频段不匹配', icon: Waves, color: 'text-theater-orange' },
  seat_occlusion: { label: '座位遮挡', icon: AlertTriangle, color: 'text-theater-red' },
  delay_inversion: { label: '延时反向', icon: Clock, color: 'text-theater-purple' },
}

export default function FilterPanel() {
  const panelOpen = useFilterStore((state) => state.panelOpen)
  const togglePanel = useFilterStore((state) => state.togglePanel)
  const selectedZoneIds = useFilterStore((state) => state.selectedZoneIds)
  const toggleZone = useFilterStore((state) => state.toggleZone)
  const selectedAnomalyTypes = useFilterStore((state) => state.selectedAnomalyTypes)
  const setAnomalyTypes = useFilterStore((state) => state.setAnomalyTypes)
  const splRange = useFilterStore((state) => state.splRange)
  const setSplRange = useFilterStore((state) => state.setSplRange)

  const zones = useDataStore((state) => state.zones)

  const handleAnomalyTypeToggle = (type: AnomalyType) => {
    if (selectedAnomalyTypes.includes(type)) {
      setAnomalyTypes(selectedAnomalyTypes.filter((t) => t !== type))
    } else {
      setAnomalyTypes([...selectedAnomalyTypes, type])
    }
  }

  if (!panelOpen) {
    return (
      <button
        onClick={togglePanel}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 glass-panel rounded-r-lg p-2 hover:bg-theater-accent/20 transition-colors"
      >
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </button>
    )
  }

  return (
    <div className="w-[240px] h-full glass-panel border-r border-theater-border flex flex-col relative">
      <button
        onClick={togglePanel}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full z-20 glass-panel rounded-r-lg p-1.5 hover:bg-theater-accent/20 transition-colors"
      >
        <ChevronDown className="w-4 h-4 text-gray-400 rotate-90" />
      </button>

      <div className="p-4 space-y-4 overflow-y-auto">
        <details open className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none font-display text-sm text-gray-300 hover:text-white transition-colors">
            <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-0 -rotate-90 transition-transform" />
            观众区
          </summary>
          <div className="mt-3 space-y-2 pl-6">
            {zones.map((zone) => (
              <label key={zone.id} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedZoneIds.includes(zone.id)}
                  onChange={() => toggleZone(zone.id)}
                  className="sr-only"
                />
                <div
                  className="w-3 h-3 rounded-sm border border-theater-border transition-all"
                  style={{ backgroundColor: selectedZoneIds.includes(zone.id) ? zone.color : 'transparent' }}
                />
                <span className="text-sm text-gray-400 group-hover:text-white transition-colors">
                  {zone.name}
                </span>
              </label>
            ))}
          </div>
        </details>

        <details open className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none font-display text-sm text-gray-300 hover:text-white transition-colors">
            <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-0 -rotate-90 transition-transform" />
            异常类型
          </summary>
          <div className="mt-3 space-y-2 pl-6">
            {(Object.keys(ANOMALY_TYPE_CONFIG) as AnomalyType[]).map((type) => {
              const config = ANOMALY_TYPE_CONFIG[type]
              const Icon = config.icon
              return (
                <label key={type} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedAnomalyTypes.includes(type)}
                    onChange={() => handleAnomalyTypeToggle(type)}
                    className="sr-only"
                  />
                  <Icon className={`w-4 h-4 ${selectedAnomalyTypes.includes(type) ? config.color : 'text-gray-500'} transition-colors`} />
                  <span className="text-sm text-gray-400 group-hover:text-white transition-colors">
                    {config.label}
                  </span>
                </label>
              )
            })}
          </div>
        </details>

        <details open className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none font-display text-sm text-gray-300 hover:text-white transition-colors">
            <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-0 -rotate-90 transition-transform" />
            声压区间
          </summary>
          <div className="mt-3 space-y-4 pl-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>最小值</span>
                <span className="font-mono text-theater-accent">{splRange[0]} dB</span>
              </div>
              <input
                type="range"
                min="45"
                max="105"
                value={splRange[0]}
                onChange={(e) => setSplRange([Number(e.target.value), splRange[1]])}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>最大值</span>
                <span className="font-mono text-theater-accent">{splRange[1]} dB</span>
              </div>
              <input
                type="range"
                min="45"
                max="105"
                value={splRange[1]}
                onChange={(e) => setSplRange([splRange[0], Number(e.target.value)])}
                className="w-full"
              />
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}
