import { Link } from 'react-router-dom'
import {
  Syringe,
  Gauge,
  History,
  MessageCircleQuestion,
  ExternalLink,
  Check,
  Calendar,
} from 'lucide-react'
import type { ExceptionItem, ExceptionType } from '@shared/types'
import { cn } from '@/lib/utils'

interface QueueCardProps {
  item: ExceptionItem
  onAck: (id: string) => void
}

const TYPE_META: Record<
  ExceptionType,
  { label: string; Icon: typeof Syringe; bar: string; iconBg: string; iconCls: string }
> = {
  vaccine_missing: {
    label: '疫苗缺失',
    Icon: Syringe,
    bar: 'bg-rose-500',
    iconBg: 'bg-rose-50',
    iconCls: 'text-rose-600',
  },
  boundary_sample: {
    label: '边界样本',
    Icon: Gauge,
    bar: 'bg-amber-500',
    iconBg: 'bg-amber-50',
    iconCls: 'text-amber-600',
  },
  legacy_curve: {
    label: '旧版曲线',
    Icon: History,
    bar: 'bg-slate-500',
    iconBg: 'bg-slate-100',
    iconCls: 'text-slate-600',
  },
  pending_reason: {
    label: '待确认理由',
    Icon: MessageCircleQuestion,
    bar: 'bg-indigo-500',
    iconBg: 'bg-indigo-50',
    iconCls: 'text-indigo-600',
  },
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
}

export default function QueueCard({ item, onAck }: QueueCardProps) {
  const meta = TYPE_META[item.type]
  const Icon = meta.Icon
  const acknowledged = item.status !== 'open'

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
      <span className={cn('absolute inset-y-0 left-0 w-1', meta.bar)} />

      <div className="flex items-start gap-3 px-5 pt-4 pb-2 pl-6">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            meta.iconBg,
            meta.iconCls,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                meta.iconBg,
                meta.iconCls,
              )}
            >
              {meta.label}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.reason}</p>
          <div className="mt-2 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] italic text-slate-500 ring-1 ring-slate-100">
            💡 处理建议：{item.suggestion}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-slate-100 px-5 py-3 pl-6">
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
          <Calendar className="h-3 w-3" />
          创建于 {formatTime(item.createdAt)}
        </span>
        <div className="flex items-center gap-1.5">
          <Link
            to={`/records/${item.recordId}`}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            查看记录
          </Link>
          {acknowledged ? (
            <div className="inline-flex flex-col items-end gap-0.5 rounded-lg bg-slate-100 px-2.5 py-1">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                <Check className="h-3.5 w-3.5" />
                已处理
              </span>
              {item.acknowledgedAt && (
                <span className="text-[10px] text-slate-400">
                  {item.acknowledgedBy ?? '未知'} · {formatTime(item.acknowledgedAt)}
                </span>
              )}
            </div>
          ) : (
            <button
              onClick={() => onAck(item.id)}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition-colors',
                'bg-slate-900 hover:bg-slate-800',
              )}
            >
              <Check className="h-3.5 w-3.5" />
              确认处理
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
