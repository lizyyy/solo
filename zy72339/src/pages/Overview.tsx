import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'
import StatusBadge from '@/components/StatusBadge'
import { FileInput, ClipboardCheck, Calculator, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RecordType } from '@/types'

export default function Overview() {
  const courses = useStore(s => s.courses)
  const steps = useStore(s => s.steps)
  const calculations = useStore(s => s.calculations)
  const navigate = useNavigate()

  const typeCounts: Record<RecordType, number> = { smooth: 0, mixed: 0, supplement: 0 }
  for (const c of courses) {
    typeCounts[c.recordType]++
  }

  const typeLabels: Record<RecordType, { label: string; desc: string; color: string; icon: React.ElementType }> = {
    smooth: {
      label: '顺利记录',
      desc: '权重格式统一，直接计算通过',
      color: 'border-emerald-200 bg-emerald-50/50',
      icon: FileInput,
    },
    mixed: {
      label: '混合格式记录',
      desc: '百分数与小数混出，待活动负责人复核',
      color: 'border-amber-200 bg-amber-50/50',
      icon: ClipboardCheck,
    },
    supplement: {
      label: '旧口径补录记录',
      desc: '从评分权重表补来旧口径数据',
      color: 'border-sky-200 bg-sky-50/50',
      icon: Calculator,
    },
  }

  const stepIcons = [FileInput, ClipboardCheck, Calculator]

  const hasCalc = calculations.length > 0

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
          PageRank 站内推荐
        </h1>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          这是教研负责人吴老师用来给新人讲流程的演示系统。跑一遍就能看到三种处理结果的区别：
          顺利的怎么过、百分数小数混着出的怎么等复核、旧口径补录的怎么算。
        </p>
      </div>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          三步流程
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {steps.map((step, idx) => {
            const Icon = stepIcons[idx]
            const isActive = step.status === 'active'
            const isCompleted = step.status === 'completed'
            return (
              <button
                key={step.key}
                onClick={() => navigate(step.path)}
                disabled={step.status === 'pending'}
                className={cn(
                  'group flex flex-col items-start rounded-xl border p-5 text-left transition-all',
                  isActive && 'border-orange-300 bg-orange-50/50 shadow-sm ring-1 ring-orange-200',
                  isCompleted && 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60',
                  step.status === 'pending' && 'border-slate-100 bg-slate-50/50 opacity-50 cursor-not-allowed'
                )}
              >
                <div className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg',
                  isActive && 'bg-orange-100 text-orange-600',
                  isCompleted && 'bg-emerald-100 text-emerald-600',
                  step.status === 'pending' && 'bg-slate-100 text-slate-400'
                )}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <span className={cn(
                  'mt-3 text-sm font-semibold',
                  isActive && 'text-orange-700',
                  isCompleted && 'text-emerald-700',
                  step.status === 'pending' && 'text-slate-400'
                )}>
                  {idx + 1}. {step.label}
                </span>
                <span className="mt-1 text-xs text-slate-400 leading-snug">
                  {step.description}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          演示数据概览
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {(Object.keys(typeLabels) as RecordType[]).map(type => {
            const cfg = typeLabels[type]
            const Icon = cfg.icon
            const typeCourses = courses.filter(c => c.recordType === type)
            return (
              <div key={type} className={cn('rounded-xl border p-5', cfg.color)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-semibold text-slate-700">{cfg.label}</span>
                  </div>
                  <StatusBadge type="recordType" value={type} />
                </div>
                <p className="mt-2 text-xs text-slate-500 leading-snug">{cfg.desc}</p>
                <div className="mt-3 space-y-1">
                  {typeCourses.map(c => (
                    <div key={c.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{c.name}</span>
                      {hasCalc && (
                        <span className="font-mono text-slate-500">
                          {calculations.find(r => r.courseId === c.id)?.score ?? '—'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  共 {typeCounts[type]} 条
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-sm text-slate-400">
        <span>跟着左侧步骤走一遍，从</span>
        <button
          onClick={() => navigate('/import')}
          className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium"
        >
          边界值说明导入
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <span>开始</span>
      </div>
    </div>
  )
}
