import { useState, useEffect, useMemo } from "react"
import { Play, Thermometer } from "lucide-react"
import { useDataStore } from "@/store/useDataStore"
import { useComputationStore } from "@/store/useComputationStore"
import HeatConduction3D from "@/components/analysis/HeatConduction3D"
import ComputationTracePanel from "@/components/analysis/ComputationTrace"
import ThresholdPanel from "@/components/analysis/ThresholdPanel"
import AlertBanner from "@/components/analysis/AlertBanner"

export default function Analysis() {
  const { records, loadData, isLoaded } = useDataStore()
  const { traces, computeForRecord, getLatestTraceForRecord } = useComputationStore()
  const [selectedRecordId, setSelectedRecordId] = useState<string>("")
  const [progress, setProgress] = useState(0.5)

  useEffect(() => {
    if (!isLoaded) loadData()
  }, [isLoaded, loadData])

  const validRecords = useMemo(
    () => records.filter((r) => r.beanSurfaceTemp !== null && r.beanCenterTemp !== null),
    [records]
  )

  const currentTrace = useMemo(
    () => (selectedRecordId ? getLatestTraceForRecord(selectedRecordId) : null),
    [selectedRecordId, traces, getLatestTraceForRecord]
  )

  const exceededRecords = useMemo(() => {
    const items: { record: (typeof records)[0]; trace: (typeof traces)[0] }[] = []
    for (const t of traces) {
      if (t.result.isExceedingThreshold) {
        const record = records.find((r) => r.id === t.recordId)
        if (record) items.push({ record, trace: t })
      }
    }
    return items
  }, [traces, records])

  const handleCompute = () => {
    if (!selectedRecordId) return
    const record = records.find((r) => r.id === selectedRecordId)
    if (!record) return
    computeForRecord(record)
  }

  const handleSelectExceeded = (recordId: string) => {
    setSelectedRecordId(recordId)
  }

  return (
    <div className="min-h-screen bg-[#FAF3E0] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Thermometer className="w-6 h-6 text-coffee-500" />
          <h1 className="text-xl font-bold text-coffee-800 font-serif">热传导分析</h1>
        </div>

        <AlertBanner exceededRecords={exceededRecords} onSelectRecord={handleSelectExceeded} />

        <div className="flex items-center gap-3 bg-white rounded-lg border border-coffee-200 p-3 shadow-sm">
          <select
            value={selectedRecordId}
            onChange={(e) => setSelectedRecordId(e.target.value)}
            className="flex-1 border border-coffee-200 rounded-md px-3 py-1.5 text-sm text-coffee-700 bg-white focus:outline-none focus:border-coffee-400"
          >
            <option value="">选择实验记录...</option>
            {validRecords.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id.slice(-6)} — 表面 {r.beanSurfaceTemp}°C / 中心 {r.beanCenterTemp}°C ({r.batchId})
              </option>
            ))}
          </select>
          <button
            onClick={handleCompute}
            disabled={!selectedRecordId}
            className="btn-primary flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-3.5 h-3.5" />
            计算热传导
          </button>
        </div>

        <div className="flex gap-4" style={{ minHeight: 480 }}>
          <div className="w-[60%] space-y-3">
            <div className="bg-white rounded-lg border border-coffee-200 shadow-sm overflow-hidden" style={{ height: 400 }}>
              <HeatConduction3D
                result={currentTrace?.result ?? null}
                progress={progress}
              />
            </div>
            <div className="bg-white rounded-lg border border-coffee-200 shadow-sm px-4 py-2.5 flex items-center gap-3">
              <span className="text-xs text-coffee-400 shrink-0">扩散进度</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={progress}
                onChange={(e) => setProgress(parseFloat(e.target.value))}
                className="flex-1 accent-coffee-500"
              />
              <span className="text-xs font-mono text-coffee-600 w-10 text-right">
                {Math.round(progress * 100)}%
              </span>
            </div>
          </div>

          <div className="w-[40%] space-y-4 overflow-y-auto" style={{ maxHeight: 480 }}>
            <div className="card">
              <ThresholdPanel />
            </div>
            {currentTrace && (
              <div className="card">
                <ComputationTracePanel trace={currentTrace} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
