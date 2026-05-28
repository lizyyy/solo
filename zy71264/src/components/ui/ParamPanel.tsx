import { useState } from 'react'
import { Settings, Save, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

export default function ParamPanel() {
  const {
    paramPanelOpen,
    paramSet,
    savedParamSets,
    updateParamSet,
    updateRack,
    loadParamSet,
    deleteParamSet,
    saveParamSet,
  } = useStore()

  const [selectedConfigId, setSelectedConfigId] = useState<string>('')
  const [rackExpanded, setRackExpanded] = useState(true)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newConfigName, setNewConfigName] = useState('')

  const handleSave = () => {
    if (newConfigName.trim()) {
      saveParamSet()
      setNewConfigName('')
      setShowSaveDialog(false)
    }
  }

  const handleLoad = () => {
    if (selectedConfigId) {
      loadParamSet(selectedConfigId)
    }
  }

  const handleDelete = () => {
    if (selectedConfigId) {
      deleteParamSet(selectedConfigId)
      setSelectedConfigId('')
    }
  }

  const sliderConfigs = [
    {
      key: 'globalPowerKw',
      label: '全局功耗',
      min: 1,
      max: 20,
      step: 0.5,
      unit: 'kW',
    },
    {
      key: 'globalAirflowCfm',
      label: '全局风量',
      min: 1000,
      max: 10000,
      step: 500,
      unit: 'CFM',
    },
    {
      key: 'aisleGap',
      label: '通道间距',
      min: 1,
      max: 4,
      step: 0.1,
      unit: 'm',
    },
    {
      key: 'floorPerforation',
      label: '地板开孔率',
      min: 0.2,
      max: 0.9,
      step: 0.05,
      unit: '',
    },
  ]

  return (
    <>
      <div
        className={cn(
          'fixed top-14 right-0 h-full w-80 bg-dc-panel border-l border-dc-border z-40 transform transition-transform duration-300 ease-in-out overflow-y-auto',
          paramPanelOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="p-4 space-y-6">
          <div className="flex items-center gap-2 text-dc-text font-medium">
            <Settings className="w-5 h-5 text-dc-cold" />
            <span>参数面板</span>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-dc-text border-b border-dc-border pb-2">
              全局参数
            </h3>
            {sliderConfigs.map((config) => (
              <div key={config.key} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-dc-muted">{config.label}</span>
                  <span className="text-dc-text font-mono">
                    {paramSet[config.key as keyof typeof paramSet] as number}
                    {config.unit && ` ${config.unit}`}
                  </span>
                </div>
                <input
                  type="range"
                  min={config.min}
                  max={config.max}
                  step={config.step}
                  value={paramSet[config.key as keyof typeof paramSet] as number}
                  onChange={(e) =>
                    updateParamSet({
                      [config.key]: parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-dc-bg rounded-lg appearance-none cursor-pointer accent-dc-cold"
                />
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-dc-text border-b border-dc-border pb-2">
              保存配置
            </h3>
            <div className="space-y-3">
              <select
                value={selectedConfigId}
                onChange={(e) => setSelectedConfigId(e.target.value)}
                className="w-full bg-dc-bg border border-dc-border rounded-md px-3 py-2 text-sm text-dc-text focus:outline-none focus:border-dc-cold"
              >
                <option value="">选择已保存的配置...</option>
                {savedParamSets.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleLoad}
                  disabled={!selectedConfigId}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-dc-cold text-dc-bg rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-90 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  加载
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!selectedConfigId}
                  className="px-3 py-2 bg-dc-danger text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-90 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => setShowSaveDialog(true)}
                className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-dc-bg border border-dc-border text-dc-text rounded-md text-sm font-medium hover:border-dc-cold transition-colors"
              >
                <Save className="w-4 h-4" />
                保存当前配置
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setRackExpanded(!rackExpanded)}
              className="w-full flex items-center justify-between text-sm font-medium text-dc-text border-b border-dc-border pb-2"
            >
              <span>机架列表</span>
              {rackExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            {rackExpanded && (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {paramSet.racks.map((rack) => (
                  <div
                    key={rack.id}
                    className="p-3 bg-dc-bg rounded-md border border-dc-border"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-dc-text">
                        {rack.label}
                      </span>
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded',
                          rack.isColdAisle
                            ? 'bg-dc-cold/20 text-dc-cold'
                            : 'bg-dc-hot/20 text-dc-hot'
                        )}
                      >
                        {rack.isColdAisle ? '冷通道' : '热通道'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-dc-muted">功耗 (kW)</label>
                        <input
                          type="number"
                          value={rack.powerKw}
                          onChange={(e) =>
                            updateRack(rack.id, {
                              powerKw: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full mt-1 bg-dc-panel border border-dc-border rounded px-2 py-1 text-sm text-dc-text focus:outline-none focus:border-dc-cold"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-dc-muted">温度 (°C)</label>
                        <input
                          type="number"
                          value={rack.temperature}
                          onChange={(e) =>
                            updateRack(rack.id, {
                              temperature: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full mt-1 bg-dc-panel border border-dc-border rounded px-2 py-1 text-sm text-dc-text focus:outline-none focus:border-dc-cold"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dc-panel border border-dc-border rounded-lg p-6 w-80">
            <h3 className="text-lg font-medium text-dc-text mb-4">保存配置</h3>
            <input
              type="text"
              value={newConfigName}
              onChange={(e) => setNewConfigName(e.target.value)}
              placeholder="输入配置名称..."
              className="w-full bg-dc-bg border border-dc-border rounded-md px-3 py-2 text-sm text-dc-text focus:outline-none focus:border-dc-cold mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="flex-1 px-4 py-2 bg-dc-bg border border-dc-border text-dc-text rounded-md text-sm hover:border-dc-cold transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-dc-cold text-dc-bg rounded-md text-sm font-medium hover:bg-opacity-90 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
