import { useNavigate } from "react-router-dom"
import { Clock, User } from "lucide-react"
import type { GradingRecord } from "@/types"
import { StatusBadge, ChangeTypeBadge, SourceBadge } from "@/components/Badges"

interface RecordCardProps {
  record: GradingRecord
}

export function RecordCard({ record }: RecordCardProps) {
  const navigate = useNavigate()

  const statusBorder: Record<string, string> = {
    pending: "border-l-red-400",
    confirmed: "border-l-emerald-400",
    closed: "border-l-gray-300",
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
  }

  return (
    <div
      onClick={() => navigate(`/record/${record.id}`)}
      className={`group cursor-pointer rounded-lg border border-l-4 border-slate-200 bg-white p-4 transition-all duration-200 hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 ${statusBorder[record.status]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-semibold text-navy-800">
            第{record.questionNo}题
          </span>
          <SourceBadge source={record.source} />
          <ChangeTypeBadge changeType={record.changeType} />
          <StatusBadge status={record.status} />
          {record.equivalentAnswerIssue && (
            <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
              等价答案误判
            </span>
          )}
        </div>
      </div>

      <p className="mt-2 text-sm text-slate-600 leading-relaxed line-clamp-2">
        {record.description}
      </p>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1">
          <User size={12} />
          {record.createdBy}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock size={12} />
          {formatTime(record.updatedAt)}
        </span>
      </div>
    </div>
  )
}
