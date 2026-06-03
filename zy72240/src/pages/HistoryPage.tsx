import { useEvidenceStore } from "@/store/useEvidenceStore"
import {
  Clock,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileSearch,
  Pencil,
  RefreshCw,
  FileCheck,
} from "lucide-react"

const actionIcons: Record<string, typeof Upload> = {
  "导入托管确认页": Upload,
  "自动归档": CheckCircle2,
  "标记待复核": AlertTriangle,
  "复核通过": FileCheck,
  "上传除权日截图": FileSearch,
  "人工修正": Pencil,
  "重跑": RefreshCw,
}

const actionColors: Record<string, string> = {
  "导入托管确认页": "bg-pine-500",
  "自动归档": "bg-emerald-500",
  "标记待复核": "bg-red-500",
  "复核通过": "bg-blue-500",
  "上传除权日截图": "bg-amber-500",
  "人工修正": "bg-amber-600",
  "重跑": "bg-indigo-500",
}

export default function HistoryPage() {
  const { operationLogs, records } = useEvidenceStore()

  const sortedLogs = [...operationLogs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  function getRecordName(id: string) {
    const record = records.find((r) => r.id === id)
    return record ? `${record.securityName} (${record.securityCode})` : id
  }

  function formatDate(ts: string) {
    const d = new Date(ts)
    return d.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  function formatTime(ts: string) {
    const d = new Date(ts)
    return d.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-pine-800">
          历史记录
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          按时间线展示每次操作的详细日志
        </p>
      </div>

      <div className="relative">
        <div className="absolute left-[22px] top-0 bottom-0 w-px bg-gradient-to-b from-pine-300 via-pine-200 to-transparent" />

        <div className="space-y-4">
          {sortedLogs.map((log, index) => {
            const Icon = actionIcons[log.action] || Clock
            const colorClass = actionColors[log.action] || "bg-gray-500"

            return (
              <div
                key={log.id}
                className="relative pl-14 animate-slide-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div
                  className={`absolute left-3 top-4 w-[18px] h-[18px] rounded-full ${colorClass} flex items-center justify-center ring-4 ring-white`}
                >
                  <Icon className="w-2.5 h-2.5 text-white" />
                </div>

                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <h3 className="font-semibold text-pine-800 text-sm">
                          {log.action}
                        </h3>
                        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                          {getRecordName(log.recordId)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {log.detail}
                      </p>
                      <div className="flex items-center gap-3 mt-2.5 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(log.timestamp)} {formatTime(log.timestamp)}
                        </span>
                        <span>·</span>
                        <span>{log.operator}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {sortedLogs.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Clock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">暂无操作记录</p>
          </div>
        )}
      </div>
    </div>
  )
}
