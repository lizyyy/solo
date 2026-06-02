import { useStore } from "@/store/useStore"
import { exportToCSV, exportToJSON, downloadFile } from "@/utils/export"
import { cn } from "@/lib/utils"
import { Download, FileJson, FileSpreadsheet, Check, Edit3, Clock, Tag, ArrowRight, BookOpen, Clock3 } from "lucide-react"
import { useState, useMemo } from "react"

type ExportFormat = "csv" | "json"

export default function Report() {
  const samples = useStore((s) => s.samples)
  const replayResults = useStore((s) => s.replayResults)
  const reviewRecords = useStore((s) => s.reviewRecords)

  const metrics = useMemo(() => {
    const nonDuplicate = samples.filter((s) => !s.isDuplicate)
    const total = nonDuplicate.length
    return {
      totalSamples: total,
      modelJudgedCount: nonDuplicate.filter((s) => s.status === "model_judged").length,
      humanCorrectedCount: nonDuplicate.filter((s) => s.status === "human_corrected").length,
      needsReviewCount: nonDuplicate.filter((s) => s.status === "needs_review").length,
    }
  }, [samples])

  const [exported, setExported] = useState(false)

  const modelJudged = samples.filter((s) => s.status === "model_judged")
  const humanCorrected = samples.filter((s) => s.status === "human_corrected")
  const needsReview = samples.filter((s) => s.status === "needs_review")
  const duplicates = samples.filter((s) => s.isDuplicate)

  function handleExport(format: ExportFormat) {
    const nonDuplicate = samples.filter((s) => !s.isDuplicate || s.hasConflict)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19)

    if (format === "csv") {
      const content = exportToCSV(nonDuplicate, reviewRecords)
      downloadFile(content, `安全回放报告-${timestamp}.csv`, "text/csv")
    } else {
      const content = exportToJSON(nonDuplicate, reviewRecords)
      downloadFile(content, `安全回放报告-${timestamp}.json`, "application/json")
    }
    setExported(true)
    setTimeout(() => setExported(false), 2000)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("zh-CN")
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">报告导出</h2>
          <p className="mt-1 text-sm text-zinc-500">区分模型判断、人工修正和仍需复核的样本，导出带原因的完整记录</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport("csv")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              exported
                ? "bg-emerald-500/15 text-emerald-400"
                : "border border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800"
            )}
          >
            {exported ? <Check className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
            {exported ? "已导出" : "导出 CSV"}
          </button>
          <button
            onClick={() => handleExport("json")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              exported
                ? "bg-emerald-500/15 text-emerald-400"
                : "border border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800"
            )}
          >
            {exported ? <Check className="h-4 w-4" /> : <FileJson className="h-4 w-4" />}
            {exported ? "已导出" : "导出 JSON"}
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-800/30 p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-300">报告概览</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg bg-zinc-900/60 px-4 py-3">
            <p className="text-xs text-zinc-500">总样本</p>
            <p className="font-mono text-xl font-bold text-zinc-200">{metrics.totalSamples}</p>
          </div>
          <div className="rounded-lg bg-emerald-500/5 px-4 py-3">
            <p className="text-xs text-emerald-400">模型判断</p>
            <p className="font-mono text-xl font-bold text-emerald-400">{metrics.modelJudgedCount}</p>
          </div>
          <div className="rounded-lg bg-amber-500/5 px-4 py-3">
            <p className="text-xs text-amber-400">人工修正</p>
            <p className="font-mono text-xl font-bold text-amber-400">{metrics.humanCorrectedCount}</p>
          </div>
          <div className="rounded-lg bg-zinc-900/60 px-4 py-3">
            <p className="text-xs text-zinc-400">待复核</p>
            <p className="font-mono text-xl font-bold text-zinc-300">{metrics.needsReviewCount}</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-emerald-300">模型判断（{modelJudged.length}）</h3>
          </div>
          {modelJudged.length === 0 ? (
            <p className="rounded-lg border border-zinc-800 bg-zinc-800/20 px-4 py-6 text-center text-xs text-zinc-500">
              暂无模型判断的样本，请在回放复核页确认
            </p>
          ) : (
            <div className="space-y-2">
              {modelJudged.map((s) => {
                const result = replayResults.find((r) => r.sampleId === s.id)
                return (
                  <div key={s.id} className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-emerald-400">{s.id}</span>
                        <span className="text-xs text-zinc-500">·</span>
                        <span className="text-xs text-zinc-400">{s.source}</span>
                        <span className="font-mono text-[10px] text-zinc-500">{s.sourceId}</span>
                      </div>
                      <span className="text-xs text-zinc-500">处理于 {s.processedAt && formatDate(s.processedAt)}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-zinc-300">{s.content}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1 text-zinc-400">
                        <Tag className="h-3 w-3" />
                        {s.originalLabel}
                        <ArrowRight className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">{s.finalLabel}</span>
                      </span>
                      {result && (
                        <span className="text-zinc-500">
                          置信度 {(result.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <BookOpen className="h-3 w-3 text-zinc-500" />
                      <span className="text-[10px] text-zinc-500">回放原因：{s.replayReason}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-300">人工修正（{humanCorrected.length}）</h3>
          </div>
          {humanCorrected.length === 0 ? (
            <p className="rounded-lg border border-zinc-800 bg-zinc-800/20 px-4 py-6 text-center text-xs text-zinc-500">
              暂无人工修正的样本，请在回放复核页修正
            </p>
          ) : (
            <div className="space-y-2">
              {humanCorrected.map((s) => {
                const latestReview = reviewRecords
                  .filter((r) => r.sampleId === s.id)
                  .sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime())[0]
                return (
                  <div key={s.id} className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-amber-400">{s.id}</span>
                        <span className="text-xs text-zinc-500">·</span>
                        <span className="text-xs text-zinc-400">{s.source}</span>
                        <span className="font-mono text-[10px] text-zinc-500">{s.sourceId}</span>
                      </div>
                      <span className="text-xs text-zinc-500">处理于 {s.processedAt && formatDate(s.processedAt)}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-zinc-300">{s.content}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1 text-zinc-400">
                        <Tag className="h-3 w-3" />
                        {s.originalLabel}
                        <ArrowRight className="h-3 w-3 text-amber-400" />
                        <span className="text-amber-400">{s.finalLabel}</span>
                      </span>
                    </div>
                    {latestReview && (
                      <div className="mt-2 rounded-md border border-zinc-700/30 bg-zinc-900/40 px-3 py-2">
                        <p className="text-xs text-zinc-400">修正原因：{latestReview.correctionReason}</p>
                        <p className="mt-0.5 text-[10px] text-zinc-500">
                          修正人：{latestReview.reviewer} · {formatDate(latestReview.reviewedAt)}
                        </p>
                      </div>
                    )}
                    <div className="mt-1.5 flex items-center gap-2">
                      <BookOpen className="h-3 w-3 text-zinc-500" />
                      <span className="text-[10px] text-zinc-500">回放原因：{s.replayReason}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-300">仍需复核（{needsReview.length}）</h3>
          </div>
          {needsReview.length === 0 ? (
            <p className="rounded-lg border border-zinc-800 bg-zinc-800/20 px-4 py-6 text-center text-xs text-zinc-500">
              所有样本均已处理
            </p>
          ) : (
            <div className="space-y-2">
              {needsReview.map((s) => (
                <div key={s.id} className="rounded-lg border border-zinc-700/40 bg-zinc-800/30 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-zinc-300">{s.id}</span>
                      <span className="text-xs text-zinc-500">·</span>
                      <span className="text-xs text-zinc-400">{s.source}</span>
                      <span className="font-mono text-[10px] text-zinc-500">{s.sourceId}</span>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                      <Clock3 className="h-3 w-3" />
                      等待处理
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-zinc-400">{s.content}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <BookOpen className="h-3 w-3 text-zinc-500" />
                    <span className="text-[10px] text-zinc-500">回放原因：{s.replayReason}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {duplicates.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Download className="h-4 w-4 text-zinc-500" />
              <h3 className="text-sm font-semibold text-zinc-400">重复样本（{duplicates.length}）</h3>
            </div>
            <div className="space-y-2">
              {duplicates.map((s) => (
                <div key={s.id} className="rounded-lg border border-zinc-700/30 bg-zinc-800/20 px-5 py-3 opacity-60">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-zinc-400">{s.id}</span>
                    <span className="text-zinc-500">与 {s.duplicateOf} 重复</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-500">{s.replayReason}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-800/20 px-4 py-3">
        <p className="text-xs text-zinc-500">
          导出文件中每条记录均包含：样本ID、来源、来源编号、原始标签、模型标签、最终标签、状态、回放原因、导入时间、处理时间、修正原因、修正人、修正时间。
          换人接手时可直接查看回放原因和修正记录，无需翻旧记录。
        </p>
      </div>
    </div>
  )
}
