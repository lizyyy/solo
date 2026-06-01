import { Link } from "react-router-dom"
import { Clock, Check, X, AlertTriangle, Edit, Pause, FileEdit } from "lucide-react"
import type { TrainingRecord } from "@/types"
import { formatDateTime, formatTime } from "@/utils"
import { cn } from "@/lib/utils"

interface RecordCardProps {
  record: TrainingRecord
  onSupplement?: () => void
  showSupplementForm?: boolean
}

export default function RecordCard({ record, onSupplement, showSupplementForm }: RecordCardProps) {
  const duration = Math.round((record.endTime - record.startTime) / 1000)

  return (
    <div
      className={cn(
        "card p-6 transition-all hover:border-slate-600",
        showSupplementForm && "ring-2 ring-brand-400/50 border-brand-400"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-lg">{record.levelPackName}</h3>
            {record.needsManualReview && (
              <span className="tag tag-warning">
                <AlertTriangle className="w-3 h-3 mr-1" />
                待确认
              </span>
            )}
            {record.source === "投影补录" && (
              <span className="tag tag-info">
                <FileEdit className="w-3 h-3 mr-1" />
                投影补录
              </span>
            )}
            {record.pauses.length > 0 && (
              <span className="tag tag-warning">
                <Pause className="w-3 h-3 mr-1" />
                {record.pauses.length} 次暂停
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatDateTime(record.startTime)}
            </span>
            <span>用时 {formatTime(duration)}</span>
          </div>
        </div>

        <div className="text-right">
          <div
            className={cn(
              "text-3xl font-bold",
              record.passed ? "text-success" : "text-danger"
            )}
          >
            {record.totalScore}
            <span className="text-lg text-slate-500">/{record.maxScore}</span>
          </div>
          <div
            className={cn(
              "tag mt-1",
              record.passed ? "tag-success" : "tag-danger"
            )}
          >
            {record.passed ? (
              <>
                <Check className="w-3 h-3 mr-1" />
                通过
              </>
            ) : (
              <>
                <X className="w-3 h-3 mr-1" />
                未通过
              </>
            )}
          </div>
        </div>
      </div>

      {record.supplements.length > 0 && (
        <div className="mb-4 p-3 bg-brand-400/10 border border-brand-400/30 rounded-lg">
          <div className="text-xs text-brand-300 font-medium mb-1">
            补录记录 ({record.supplements.length})
          </div>
          {record.supplements.map((s, idx) => (
            <div key={s.id} className="text-sm text-slate-300">
              {idx > 0 && <br />}
              <span className="text-brand-300">[{s.source}]</span>{" "}
              {s.content}
              {s.previousScore !== undefined && s.newScore !== undefined && (
                <span className="text-warning ml-2">
                  (分数从 {s.previousScore} → {s.newScore})
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Link
          to={`/history/${record.id}`}
          className="btn btn-outline text-sm flex-1"
        >
          查看详情
        </Link>
        {onSupplement && (
          <button onClick={onSupplement} className="btn btn-secondary text-sm">
            <Edit className="w-4 h-4" />
            补录备注
          </button>
        )}
      </div>
    </div>
  )
}
