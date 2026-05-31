import type { ChangeRecord } from '@shared/types'
import { ArrowRight } from 'lucide-react'

interface ChangeTimelineProps {
  records: ChangeRecord[]
}

const FIELD_LABELS: Record<string, string> = {
  totalTip: '打赏总额',
  refundAmount: '退款金额',
  shareRate: '分成比例',
  settlementAmount: '结算金额',
  status: '状态',
}

export default function ChangeTimeline({ records }: ChangeTimelineProps) {
  if (records.length === 0) {
    return <p className="text-stone-400 text-sm">暂无变更记录</p>
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-0 bottom-0 w-px bg-stone-200" />
      {records.map((r, i) => (
        <div key={r.id} className="relative pb-4 last:pb-0">
          <div className="absolute -left-[17px] top-1 h-3 w-3 rounded-full border-2 border-[#1e3a5f] bg-white" />
          <div className="bg-stone-50 border border-stone-200 p-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-stone-700">
                {FIELD_LABELS[r.field] || r.field}
              </span>
              <span className="text-stone-500">
                {r.oldValue ?? <em className="text-red-500">空</em>}
              </span>
              <ArrowRight className="h-3 w-3 text-stone-400" />
              <span className="font-medium text-[#1e3a5f]">{r.newValue}</span>
            </div>
            <div className="mt-1 text-xs text-stone-500">
              原因：{r.reason}
            </div>
            <div className="mt-1 text-xs text-stone-400">
              {r.operator} · {new Date(r.createdAt).toLocaleString('zh-CN')}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
