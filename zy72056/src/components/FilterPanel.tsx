import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import type { DeviceType, QualityStatus } from "@/data/types"
import { DEVICE_TYPE_LABELS, QUALITY_STATUS_COLORS } from "@/data/types"
import { useAppStore } from "@/store/useAppStore"

const FLOORS = [
  { value: "B1", label: "B1 站厅层" },
  { value: "B2", label: "B2 站台层" },
]

const QUALITY_LABELS: Record<QualityStatus, string> = {
  ok: "正常",
  warning: "警告",
  error: "异常",
}

export default function FilterPanel() {
  const { filter, setFilter, filterPanelOpen, toggleFilterPanel } = useAppStore()

  if (!filterPanelOpen) {
    return (
      <button
        onClick={toggleFilterPanel}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-20 bg-[#1A1A2E]/90 border border-white/10 rounded-r-lg p-2 text-white/80 hover:text-white transition-colors"
      >
        <PanelLeftOpen size={18} />
      </button>
    )
  }

  const toggleFloor = (floor: string) => {
    const floors = filter.floors.includes(floor)
      ? filter.floors.filter(f => f !== floor)
      : [...filter.floors, floor]
    setFilter({ floors })
  }

  const toggleType = (type: DeviceType) => {
    const types = filter.types.includes(type)
      ? filter.types.filter(t => t !== type)
      : [...filter.types, type]
    setFilter({ types })
  }

  const toggleStatus = (status: QualityStatus) => {
    const qualityStatus = filter.qualityStatus.includes(status)
      ? filter.qualityStatus.filter(s => s !== status)
      : [...filter.qualityStatus, status]
    setFilter({ qualityStatus })
  }

  return (
    <aside className="w-[240px] shrink-0 bg-[#1A1A2E]/95 border-r border-white/10 text-white/80 flex flex-col relative">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm font-semibold text-white">筛选条件</span>
        <button onClick={toggleFilterPanel} className="text-white/60 hover:text-white transition-colors">
          <PanelLeftClose size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
        <section>
          <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">楼层</h3>
          {FLOORS.map(f => (
            <label key={f.value} className="flex items-center gap-2 py-1 cursor-pointer group">
              <input
                type="checkbox"
                checked={filter.floors.includes(f.value)}
                onChange={() => toggleFloor(f.value)}
                className="w-4 h-4 rounded border-white/30 bg-transparent accent-[#E94560]"
              />
              <span className="text-sm group-hover:text-white transition-colors">{f.label}</span>
            </label>
          ))}
        </section>

        <section>
          <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">设备类型</h3>
          {(Object.keys(DEVICE_TYPE_LABELS) as DeviceType[]).map(type => (
            <label key={type} className="flex items-center gap-2 py-1 cursor-pointer group">
              <input
                type="checkbox"
                checked={filter.types.includes(type)}
                onChange={() => toggleType(type)}
                className="w-4 h-4 rounded border-white/30 bg-transparent accent-[#E94560]"
              />
              <span className="text-sm group-hover:text-white transition-colors">{DEVICE_TYPE_LABELS[type]}</span>
            </label>
          ))}
        </section>

        <section>
          <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">质量状态</h3>
          {(Object.keys(QUALITY_STATUS_COLORS) as QualityStatus[]).map(status => (
            <label key={status} className="flex items-center gap-2 py-1 cursor-pointer group">
              <input
                type="checkbox"
                checked={filter.qualityStatus.includes(status)}
                onChange={() => toggleStatus(status)}
                className="w-4 h-4 rounded border-white/30 bg-transparent accent-[#E94560]"
              />
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: QUALITY_STATUS_COLORS[status] }}
              />
              <span className="text-sm group-hover:text-white transition-colors">{QUALITY_LABELS[status]}</span>
            </label>
          ))}
        </section>
      </div>
    </aside>
  )
}
