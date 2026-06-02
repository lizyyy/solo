import { useMemo } from "react"
import { useStore } from "@/store/useStore"
import type { MetricsResult } from "@/types"
import { cn } from "@/lib/utils"
import { Check, Edit3, Clock, AlertTriangle, FileWarning, Copy, BookOpen } from "lucide-react"

export default function Metrics() {
  const samples = useStore((s) => s.samples)
  const replayResults = useStore((s) => s.replayResults)
  const reviewRecords = useStore((s) => s.reviewRecords)

  const metrics: MetricsResult = useMemo(() => {
    const nonDuplicate = samples.filter((s) => !s.isDuplicate)
    const totalSamples = nonDuplicate.length
    const modelJudgedCount = nonDuplicate.filter((s) => s.status === "model_judged").length
    const humanCorrectedCount = nonDuplicate.filter((s) => s.status === "human_corrected").length
    const needsReviewCount = nonDuplicate.filter((s) => s.status === "needs_review").length
    return {
      totalSamples,
      modelJudgedCount,
      humanCorrectedCount,
      needsReviewCount,
      modelJudgedRate: totalSamples > 0 ? modelJudgedCount / totalSamples : 0,
      humanCorrectedRate: totalSamples > 0 ? humanCorrectedCount / totalSamples : 0,
      needsReviewRate: totalSamples > 0 ? needsReviewCount / totalSamples : 0,
      conflictCount: samples.filter((s) => s.hasConflict).length,
      leakageCount: samples.filter((s) => s.hasLeakage).length,
      duplicateCount: samples.filter((s) => s.isDuplicate).length,
      missingCitationCount: replayResults.filter((r) => r.citation === null).length,
    }
  }, [samples, replayResults])

  const conflictSamples = samples.filter((s) => s.hasConflict)
  const leakageSamples = samples.filter((s) => s.hasLeakage)
  const missingCitationResults = replayResults.filter((r) => r.citation === null)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-zinc-100">指标对比</h2>
        <p className="mt-1 text-sm text-zinc-500">分层展示模型判断、人工修正与待复核指标，标签冲突与样本泄漏单独提示</p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
              <Check className="h-4 w-4 text-emerald-400" />
            </div>
            <span className="text-sm font-medium text-emerald-300">模型判断</span>
          </div>
          <p className="font-mono text-3xl font-bold text-emerald-400">{metrics.modelJudgedCount}</p>
          <p className="mt-1 text-xs text-zinc-500">
            占比 <span className="font-mono text-emerald-400">{(metrics.modelJudgedRate * 100).toFixed(1)}%</span>
          </p>
          <div className="mt-3 h-1.5 rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${metrics.modelJudgedRate * 100}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
              <Edit3 className="h-4 w-4 text-amber-400" />
            </div>
            <span className="text-sm font-medium text-amber-300">人工修正</span>
          </div>
          <p className="font-mono text-3xl font-bold text-amber-400">{metrics.humanCorrectedCount}</p>
          <p className="mt-1 text-xs text-zinc-500">
            占比 <span className="font-mono text-amber-400">{(metrics.humanCorrectedRate * 100).toFixed(1)}%</span>
          </p>
          <div className="mt-3 h-1.5 rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{ width: `${metrics.humanCorrectedRate * 100}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-700/50">
              <Clock className="h-4 w-4 text-zinc-400" />
            </div>
            <span className="text-sm font-medium text-zinc-300">待复核</span>
          </div>
          <p className="font-mono text-3xl font-bold text-zinc-300">{metrics.needsReviewCount}</p>
          <p className="mt-1 text-xs text-zinc-500">
            占比 <span className="font-mono text-zinc-300">{(metrics.needsReviewRate * 100).toFixed(1)}%</span>
          </p>
          <div className="mt-3 h-1.5 rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-zinc-500 transition-all"
              style={{ width: `${metrics.needsReviewRate * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-zinc-700/40 bg-zinc-800/30 px-4 py-3">
          <p className="text-xs text-zinc-500">总样本数</p>
          <p className="font-mono text-lg font-semibold text-zinc-200">{metrics.totalSamples}</p>
        </div>
        <div className="rounded-lg border border-zinc-700/40 bg-zinc-800/30 px-4 py-3">
          <p className="text-xs text-zinc-500">重复样本</p>
          <p className="font-mono text-lg font-semibold text-zinc-300">{metrics.duplicateCount}</p>
        </div>
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3">
          <p className="text-xs text-rose-400">标签冲突</p>
          <p className="font-mono text-lg font-semibold text-rose-400">{metrics.conflictCount}</p>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs text-amber-400">缺引用结果</p>
          <p className="font-mono text-lg font-semibold text-amber-400">{metrics.missingCitationCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <h3 className="text-sm font-medium text-rose-300">标签冲突详情</h3>
            <span className="ml-auto rounded-full bg-rose-500/15 px-2 py-0.5 font-mono text-xs text-rose-400">
              {conflictSamples.length}
            </span>
          </div>
          {conflictSamples.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-500">无标签冲突</p>
          ) : (
            <div className="space-y-2">
              {conflictSamples.map((s) => {
                const result = replayResults.find((r) => r.sampleId === s.id)
                const latestReview = reviewRecords
                  .filter((r) => r.sampleId === s.id)
                  .sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime())[0]
                return (
                  <div key={s.id} className="rounded-lg border border-rose-500/15 bg-zinc-900/60 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-rose-400">{s.id}</span>
                      <span className="text-xs text-zinc-500">·</span>
                      <span className="text-xs text-zinc-400">{s.source}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-xs">
                      <span className="text-zinc-400">原始：</span>
                      <span className="text-zinc-300">{s.originalLabel}</span>
                      {result && (
                        <>
                          <span className="text-zinc-600">→</span>
                          <span className="text-zinc-400">模型：</span>
                          <span className={cn(result.modelLabel === s.originalLabel ? "text-emerald-400" : "text-rose-400")}>
                            {result.modelLabel}
                          </span>
                        </>
                      )}
                      {latestReview && (
                        <>
                          <span className="text-zinc-600">→</span>
                          <span className="text-zinc-400">修正：</span>
                          <span className="text-amber-400">{latestReview.correctedLabel}</span>
                        </>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-500">原因：{s.replayReason}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <FileWarning className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-medium text-amber-300">缺引用 / 泄漏详情</h3>
            <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-xs text-amber-400">
              {missingCitationResults.length + leakageSamples.length}
            </span>
          </div>
          {missingCitationResults.length === 0 && leakageSamples.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-500">无缺引用或泄漏样本</p>
          ) : (
            <div className="space-y-2">
              {leakageSamples.map((s) => (
                <div key={`leak-${s.id}`} className="rounded-lg border border-amber-500/15 bg-zinc-900/60 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Copy className="h-3 w-3 text-amber-400" />
                    <span className="font-mono text-xs text-amber-400">{s.id}</span>
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400">泄漏</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{s.content}</p>
                </div>
              ))}
              {missingCitationResults.map((r) => {
                const sample = samples.find((s) => s.id === r.sampleId)
                return (
                  <div key={`cite-${r.id}`} className="rounded-lg border border-amber-500/15 bg-zinc-900/60 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3 w-3 text-amber-400" />
                      <span className="font-mono text-xs text-amber-400">{r.sampleId}</span>
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400">缺引用</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">{sample?.content}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">模型输出：{r.modelOutput.substring(0, 80)}...</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
