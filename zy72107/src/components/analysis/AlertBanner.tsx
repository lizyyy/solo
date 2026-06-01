import { AlertTriangle } from "lucide-react"
import type { ExperimentRecord, ComputationTrace as ComputationTraceType } from "@/types"

interface AlertBannerProps {
  exceededRecords: {
    record: ExperimentRecord
    trace: ComputationTraceType
  }[]
  onSelectRecord: (recordId: string) => void
}

export default function AlertBanner({ exceededRecords, onSelectRecord }: AlertBannerProps) {
  if (exceededRecords.length === 0) return null

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
        <span className="text-sm font-semibold text-red-700">
          {exceededRecords.length} 条记录超出阈值
        </span>
      </div>
      <div className="space-y-1.5">
        {exceededRecords.map(({ record, trace }) => (
          <div
            key={record.id}
            className="flex items-center gap-2 bg-white border border-red-100 rounded px-3 py-1.5"
          >
            <span className="text-xs text-red-600 font-medium flex-1">
              记录 {record.id.slice(-6)} — 中心温度 {trace.result.finalCenterTemp}°C
            </span>
            <span className="badge bg-red-100 border-red-200 text-red-600">
              v{trace.result.thresholdVersionUsed}
            </span>
            <button
              onClick={() => onSelectRecord(record.id)}
              className="text-xs text-red-500 hover:text-red-700 underline underline-offset-2"
            >
              查看
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
