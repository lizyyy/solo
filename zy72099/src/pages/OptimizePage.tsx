import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import {
  Play,
  Clock,
  MapPin,
  Route,
  Brain,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  ArrowRight,
  Lightbulb,
  Shield,
} from 'lucide-react'

function ReasoningTimeline({
  steps,
}: {
  steps: { step: number; title: string; description: string }[]
}) {
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})

  const toggle = (step: number) =>
    setCollapsed((prev) => ({ ...prev, [step]: !prev[step] }))

  return (
    <div className="space-y-0">
      {steps.map((s, i) => (
        <div key={s.step} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-slate-900">
              {s.step}
            </div>
            {i < steps.length - 1 && (
              <div className="h-full w-0.5 bg-slate-700" />
            )}
          </div>
          <div className={cn('flex-1 pb-6', i === steps.length - 1 && 'pb-0')}>
            <button
              type="button"
              onClick={() => toggle(s.step)}
              className="flex w-full items-center gap-2 text-left"
            >
              <span className="font-bold text-slate-100">{s.title}</span>
              {collapsed[s.step] ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              )}
            </button>
            {!collapsed[s.step] && (
              <p className="mt-1 text-sm leading-relaxed text-slate-400">
                {s.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function ExcludedPointsTable({
  excluded,
}: {
  excluded: { pointId: string; reason: string }[]
}) {
  const getPointById = useAppStore((s) => s.getPointById)

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
      <div className="mb-4 flex items-center gap-2 text-red-400">
        <AlertTriangle className="h-5 w-5" />
        <h3 className="text-lg font-bold">异常记录</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="pb-2 pr-4">展点ID</th>
              <th className="pb-2 pr-4">展点名称</th>
              <th className="pb-2">排除原因</th>
            </tr>
          </thead>
          <tbody>
            {excluded.map((ep) => (
              <tr
                key={ep.pointId}
                className="border-l-2 border-l-red-500 border-b border-b-slate-700/50"
              >
                <td className="py-2 pr-4 font-mono text-slate-300">
                  {ep.pointId}
                </td>
                <td className="py-2 pr-4 text-slate-200">
                  {getPointById(ep.pointId)?.name ?? '-'}
                </td>
                <td className="py-2 text-slate-400">{ep.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        以上记录未参与路线计算，但已保留在统计中，不会消失
      </p>
    </div>
  )
}

function PredictionSuggestions({
  predictions,
}: {
  predictions: { suggestion: string; reasoning: string; confidence: number }[]
}) {
  const confidenceColor = (c: number) => {
    if (c > 0.8) return 'bg-emerald-500/20 text-emerald-400'
    if (c >= 0.5) return 'bg-amber-500/20 text-amber-400'
    return 'bg-red-500/20 text-red-400'
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
      <div className="mb-4 flex items-center gap-2 text-amber-400">
        <Lightbulb className="h-5 w-5" />
        <h3 className="text-lg font-bold">预测与建议</h3>
      </div>
      <div className="space-y-3">
        {predictions.map((p, i) => (
          <div
            key={i}
            className="rounded-md border-l-2 border-l-amber-500 bg-slate-800/50 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-bold text-slate-100">{p.suggestion}</span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-xs font-mono',
                  confidenceColor(p.confidence),
                )}
              >
                {(p.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">{p.reasoning}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ResultSummary({
  result,
}: {
  result: {
    route: string[]
    totalDistance: number
    totalDistanceUnit: string
    estimatedTime: number
  }
}) {
  const getPointById = useAppStore((s) => s.getPointById)

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
      <div className="mb-4 flex items-center gap-2 text-slate-200">
        <Shield className="h-5 w-5" />
        <h3 className="text-lg font-bold">结果摘要</h3>
      </div>
      <div className="mb-5 grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-slate-900 p-4 text-center">
          <Route className="mx-auto mb-2 h-5 w-5 text-amber-400" />
          <div className="font-mono text-2xl font-bold text-amber-400">
            {result.totalDistance}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            总距离（{result.totalDistanceUnit}）
          </div>
        </div>
        <div className="rounded-lg bg-slate-900 p-4 text-center">
          <Clock className="mx-auto mb-2 h-5 w-5 text-amber-400" />
          <div className="font-mono text-2xl font-bold text-amber-400">
            {result.estimatedTime}
          </div>
          <div className="mt-1 text-xs text-slate-400">预计时间（分钟）</div>
        </div>
        <div className="rounded-lg bg-slate-900 p-4 text-center">
          <MapPin className="mx-auto mb-2 h-5 w-5 text-amber-400" />
          <div className="font-mono text-2xl font-bold text-amber-400">
            {result.route.length}
          </div>
          <div className="mt-1 text-xs text-slate-400">途经展点（个）</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {result.route.map((id, i) => (
          <span key={id} className="flex items-center gap-1.5">
            <span className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-200">
              {getPointById(id)?.name ?? id}
            </span>
            {i < result.route.length - 1 && (
              <ArrowRight className="h-3 w-3 text-slate-500" />
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function OptimizePage() {
  const points = useAppStore((s) => s.points)
  const validationResults = useAppStore((s) => s.validationResults)
  const optimizationResult = useAppStore((s) => s.optimizationResult)
  const isOptimizing = useAppStore((s) => s.isOptimizing)
  const runOptimization = useAppStore((s) => s.runOptimization)

  if (points.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <MapPin className="mx-auto mb-3 h-10 w-10 text-slate-600" />
          <p className="text-slate-400">请先在"数据导入"页加载数据</p>
        </div>
      </div>
    )
  }

  const validCount = validationResults.filter(
    (v) => v.status === 'valid',
  ).length
  const warningCount = validationResults.filter(
    (v) => v.status === 'warning',
  ).length

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-slate-100">
          <Route className="h-6 w-6 text-amber-500" />
          <h2 className="text-2xl font-bold">路线优化与诊断</h2>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          基于透明推理的展馆参观路线优化，每一步计算过程可追溯
        </p>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
        <button
          type="button"
          onClick={runOptimization}
          disabled={isOptimizing}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-3 text-lg font-bold text-slate-900 transition-colors',
            isOptimizing
              ? 'cursor-not-allowed opacity-60'
              : 'hover:bg-amber-400',
          )}
        >
          {isOptimizing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              计算中...
            </>
          ) : (
            <>
              <Play className="h-5 w-5" />
              执行路线优化
            </>
          )}
        </button>
        <div className="mt-4 flex gap-6 text-sm">
          <span className="text-slate-400">
            总展点:{' '}
            <span className="font-mono text-slate-200">{points.length}</span>
          </span>
          <span className="text-emerald-400">
            有效:{' '}
            <span className="font-mono">{validCount}</span>
          </span>
          <span className="text-amber-400">
            警告:{' '}
            <span className="font-mono">{warningCount}</span>
          </span>
        </div>
      </div>

      {optimizationResult && (
        <>
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
            <div className="mb-4 flex items-center gap-2 text-amber-400">
              <Brain className="h-5 w-5" />
              <h3 className="text-lg font-bold">推理过程</h3>
            </div>
            <ReasoningTimeline steps={optimizationResult.reasoning} />
          </div>

          {optimizationResult.excludedPoints.length > 0 && (
            <ExcludedPointsTable excluded={optimizationResult.excludedPoints} />
          )}

          {optimizationResult.predictions.length > 0 && (
            <PredictionSuggestions predictions={optimizationResult.predictions} />
          )}

          <ResultSummary result={optimizationResult} />
        </>
      )}
    </div>
  )
}
