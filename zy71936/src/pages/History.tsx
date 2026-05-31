import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import ChangeDiff from "@/components/ChangeDiff"
import { useStore } from "@/store/index"
import { FIELD_LABELS } from "@/lib/types"
import type { ChangeLog } from "@/lib/types"
import { Clock, Filter, User, Search, FileText, GitCompare } from "lucide-react"

type FieldCategory = "全部" | "审稿意见" | "授权状态" | "标记状态" | "其他"

const CATEGORY_FIELDS: Record<Exclude<FieldCategory, "全部">, Set<string>> = {
  审稿意见: new Set(["reviewOpinion"]),
  授权状态: new Set(["authorizationStatus", "authorizationExpiry", "authorizationContact"]),
  标记状态: new Set(["markStatus", "markReason", "nextStep"]),
  其他: new Set(["fileName", "shootDate", "sourceType", "specVersion"]),
}

export default function History() {
  const navigate = useNavigate()
  const { changeLogs, loadChangeLogs, setSelectedRecordId } = useStore()

  const [category, setCategory] = useState<FieldCategory>("全部")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [searchUser, setSearchUser] = useState("")

  useEffect(() => {
    loadChangeLogs()
  }, [loadChangeLogs])

  const filtered = useMemo(() => {
    let logs = [...changeLogs]

    if (category !== "全部") {
      const fields = CATEGORY_FIELDS[category]
      logs = logs.filter((l) => fields.has(l.field))
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime()
      logs = logs.filter((l) => l.changedAt >= from)
    }

    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000
      logs = logs.filter((l) => l.changedAt < to)
    }

    if (searchUser.trim()) {
      const q = searchUser.trim().toLowerCase()
      logs = logs.filter((l) => l.changedBy.toLowerCase().includes(q))
    }

    logs.sort((a, b) => b.changedAt - a.changedAt)
    return logs
  }, [changeLogs, category, dateFrom, dateTo, searchUser])

  const totalCount = filtered.length
  const reviewOpinionCount = filtered.filter((l) => l.field === "reviewOpinion").length

  function handleRecordClick(recordId: string) {
    setSelectedRecordId(recordId)
    navigate("/")
  }

  return (
    <div className="min-h-screen bg-[#13132b] p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 flex items-center gap-3 text-2xl font-bold text-zinc-100">
          <Clock className="h-6 w-6 text-violet-400" />
          历史记录
        </h1>

        <div className="mb-6 flex gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-900/20 px-4 py-2">
            <FileText className="h-4 w-4 text-violet-400" />
            <span className="text-sm text-zinc-300">变更总数</span>
            <span className="text-lg font-bold text-violet-300">{totalCount}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-4 py-2">
            <GitCompare className="h-4 w-4 text-emerald-400" />
            <span className="text-sm text-zinc-300">审稿意见变更</span>
            <span className="text-lg font-bold text-emerald-300">{reviewOpinionCount}</span>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-700/50 bg-[#1e1e38] p-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-zinc-400" />
            <label className="text-sm text-zinc-400">字段类型</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as FieldCategory)}
              className="rounded border border-zinc-600 bg-[#13132b] px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-violet-500"
            >
              <option value="全部">全部</option>
              <option value="审稿意见">审稿意见</option>
              <option value="授权状态">授权状态</option>
              <option value="标记状态">标记状态</option>
              <option value="其他">其他</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-400" />
            <label className="text-sm text-zinc-400">起始</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded border border-zinc-600 bg-[#13132b] px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-violet-500"
            />
            <span className="text-zinc-500">~</span>
            <label className="text-sm text-zinc-400">截止</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded border border-zinc-600 bg-[#13132b] px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-violet-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="搜索操作人..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              className="rounded border border-zinc-600 bg-[#13132b] px-3 py-1.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
            <Clock className="mb-4 h-12 w-12 text-zinc-600" />
            <p className="text-lg">暂无变更记录</p>
          </div>
        ) : (
          <div className="relative pl-8">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-zinc-700" />

            {filtered.map((log) => (
              <TimelineEntry
                key={log.id}
                log={log}
                onRecordClick={handleRecordClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TimelineEntry({
  log,
  onRecordClick,
}: {
  log: ChangeLog
  onRecordClick: (recordId: string) => void
}) {
  const fieldLabel = FIELD_LABELS[log.field] ?? log.field
  const formattedDate = new Date(log.changedAt).toLocaleString("zh-CN")
  const isReviewOpinion = log.field === "reviewOpinion"

  return (
    <div className="relative mb-6">
      <div className="absolute -left-5 top-3 h-3 w-3 rounded-full border-2 border-violet-400 bg-[#13132b]" />

      <div className="rounded-lg border border-zinc-700/50 bg-[#1e1e38] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                isReviewOpinion
                  ? "bg-violet-900/50 text-violet-300"
                  : "bg-zinc-700/50 text-zinc-300"
              }`}
            >
              {fieldLabel}
            </span>
            {isReviewOpinion && (
              <span className="flex items-center gap-1 rounded bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-400">
                <GitCompare className="h-3 w-3" />
                审稿意见变更
              </span>
            )}
          </div>

          <button
            onClick={() => onRecordClick(log.photoRecordId)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-violet-400 transition-colors hover:bg-violet-900/30 hover:text-violet-300"
          >
            <FileText className="h-3 w-3" />
            查看记录
          </button>
        </div>

        {isReviewOpinion ? (
          <ReviewOpinionComparison log={log} />
        ) : (
          <ChangeDiff log={log} />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {log.changedBy}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formattedDate}
          </span>
        </div>
      </div>
    </div>
  )
}

function ReviewOpinionComparison({ log }: { log: ChangeLog }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-700/50">
      <div className="grid grid-cols-2 divide-x divide-zinc-700/50">
        <div className="bg-red-900/20 p-4">
          <div className="mb-2 text-xs font-medium text-red-400">修改前</div>
          <p className="whitespace-pre-wrap text-sm text-red-300 line-through">
            {log.oldValue || "（空）"}
          </p>
        </div>
        <div className="bg-emerald-900/20 p-4">
          <div className="mb-2 text-xs font-medium text-emerald-400">修改后</div>
          <p className="whitespace-pre-wrap text-sm text-emerald-300">
            {log.newValue || "（空）"}
          </p>
        </div>
      </div>
      {log.changeReason && (
        <div className="border-t border-zinc-700/50 bg-zinc-800/30 px-4 py-2 text-xs text-zinc-400">
          变更原因：{log.changeReason}
        </div>
      )}
    </div>
  )
}
