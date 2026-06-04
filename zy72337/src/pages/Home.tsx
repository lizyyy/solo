import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, AlertTriangle, ArrowRight, Sliders, FileText, Presentation } from 'lucide-react'
import { useAppStore } from '@/store'

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
  const { workflow, selfChecks, fetchWorkflow, fetchSelfChecks } = useAppStore()

  useEffect(() => {
    fetchWorkflow()
    fetchSelfChecks()
  }, [fetchWorkflow, fetchSelfChecks])

  const currentStep = workflow?.currentStep ?? 'import'

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
          <h3 className="text-sm font-medium text-slate-300 mb-3">待处理事项</h3>
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
