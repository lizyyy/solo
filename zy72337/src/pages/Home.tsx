import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, AlertTriangle, ArrowRight, Sliders, FileText, Presentation, Clock, Gavel, AlertOctagon, ListChecks } from 'lucide-react'
import { useAppStore } from '@/store'

interface ActionItem {
  id: string
  name: string
  nextAction: string
  adjudicationNote?: string
  lastActor?: string
}

const steps = [
  { key: 'import' as const, label: '① 导入参数调试表', path: '/params', icon: Sliders },
  { key: 'counterexample_review' as const, label: '② 补看手算反例', path: '/counterexamples', icon: FileText },
  { key: 'demo_update' as const, label: '③ 课堂演示更新', path: '/demo', icon: Presentation },
]

const checkLabels: Record<string, string> = {
  duplicate_import: '重复导入检测',
  denominator_zero_empty: '分母为0空字符串',
  recalc_after_supplement: '补录后重算',
  export_consistency: '导出一致性',
}

const statusColors: Record<string, string> = {
  pass: 'bg-emerald-500',
  fail: 'bg-red-500',
  warning: 'bg-amber-500',
}

export default function Home() {
  const navigate = useNavigate()
  const { workflow, selfChecks, paramItems, demoResults, conflicts, fetchWorkflow, fetchSelfChecks, fetchParamItems, fetchDemoResults, fetchConflicts } = useAppStore()

  useEffect(() => {
    fetchWorkflow()
    fetchSelfChecks()
    fetchParamItems()
    fetchDemoResults()
    fetchConflicts()
  }, [fetchWorkflow, fetchSelfChecks, fetchParamItems, fetchDemoResults, fetchConflicts])

  const currentStep = workflow?.currentStep ?? 'import'

  const pendingNextActions: ActionItem[] = [
    ...paramItems.filter((p) => p.nextAction).map((p) => ({
      id: p.id,
      name: p.name,
      nextAction: p.nextAction,
      adjudicationNote: p.adjudicationNote,
      lastActor: p.lastActor,
    })),
    ...demoResults.filter((d) => d.nextAction).map((d) => ({
      id: d.id,
      name: d.paramName,
      nextAction: d.nextAction,
      adjudicationNote: d.adjudicationNote,
      lastActor: d.lastActor,
    })),
  ]

  const pendingConflictsItems = conflicts.filter((c) => c.status === 'pending')

  const itemsNeedingAdjudication: ActionItem[] = [
    ...paramItems.filter((p) => p.adjudicationNote && p.nextAction).map((p) => ({
      id: p.id,
      name: p.name,
      nextAction: p.nextAction,
      adjudicationNote: p.adjudicationNote,
      lastActor: p.lastActor,
    })),
    ...demoResults.filter((d) => d.adjudicationNote && d.nextAction).map((d) => ({
      id: d.id,
      name: d.paramName,
      nextAction: d.nextAction,
      adjudicationNote: d.adjudicationNote,
      lastActor: d.lastActor,
    })),
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-1">工作台</h2>
        <p className="text-slate-400 text-sm">序列对齐歌词纠错 — 工作流程总览</p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {steps.map((step) => {
          const isCurrent = currentStep === step.key
          const isCompleted =
            (step.key === 'import' && workflow?.importCompleted) ||
            (step.key === 'counterexample_review' && workflow?.counterexampleReviewCompleted) ||
            (step.key === 'demo_update' && workflow?.demoUpdateCompleted)
          const Icon = step.icon

          return (
            <button
              key={step.key}
              onClick={() => navigate(step.path)}
              className={`relative text-left p-5 rounded-lg border-2 transition-all hover:scale-[1.02] ${
                isCurrent
                  ? 'border-amber-400 bg-slate-800 shadow-lg shadow-amber-400/10'
                  : isCompleted
                  ? 'border-emerald-500/40 bg-slate-800/50'
                  : 'border-slate-700 bg-slate-800/30'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <Icon size={22} className={isCurrent ? 'text-amber-400' : isCompleted ? 'text-emerald-400' : 'text-slate-500'} />
                {isCompleted && <CheckCircle2 size={20} className="text-emerald-400" />}
                {!isCompleted && !isCurrent && <Circle size={20} className="text-slate-600" />}
              </div>
              <div className={`font-medium ${isCurrent ? 'text-amber-400' : isCompleted ? 'text-emerald-400' : 'text-slate-300'}`}>
                {step.label}
              </div>
              {isCurrent && (
                <div className="flex items-center gap-1 mt-2 text-xs text-amber-400">
                  <span>当前步骤</span>
                  <ArrowRight size={12} />
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-slate-800 rounded-lg p-5 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <AlertOctagon size={18} className="text-red-400" />
            <h3 className="text-sm font-medium text-slate-300">待处理警报</h3>
          </div>
          <div className="space-y-3">
            {pendingConflictsItems.length > 0 && (
              <button
                onClick={() => navigate('/counterexamples')}
                className="w-full flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-colors text-left"
              >
                <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-red-400">冲突待裁定</span>
                    <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">{pendingConflictsItems.length}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">前往反例页面处理冲突裁定</div>
                </div>
              </button>
            )}
            {workflow?.pendingReviews && workflow.pendingReviews > 0 && (
              <button
                onClick={() => navigate('/demo')}
                className="w-full flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-colors text-left"
              >
                <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-amber-400">分母为零待复核</span>
                    <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">{workflow.pendingReviews}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">前往演示页面复核异常项</div>
                </div>
              </button>
            )}
            {pendingConflictsItems.length === 0 && (!workflow?.pendingReviews || workflow.pendingReviews === 0) && (
              <div className="text-center py-6 text-slate-500 text-sm">
                <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500/50" />
                暂无待处理警报
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-5 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <ListChecks size={18} className="text-sky-400" />
            <h3 className="text-sm font-medium text-slate-300">下一步操作</h3>
          </div>
          <div className="space-y-2 max-h-[280px] overflow-auto">
            {pendingNextActions.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                <Clock size={28} className="mx-auto mb-2 text-slate-600" />
                暂无待执行操作
              </div>
            ) : (
              pendingNextActions.slice(0, 8).map((item, idx) => (
                <div
                  key={`${item.id}-${idx}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900/50 border border-slate-700/50"
                >
                  <ArrowRight size={14} className="text-sky-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 font-mono truncate">{item.name}</div>
                    <div className="text-xs text-sky-400 truncate">{item.nextAction}</div>
                  </div>
                  {item.lastActor && (
                    <div className="text-xs text-slate-500 flex-shrink-0">{item.lastActor}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {itemsNeedingAdjudication.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-5 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-4">
            <Gavel size={18} className="text-amber-400" />
            <h3 className="text-sm font-medium text-slate-300">裁决跟进事项</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {itemsNeedingAdjudication.slice(0, 4).map((item, idx) => (
              <div
                key={`adj-${item.id}-${idx}`}
                className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-mono text-amber-400 truncate">{item.name}</span>
                  {item.nextAction && (
                    <span className="text-xs text-sky-400 flex items-center gap-1 flex-shrink-0">
                      <ArrowRight size={10} />
                      {item.nextAction}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 line-clamp-2">{item.adjudicationNote}</div>
                {item.lastActor && (
                  <div className="text-xs text-slate-500 mt-2">裁决人: {item.lastActor}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-lg p-5">
        <h3 className="text-sm font-medium text-slate-300 mb-4">自检状态</h3>
        <div className="flex gap-6">
          {Object.entries(checkLabels).map(([type, label]) => {
            const check = selfChecks.find((c) => c.type === type)
            const status = check?.status
            return (
              <div key={type} className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status ? statusColors[status] : 'bg-slate-600'}`}>
                  {status === 'pass' && <CheckCircle2 size={20} className="text-white" />}
                  {status === 'fail' && <AlertTriangle size={20} className="text-white" />}
                  {status === 'warning' && <AlertTriangle size={20} className="text-white" />}
                  {!status && <Circle size={20} className="text-slate-400" />}
                </div>
                <span className="text-xs text-slate-400 text-center">{label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {workflow && (workflow.pendingConflicts > 0 || workflow.pendingReviews > 0) && (
        <div className="bg-slate-800 rounded-lg p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-3">待处理事项汇总</h3>
          <div className="space-y-2">
            {workflow.pendingConflicts > 0 && (
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle size={16} />
                <span className="text-sm">{workflow.pendingConflicts} 个冲突待裁定</span>
              </div>
            )}
            {workflow.pendingReviews > 0 && (
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle size={16} />
                <span className="text-sm">{workflow.pendingReviews} 个分母为零项待复核</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
