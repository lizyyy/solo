import { useState, useEffect } from "react"
import { useDataStore } from "@/store/useDataStore"
import { useThresholdStore } from "@/store/useThresholdStore"
import { useComputationStore } from "@/store/useComputationStore"
import { cn } from "@/lib/utils"
import { Play, GitCompare, Clock } from "lucide-react"
import SideBySideTable from "@/components/comparison/SideBySideTable"
import VersionTimeline from "@/components/comparison/VersionTimeline"
import HandoverReport from "@/components/comparison/HandoverReport"

export default function Comparison() {
  const { records, isLoaded, loadData } = useDataStore()
  const { versions, currentVersion } = useThresholdStore()
  const { traces, computeForRecord, getTracesForRecord } = useComputationStore()

  const [selectedRecordId, setSelectedRecordId] = useState<string>("")
  const [traceAId, setTraceAId] = useState<string>("")
  const [traceBId, setTraceBId] = useState<string>("")

  useEffect(() => {
    if (!isLoaded) loadData()
  }, [isLoaded, loadData])

  useEffect(() => {
    setTraceAId("")
    setTraceBId("")
  }, [selectedRecordId])

  const selectedRecord = records.find((r) => r.id === selectedRecordId)
  const recordTraces = selectedRecordId ? getTracesForRecord(selectedRecordId) : []

  const traceA = traces.find((t) => t.id === traceAId) ?? null
  const traceB = traces.find((t) => t.id === traceBId) ?? null

  const handleCompute = () => {
    if (!selectedRecord) return
    const newTrace = computeForRecord(selectedRecord)
    if (newTrace) {
      if (!traceAId) {
        setTraceAId(newTrace.id)
      } else if (!traceBId) {
        setTraceBId(newTrace.id)
      } else {
        setTraceAId(traceBId)
        setTraceBId(newTrace.id)
      }
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 print:bg-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
            <GitCompare className="h-6 w-6 text-amber-600" />
            历史对比
          </h1>
          <p className="text-sm text-stone-500 mt-1">对比不同计算结果，追踪阈值变更历史</p>
        </div>

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <select
            value={selectedRecordId}
            onChange={(e) => setSelectedRecordId(e.target.value)}
            className="px-3 py-2 border border-stone-300 rounded-md text-sm bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">选择记录...</option>
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} — {r.batchId} — {r.roastingLevel}
              </option>
            ))}
          </select>

          <button
            onClick={handleCompute}
            disabled={!selectedRecord}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              selectedRecord
                ? "bg-amber-500 hover:bg-amber-600 text-white"
                : "bg-stone-200 text-stone-400 cursor-not-allowed",
            )}
          >
            <Play className="h-3.5 w-3.5" />
            重新计算
          </button>

          {recordTraces.length > 0 && (
            <>
              <select
                value={traceAId}
                onChange={(e) => setTraceAId(e.target.value)}
                className="px-3 py-2 border border-stone-300 rounded-md text-sm bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">选择对比 A...</option>
                {recordTraces.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.computedAt} (v{t.thresholdVersion})
                  </option>
                ))}
              </select>

              <span className="text-stone-400 text-sm">vs</span>

              <select
                value={traceBId}
                onChange={(e) => setTraceBId(e.target.value)}
                className="px-3 py-2 border border-stone-300 rounded-md text-sm bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">选择对比 B...</option>
                {recordTraces.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.computedAt} (v{t.thresholdVersion})
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white rounded-lg border border-stone-200 p-5">
            <h2 className="text-lg font-semibold text-stone-700 mb-4">计算结果对比</h2>
            <SideBySideTable traceA={traceA} traceB={traceB} />
          </div>

          <div className="bg-white rounded-lg border border-stone-200 p-5">
            <h2 className="text-lg font-semibold text-stone-700 mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              阈值版本历史
            </h2>
            <VersionTimeline versions={versions} currentVersion={currentVersion} />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-stone-200 p-5">
          <HandoverReport
            records={records}
            thresholdVersions={versions}
            currentThresholdVersion={currentVersion}
            traces={traces}
          />
        </div>
      </div>
    </div>
  )
}
