import { useState } from "react"
import { useStore } from "@/store/useStore"
import StatusBadge from "@/components/StatusBadge"
import { cn } from "@/lib/utils"
import { Play, Check, Edit3, AlertTriangle, FileWarning, Clock, Tag, ChevronDown, ChevronUp, ArrowRight, BookOpen } from "lucide-react"

export default function Replay() {
  const samples = useStore((s) => s.samples)
  const replayResults = useStore((s) => s.replayResults)
  const reviewRecords = useStore((s) => s.reviewRecords)
  const runReplay = useStore((s) => s.runReplay)
  const runAllReplays = useStore((s) => s.runAllReplays)
  const confirmModel = useStore((s) => s.confirmModel)
  const correctLabel = useStore((s) => s.correctLabel)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [correctingId, setCorrectingId] = useState<string | null>(null)
  const [correctedLabel, setCorrectedLabel] = useState("")
  const [correctionReason, setCorrectionReason] = useState("")

  const actionableSamples = samples.filter((s) => !s.isDuplicate || s.hasConflict)

  function handleCorrect(sampleId: string) {
    if (!correctedLabel || !correctionReason) return
    correctLabel(sampleId, correctedLabel, correctionReason, "周姐")
    setCorrectingId(null)
    setCorrectedLabel("")
    setCorrectionReason("")
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">回放复核</h2>
          <p className="mt-1 text-sm text-zinc-500">执行模型回放，对比模型判断与原始标签，人工确认或修正</p>
        </div>
        <button
          onClick={runAllReplays}
          className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition-all hover:bg-amber-400 hover:shadow-lg hover:shadow-amber-500/20"
        >
          <Play className="h-4 w-4" />
          全部回放
        </button>
      </div>

      <div className="space-y-3">
        {actionableSamples.map((sample) => {
          const result = replayResults.find((r) => r.sampleId === sample.id)
          const reviews = reviewRecords.filter((r) => r.sampleId === sample.id)
          const isExpanded = expandedId === sample.id
          const isLabelMatch = result ? result.modelLabel === sample.originalLabel : null

          return (
            <div
              key={sample.id}
              className={cn(
                "overflow-hidden rounded-xl border transition-all",
                sample.hasConflict
                  ? "border-rose-500/30 bg-rose-500/5"
                  : sample.hasLeakage
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-zinc-800 bg-zinc-800/30"
              )}
            >
              <div
                className="flex cursor-pointer items-center gap-4 px-5 py-4"
                onClick={() => setExpandedId(isExpanded ? null : sample.id)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
                  <span className="font-mono text-xs font-semibold text-amber-400">{sample.id.replace("SMP-", "#")}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-200">{sample.content}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {sample.originalLabel}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(sample.importedAt).toLocaleString("zh-CN")}
                    </span>
                    {sample.hasConflict && (
                      <span className="flex items-center gap-1 text-rose-400">
                        <AlertTriangle className="h-3 w-3" />
                        标签冲突
                      </span>
                    )}
                    {sample.hasLeakage && (
                      <span className="flex items-center gap-1 text-amber-400">
                        <FileWarning className="h-3 w-3" />
                        样本泄漏
                      </span>
                    )}
                  </div>
                </div>
                <StatusBadge status={sample.status} />
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-zinc-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                )}
              </div>

              {isExpanded && (
                <div className="border-t border-zinc-800/60 px-5 py-4">
                  <div className="mb-3 rounded-lg bg-zinc-900/80 px-4 py-2.5">
                    <p className="text-xs text-zinc-500">回放原因</p>
                    <p className="mt-0.5 text-sm text-zinc-300">{sample.replayReason}</p>
                  </div>

                  {!result && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        runReplay(sample.id)
                      }}
                      className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-400 transition-colors hover:bg-amber-500/20"
                    >
                      <Play className="h-3.5 w-3.5" />
                      执行模型回放
                    </button>
                  )}

                  {result && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg border border-zinc-700/40 bg-zinc-900/60 p-4">
                          <p className="mb-2 text-xs font-medium text-zinc-500">原始标签</p>
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-zinc-400" />
                            <span className="text-sm font-medium text-zinc-200">{sample.originalLabel}</span>
                          </div>
                        </div>
                        <div
                          className={cn(
                            "rounded-lg border p-4",
                            isLabelMatch
                              ? "border-emerald-500/30 bg-emerald-500/5"
                              : "border-rose-500/30 bg-rose-500/5"
                          )}
                        >
                          <p className="mb-2 text-xs font-medium text-zinc-500">模型判断</p>
                          <div className="flex items-center gap-2">
                            <Tag className={cn("h-4 w-4", isLabelMatch ? "text-emerald-400" : "text-rose-400")} />
                            <span className={cn("text-sm font-medium", isLabelMatch ? "text-emerald-300" : "text-rose-300")}>
                              {result.modelLabel}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[10px] text-zinc-500">置信度</span>
                            <div className="h-1.5 flex-1 rounded-full bg-zinc-700">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  isLabelMatch ? "bg-emerald-500" : "bg-rose-500"
                                )}
                                style={{ width: `${result.confidence * 100}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] text-zinc-400">
                              {(result.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-zinc-700/40 bg-zinc-900/60 p-4">
                        <p className="mb-1.5 text-xs font-medium text-zinc-500">模型输出</p>
                        <p className="text-sm text-zinc-300">{result.modelOutput}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <BookOpen className="h-3 w-3 text-zinc-500" />
                          <span className="text-xs text-zinc-500">引用：</span>
                          {result.citation ? (
                            <span className="text-xs text-zinc-300">{result.citation}</span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-amber-400">
                              <FileWarning className="h-3 w-3" />
                              缺少引用
                            </span>
                          )}
                        </div>
                      </div>

                      {isLabelMatch !== null && !isLabelMatch && (
                        <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-2.5">
                          <AlertTriangle className="h-4 w-4 text-rose-400" />
                          <span className="text-sm text-rose-300">
                            模型判断与原始标签不一致，需要人工确认
                          </span>
                        </div>
                      )}

                      {sample.status === "needs_review" && (
                        <div className="flex items-center gap-3">
                          {isLabelMatch ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                confirmModel(sample.id)
                              }}
                              className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm text-emerald-400 transition-colors hover:bg-emerald-500/25"
                            >
                              <Check className="h-3.5 w-3.5" />
                              确认模型判断
                            </button>
                          ) : null}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setCorrectingId(sample.id)
                              setCorrectedLabel(result.modelLabel)
                            }}
                            className="flex items-center gap-2 rounded-lg bg-amber-500/15 px-4 py-2 text-sm text-amber-400 transition-colors hover:bg-amber-500/25"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            人工修正
                          </button>
                        </div>
                      )}

                      {correctingId === sample.id && (
                        <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                          <div>
                            <label className="mb-1 block text-xs text-zinc-400">修正后标签</label>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-zinc-500 line-through">{sample.originalLabel}</span>
                              <ArrowRight className="h-3 w-3 text-amber-400" />
                              <input
                                type="text"
                                value={correctedLabel}
                                onChange={(e) => setCorrectedLabel(e.target.value)}
                                className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-amber-500/50"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-zinc-400">修正原因</label>
                            <textarea
                              value={correctionReason}
                              onChange={(e) => setCorrectionReason(e.target.value)}
                              rows={2}
                              className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber-500/50"
                              placeholder="请说明修正原因..."
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCorrect(sample.id)
                              }}
                              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-amber-400"
                            >
                              提交修正
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setCorrectingId(null)
                              }}
                              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-500"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      )}

                      {reviews.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-zinc-500">修正记录</p>
                          {reviews.map((review) => (
                            <div key={review.id} className="rounded-lg border border-zinc-700/40 bg-zinc-900/60 px-4 py-3">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-zinc-500 line-through">{review.previousLabel}</span>
                                <ArrowRight className="h-3 w-3 text-amber-400" />
                                <span className="text-amber-400">{review.correctedLabel}</span>
                              </div>
                              <p className="mt-1 text-xs text-zinc-400">原因：{review.correctionReason}</p>
                              <p className="mt-0.5 text-[10px] text-zinc-500">
                                修正人：{review.reviewer} · {new Date(review.reviewedAt).toLocaleString("zh-CN")}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
