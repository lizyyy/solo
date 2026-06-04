import { useState } from 'react'
import { X, Search, CheckCircle, AlertCircle } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { clsx } from 'clsx'

export function SensorPanel() {
  const { setShowSensorPanel, sensors, selectedRecordId, supplementSensor } =
    useAppStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null)

  const filteredSensors = sensors.filter(
    (s) =>
      s.sensorNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.location.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleConfirm = () => {
    if (selectedSensor && selectedRecordId) {
      const sensor = sensors.find((s) => s.id === selectedSensor)
      if (sensor) {
        supplementSensor(selectedRecordId, sensor.sensorNo)
      }
    }
  }

  const sensor = selectedSensor
    ? sensors.find((s) => s.id === selectedSensor)
    : null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-industrial-800 rounded-xl w-full max-w-2xl card-shadow">
        <div className="p-4 border-b border-industrial-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-industrial-100 font-serif">
            补录传感器编号
          </h2>
          <button
            onClick={() => setShowSensorPanel(false)}
            className="p-2 hover:bg-industrial-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-industrial-400" />
          </button>
        </div>

        <div className="p-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-industrial-500" />
            <input
              type="text"
              placeholder="搜索传感器编号或位置..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-industrial-900 border border-industrial-600 rounded-lg text-industrial-200 placeholder-industrial-500 focus:outline-none focus:border-supplement-500 transition-colors"
            />
          </div>

          <div className="max-h-72 overflow-y-auto scrollbar-thin space-y-2">
            {filteredSensors.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelectedSensor(s.id)}
                className={clsx(
                  'p-4 rounded-lg cursor-pointer transition-all border-2',
                  selectedSensor === s.id
                    ? 'bg-supplement-500/20 border-supplement-500'
                    : 'bg-industrial-700/50 border-transparent hover:bg-industrial-700'
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono font-semibold text-industrial-100">
                      {s.sensorNo}
                    </span>
                    <p className="text-sm text-industrial-400 mt-1">{s.location}</p>
                  </div>
                  {s.oldCalibrationData && s.oldCalibrationData.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-supplement-400">
                      <AlertCircle className="w-4 h-4" />
                      含旧口径数据
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filteredSensors.length === 0 && (
              <div className="text-center py-8 text-industrial-500">
                未找到匹配的传感器
              </div>
            )}
          </div>

          {sensor && sensor.oldCalibrationData && sensor.oldCalibrationData.length > 0 && (
            <div className="mt-6 p-4 bg-supplement-500/10 border border-supplement-500/30 rounded-lg">
              <h3 className="font-medium text-supplement-400 mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                发现历史口径数据
              </h3>
              {sensor.oldCalibrationData.map((old) => (
                <div key={old.id} className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-industrial-500">标准版本</span>
                    <span className="text-industrial-200">{old.oldStandard}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-industrial-500">备注</span>
                    <span className="text-industrial-400 text-xs">{old.remark}</span>
                  </div>
                </div>
              ))}
              <p className="text-xs text-supplement-400 mt-3">
                补录后将自动关联以上旧口径数据
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-industrial-700 flex justify-end gap-3">
          <button
            onClick={() => setShowSensorPanel(false)}
            className="px-4 py-2 bg-industrial-700 hover:bg-industrial-600 text-industrial-300 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedSensor}
            className={clsx(
              'px-6 py-2 rounded-lg transition-colors',
              selectedSensor
                ? 'bg-supplement-600 hover:bg-supplement-500 text-white'
                : 'bg-industrial-600 text-industrial-400 cursor-not-allowed'
            )}
          >
            确认补录
          </button>
        </div>
      </div>
    </div>
  )
}
