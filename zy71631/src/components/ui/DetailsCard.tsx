import { useState } from 'react'
import { X, PlusCircle } from 'lucide-react'
import { FREQUENCY_BANDS } from '@/types'
import type { FrequencyBand } from '@/types'
import useSceneStore from '@/stores/sceneStore'
import useDataStore from '@/stores/dataStore'
import usePlanStore from '@/stores/planStore'

export default function DetailsCard() {
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteContent, setNoteContent] = useState('')

  const selectedObject = useSceneStore((state) => state.selectedObject)
  const setSelectedObject = useSceneStore((state) => state.setSelectedObject)
  const seats = useDataStore((state) => state.seats)
  const speakers = useDataStore((state) => state.speakers)
  const zones = useDataStore((state) => state.zones)
  const measurements = useDataStore((state) => state.measurements)
  const getAnomaliesForObject = useDataStore((state) => state.getAnomaliesForObject)
  const currentPlanId = usePlanStore((state) => state.currentPlanId)
  const addNote = usePlanStore((state) => state.addNote)

  if (!selectedObject) return null

  const isSeat = selectedObject.type === 'seat'
  const seat = isSeat ? seats.find((s) => s.id === selectedObject.id) : null
  const speaker = !isSeat ? speakers.find((s) => s.id === selectedObject.id) : null
  const anomalies = getAnomaliesForObject(selectedObject.type, selectedObject.id)

  const handleAddNote = () => {
    if (!currentPlanId || !noteContent.trim()) return
    addNote(currentPlanId, selectedObject.type, selectedObject.id, noteContent.trim())
    setNoteContent('')
    setShowNoteInput(false)
  }

  const seatMeasurements = seat
    ? FREQUENCY_BANDS.map((band: FrequencyBand) =>
        measurements.find(
          (m) => m.seatId === seat.id && m.frequencyBand === band,
        ),
      )
    : []

  const zone = seat ? zones.find((z) => z.id === seat.zoneId) : null

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[320px] z-20 slide-in-right">
      <div className="h-full glass-panel border-l border-theater-border flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-theater-border">
          <h3 className="font-display text-lg text-white">
            {isSeat ? '座位详情' : '扬声器详情'}
          </h3>
          <button
            onClick={() => setSelectedObject(null)}
            className="p-1 hover:bg-theater-border rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isSeat && seat && (
            <>
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-400 text-sm">座位号</span>
                  <span className="font-mono text-xl text-white">
                    {seat.rowLabel}{seat.seatNumber}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-400 text-sm">区域</span>
                  <span className="text-white">{zone?.name || '-'}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-400 text-sm">坐标</span>
                  <span className="font-mono text-sm text-gray-300">
                    ({seat.x.toFixed(1)}, {seat.y.toFixed(1)}, {seat.z.toFixed(1)})
                  </span>
                </div>
              </div>

              <div className="border-t border-theater-border pt-4">
                <h4 className="font-display text-sm text-gray-300 mb-3">各频段声压级</h4>
                <div className="space-y-2">
                  {seatMeasurements.map((m, index) => (
                    <div key={index} className="flex justify-between items-baseline">
                      <span className="font-mono text-xs text-gray-500 w-16">
                        {FREQUENCY_BANDS[index]}
                      </span>
                      <div className="text-right">
                        <span className="font-mono text-white">
                          {m ? `${m.splDB.toFixed(1)} dB` : '-'}
                        </span>
                        {m && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {m.dataSource}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {!isSeat && speaker && (
            <>
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-400 text-sm">标识</span>
                  <span className="font-display text-lg text-white">{speaker.label}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-400 text-sm">型号</span>
                  <span className="font-mono text-white">{speaker.model}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-400 text-sm">位置</span>
                  <span className="font-mono text-sm text-gray-300">
                    ({speaker.x.toFixed(1)}, {speaker.y.toFixed(1)}, {speaker.z.toFixed(1)})
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-400 text-sm">延时</span>
                  <div className="text-right">
                    <span className="font-mono text-white">{speaker.delayMs} ms</span>
                    <div className="text-xs text-gray-500 mt-0.5">系统配置</div>
                  </div>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-400 text-sm">覆盖区域</span>
                  <span className="text-white">{zones.find((z) => z.id === speaker.zoneId)?.name || '舞台区'}</span>
                </div>
              </div>
            </>
          )}

          {anomalies.length > 0 && (
            <div className="border-t border-theater-border pt-4">
              <h4 className="font-display text-sm text-gray-300 mb-3">关联异常</h4>
              <div className="space-y-2">
                {anomalies.map((anomaly) => (
                  <div
                    key={anomaly.id}
                    className={`p-2 rounded border ${
                      anomaly.severity === 'error'
                        ? 'border-theater-red/30 bg-theater-red/10'
                        : 'border-theater-orange/30 bg-theater-orange/10'
                    }`}
                  >
                    <div className={`text-xs font-medium ${
                      anomaly.severity === 'error' ? 'text-theater-red' : 'text-theater-orange'
                    }`}>
                      {anomaly.type === 'frequency_mismatch' && '频段不匹配'}
                      {anomaly.type === 'seat_occlusion' && '座位遮挡'}
                      {anomaly.type === 'delay_inversion' && '延时反向'}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{anomaly.message}</p>
                    <div className="text-xs text-gray-500 mt-1">{anomaly.dataSource}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!showNoteInput ? (
            <button
              onClick={() => setShowNoteInput(true)}
              className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-theater-border rounded-lg text-gray-400 hover:text-theater-accent hover:border-theater-accent/50 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="text-sm">添加备注</span>
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="输入备注内容..."
                className="w-full h-24 p-2 bg-theater-dark/50 border border-theater-border rounded-lg text-white text-sm resize-none focus:outline-none focus:border-theater-accent"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddNote}
                  className="flex-1 py-1.5 bg-theater-accent text-white rounded-lg text-sm hover:bg-theater-accent/80 transition-colors"
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    setShowNoteInput(false)
                    setNoteContent('')
                  }}
                  className="flex-1 py-1.5 bg-theater-border text-gray-300 rounded-lg text-sm hover:bg-theater-border/80 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
