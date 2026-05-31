import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MessageSquare,
} from "lucide-react"
import { useGradingStore } from "@/store/gradingStore"
import {
  StatusBadge,
  ChangeTypeBadge,
  SourceBadge,
} from "@/components/Badges"
import { AuditTimeline } from "@/components/AuditTimeline"
import { SOURCE_LABELS } from "@/types"
import type { RecordStatus } from "@/types"

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const record = useGradingStore((s) => s.records.find((r) => r.id === id))
  const auditLog = useGradingStore((s) =>
    s.auditLog.filter((a) => a.recordId === id)
  )
  const currentUser = useGradingStore((s) => s.currentUser)
  const updateRecord = useGradingStore((s) => s.updateRecord)
  const reviewEquivalentAnswer = useGradingStore(
    (s) => s.reviewEquivalentAnswer
  )

  const [note, setNote] = useState("")
  const [reviewText, setReviewText] = useState("")

  if (!record) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-400">记录不存在</p>
      </div>
    )
  }

  const handleStatusChange = (newStatus: RecordStatus) => {
    const detail =
      newStatus === "confirmed"
        ? "确认记录，状态改为已确认"
        : newStatus === "closed"
          ? "关闭记录"
          : "重新标记为待处理"
    updateRecord(record.id, { status: newStatus }, detail)
  }

  const handleAddNote = () => {
    if (!note.trim()) return
    updateRecord(record.id, {}, `添加备注：${note.trim()}`)
    setNote("")
  }

  const handleReview = () => {
    if (!reviewText.trim()) return
    reviewEquivalentAnswer(record.id, reviewText.trim())
    setReviewText("")
  }

  const canReview =
    currentUser.role === "lead" &&
    record.equivalentAnswerIssue &&
    record.status === "pending" &&
    !record.reviewConclusion

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-navy-800">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-3">
          <button
            onClick={() => navigate("/")}
            className="rounded-md p-1 text-slate-300 hover:bg-navy-700 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-serif text-lg font-bold text-white">
            第{record.questionNo}题 · 记录详情
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <StatusBadge status={record.status} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-6 space-y-5">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="font-mono text-base font-semibold text-navy-800">
              第{record.questionNo}题
            </span>
            <SourceBadge source={record.source} />
            <ChangeTypeBadge changeType={record.changeType} />
            {record.equivalentAnswerIssue && (
              <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                <AlertTriangle size={12} />
                等价答案误判
              </span>
            )}
          </div>

          <p className="text-sm text-slate-700 leading-relaxed">
            {record.description}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-slate-400 mb-0.5">难度</div>
              <div className="text-sm font-medium text-slate-700">
                {record.difficulty}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-0.5">来源</div>
              <div className="text-sm font-medium text-slate-700">
                {SOURCE_LABELS[record.source]}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-0.5">创建者</div>
              <div className="text-sm font-medium text-slate-700">
                {record.createdBy}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <div className="text-xs text-slate-400 mb-1">原始答案</div>
              <div className="font-mono text-sm text-slate-700">
                {record.originalAnswer || "—"}
              </div>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <div className="text-xs text-slate-400 mb-1">标准答案</div>
              <div className="font-mono text-sm text-slate-700">
                {record.standardAnswer || "—"}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <span>创建于 {formatTime(record.createdAt)}</span>
            <span>·</span>
            <span>更新于 {formatTime(record.updatedAt)}</span>
          </div>
        </div>

        {record.pendingReason && (
          <div className="rounded-lg border border-red-100 bg-red-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle
                size={16}
                className="mt-0.5 shrink-0 text-red-500"
              />
              <div>
                <div className="text-xs font-medium text-red-700 mb-1">
                  待处理原因
                </div>
                <p className="text-sm text-red-800">{record.pendingReason}</p>
              </div>
            </div>
          </div>
        )}

        {record.reviewConclusion && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex items-start gap-2">
              <CheckCircle
                size={16}
                className="mt-0.5 shrink-0 text-emerald-500"
              />
              <div>
                <div className="text-xs font-medium text-emerald-700 mb-1">
                  复核结论
                </div>
                <p className="text-sm text-emerald-800">
                  {record.reviewConclusion}
                </p>
              </div>
            </div>
          </div>
        )}

        {record.equivalentAnswerIssue &&
          record.equivalentAnswers.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0 text-amber-500"
                />
                <div className="flex-1">
                  <div className="text-xs font-medium text-amber-700 mb-1">
                    等价答案误判
                  </div>
                  <div className="space-y-1.5">
                    {record.equivalentAnswers.map((ans, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm"
                      >
                        <XCircle
                          size={14}
                          className="shrink-0 text-red-400"
                        />
                        <span className="font-mono text-slate-700">
                          {ans}
                        </span>
                        <span className="text-xs text-slate-400">
                          被判为错误
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle
                        size={14}
                        className="shrink-0 text-emerald-400"
                      />
                      <span className="font-mono text-slate-700">
                        {record.standardAnswer}
                      </span>
                      <span className="text-xs text-slate-400">
                        标准答案
                      </span>
                    </div>
                  </div>

                  {canReview && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
                        rows={2}
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder="填写复核理由：为什么这些等价答案应被判为正确"
                      />
                      <button
                        onClick={handleReview}
                        disabled={!reviewText.trim()}
                        className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        确认复核
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-navy-800">
            审计轨迹
          </h3>
          {auditLog.length > 0 ? (
            <AuditTimeline entries={auditLog} />
          ) : (
            <p className="py-4 text-center text-xs text-slate-400">
              暂无审计记录
            </p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="text-sm font-semibold text-navy-800">操作</h3>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">变更状态：</span>
            {(
              [
                { key: "pending", label: "待处理", icon: AlertTriangle },
                { key: "confirmed", label: "已确认", icon: CheckCircle },
                { key: "closed", label: "已关闭", icon: XCircle },
              ] as const
            ).map((s) => (
              <button
                key={s.key}
                onClick={() => handleStatusChange(s.key)}
                disabled={record.status === s.key}
                className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  record.status === s.key
                    ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <s.icon size={12} />
                {s.label}
              </button>
            ))}
          </div>

          <div>
            <div className="flex items-start gap-2">
              <textarea
                className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-navy-400 focus:ring-1 focus:ring-navy-200 resize-none"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="添加备注"
              />
              <button
                onClick={handleAddNote}
                disabled={!note.trim()}
                className="shrink-0 rounded-md bg-navy-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MessageSquare size={14} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
