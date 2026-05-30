import { useState } from 'react'
import { ChevronLeft, PanelRightClose } from 'lucide-react'
import { useStore } from '../../store/useStore'
import TaskFilter from './TaskFilter'
import TaskTable from './TaskTable'
import AnomalyList from './AnomalyList'
import PendingQueue from './PendingQueue'
import SourceCard from './SourceCard'
import AuditLog from './AuditLog'

const TABS = ['筛选', '任务', '异常', '待确认', '日志'] as const
type TabKey = (typeof TABS)[number]

export default function SidePanel() {
  const panelOpen = useStore((s) => s.panelOpen)
  const togglePanel = useStore((s) => s.togglePanel)
  const [activeTab, setActiveTab] = useState<TabKey>('筛选')

  const selectedAnomalyId = useStore((s) => s.selectedAnomalyId)
  const anomalies = useStore((s) => s.anomalies)
  const selectedAnomaly = anomalies.find((a) => a.id === selectedAnomalyId)

  const heatmapConfig = useStore((s) => s.heatmapConfig)
  const setHeatmapConfig = useStore((s) => s.setHeatmapConfig)
  const batteryConfig = useStore((s) => s.batteryConfig)
  const setBatteryConfig = useStore((s) => s.setBatteryConfig)
  const showHeatmap = useStore((s) => s.showHeatmap)
  const setShowHeatmap = useStore((s) => s.setShowHeatmap)
  const showBattery = useStore((s) => s.showBattery)
  const setShowBattery = useStore((s) => s.setShowBattery)
  const showAnomalyMarkers = useStore((s) => s.showAnomalyMarkers)
  const setShowAnomalyMarkers = useStore((s) => s.setShowAnomalyMarkers)

  if (!panelOpen) {
    return (
      <div className="flex flex-col items-center py-4 bg-[#0a0e1a] border-l border-gray-800 w-10">
        <button
          onClick={togglePanel}
          className="rounded p-1.5 text-gray-400 hover:text-[#00f0ff] hover:bg-white/5 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0e1a] border-l border-gray-800" style={{ width: 380 }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-[#00f0ff]">仓储机器人路径云</h2>
        <button
          onClick={togglePanel}
          className="rounded p-1 text-gray-400 hover:text-[#00f0ff] hover:bg-white/5 transition-colors"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      <div className="flex border-b border-gray-800">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs transition-colors ${
              activeTab === tab
                ? 'text-[#00f0ff] border-b-2 border-[#00f0ff] bg-[#00f0ff]/5'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === '筛选' && (
          <div className="space-y-5">
            <TaskFilter />
            <div className="border-t border-gray-800 pt-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">热力阈值</span>
                  <span className="text-xs text-[#00f0ff] font-mono">
                    {heatmapConfig.threshold.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={heatmapConfig.threshold}
                  onChange={(e) =>
                    setHeatmapConfig({ threshold: parseFloat(e.target.value) })
                  }
                  className="w-full accent-[#00f0ff] h-1"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">电量阈值</span>
                  <span className="text-xs text-[#00f0ff] font-mono">
                    {batteryConfig.lowThreshold}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={5}
                  value={batteryConfig.lowThreshold}
                  onChange={(e) =>
                    setBatteryConfig({ lowThreshold: parseInt(e.target.value) })
                  }
                  className="w-full accent-[#00f0ff] h-1"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">电量突降阈值</span>
                  <span className="text-xs text-[#00f0ff] font-mono">
                    {batteryConfig.dropThreshold}
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={5}
                  value={batteryConfig.dropThreshold}
                  onChange={(e) =>
                    setBatteryConfig({ dropThreshold: parseInt(e.target.value) })
                  }
                  className="w-full accent-[#00f0ff] h-1"
                />
              </div>

              <div className="space-y-2 border-t border-gray-800 pt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showHeatmap}
                    onChange={(e) => setShowHeatmap(e.target.checked)}
                    className="accent-[#00f0ff] h-3.5 w-3.5"
                  />
                  <span className="text-xs text-gray-300">显示热力图</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBattery}
                    onChange={(e) => setShowBattery(e.target.checked)}
                    className="accent-[#00f0ff] h-3.5 w-3.5"
                  />
                  <span className="text-xs text-gray-300">显示电量标记</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAnomalyMarkers}
                    onChange={(e) => setShowAnomalyMarkers(e.target.checked)}
                    className="accent-[#00f0ff] h-3.5 w-3.5"
                  />
                  <span className="text-xs text-gray-300">显示异常标记</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === '任务' && <TaskTable />}

        {activeTab === '异常' && (
          <div className="space-y-4">
            <AnomalyList />
            {selectedAnomaly && <SourceCard source={selectedAnomaly.source} />}
          </div>
        )}

        {activeTab === '待确认' && <PendingQueue />}

        {activeTab === '日志' && <AuditLog />}
      </div>
    </div>
  )
}
