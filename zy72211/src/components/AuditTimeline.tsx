import { useStore } from '@/store/useStore'
import { User, Clock, ArrowRight } from 'lucide-react'

const actionColors: Record<string, string> = {
  '导入': 'bg-blue-500',
  '补录': 'bg-indigo-500',
  '确认冲突': 'bg-emerald-500',
  '驳回冲突': 'bg-amber-500',
  '风控复核': 'bg-red-500',
}

export default function AuditTimeline() {
  const audits = useStore((s) => s.audits)
  const sorted = [...audits].sort((a, b) => new Date(b.operatedAt).getTime() - new Date(a.operatedAt).getTime())

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p className="text-sm">暂无审核记录</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />
      <div className="space-y-6">
        {sorted.map((audit, i) => (
          <div key={audit.id} className="relative pl-14">
            <div
              className={`absolute left-3.5 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                actionColors[audit.action] || 'bg-slate-400'
              }`}
              style={{ top: '6px' }}
            />
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  {audit.action}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <User size={12} />
                  {audit.operator}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1 ml-auto">
                  <Clock size={12} />
                  {new Date(audit.operatedAt).toLocaleString('zh-CN')}
                </span>
              </div>
              <p className="text-sm text-slate-700 mb-2">{audit.detail}</p>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-medium text-slate-500">原因：</span>
                {audit.reason}
                <ArrowRight size={12} />
                <span className="font-medium text-slate-500">影响：</span>
                {audit.impactResult}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
