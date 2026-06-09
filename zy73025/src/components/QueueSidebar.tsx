import { Syringe, Gauge, History, MessageCircleQuestion } from 'lucide-react'
import type { ExceptionItem, ExceptionType } from '@shared/types'
import { cn } from '@/lib/utils'

interface QueueSidebarProps {
  queue: ExceptionItem[]
  selectedType?: ExceptionType | null
  onSelectType: (type: ExceptionType | null) => void
}

const TYPE_META: Record<
  ExceptionType,
  { label: string; Icon: typeof Syringe; cls: string; bar: string }
> = {
  vaccine_missing: {
    label: '疫苗缺失',
    Icon: Syringe,
    cls: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200',
    bar: 'bg-rose-500',
  },
  boundary_sample: {
    label: '边界样本',
    Icon: Gauge,
    cls: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200',
    bar: 'bg-amber-500',
  },
  legacy_curve: {
    label: '旧版曲线',
    Icon: History,
    cls: 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200',
    bar: 'bg-slate-500',
  },
  pending_reason: {
    label: '待确认理由',
    Icon: MessageCircleQuestion,
    cls: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200',
    bar: 'bg-indigo-500',
  },
}

export default function QueueSidebar({ queue, selectedType, onSelectType }: QueueSidebarProps) {
  const counts = queue.reduce(
    (acc, item) => {
      acc[item.type] = (acc[item.type] ?? 0) + 1
      return acc
    },
    {} as Record<ExceptionType, number>,
  )

  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <aside className="flex h-screen w-[260px] shrink-0 flex-col border-l border-slate-200 bg-slate-50/60">
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">异常队列</h2>
        <p className="mt-0.5 text-xs text-slate-500">共 {total} 条待处理</p>
      </div>

      <div className="flex-1 space-y-2.5 p-3 overflow-y-auto">
        {(Object.keys(TYPE_META) as ExceptionType[]).map((type) => {
          const meta = TYPE_META[type]
          const count = counts[type] ?? 0
          const isSelected = selectedType === type
          const Icon = meta.Icon

          return (
            <button
              key={type}
              onClick={() => onSelectType(isSelected ? null : type)}
              className={cn(
                'group relative w-full overflow-hidden rounded-xl border p-3 text-left transition-all',
                isSelected
                  ? cn(meta.cls, 'ring-2 ring-offset-1')
                  : cn(meta.cls, 'opacity-80 hover:opacity-100'),
              )}
            >
              <span className={cn('absolute inset-y-0 left-0 w-1', meta.bar)} />
              <div className="flex items-center justify-between gap-3 pl-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/70">
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <span className="text-sm font-medium">{meta.label}</span>
                </div>
                <span
                  className={cn(
                    'inline-flex min-w-[28px] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold',
                    count > 0 ? 'bg-white/80' : 'bg-white/40',
                  )}
                >
                  {count}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
