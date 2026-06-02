import type { TrialRecord } from '@/types'
import { Shield, AlertTriangle, FilePlus, CheckCircle } from 'lucide-react'

const statusConfig: Record<TrialRecord['status'], { bg: string; border: string; text: string; icon: React.ElementType }> = {
  '正常': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: CheckCircle },
  '已冲正': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: AlertTriangle },
  '尾差补录': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: FilePlus },
  '待风控复核': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: Shield },
}

export default function RecordCard({ record }: { record: TrialRecord }) {
  const cfg = statusConfig[record.status]
  const Icon = cfg.icon

  return (
    <div
      className={`rounded-xl border ${cfg.border} ${cfg.bg} p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-default`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={18} className={cfg.text} />
          <h3 className="font-semibold text-slate-800 text-sm">{record.name}</h3>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}
        >
          {record.status}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-slate-400 text-xs mb-0.5">金额</p>
          <p className="font-mono font-semibold text-slate-800">
            ¥{record.amount.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-slate-400 text-xs mb-0.5">来源</p>
          <p className="text-slate-700">{record.source}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs mb-0.5">口径</p>
          <p className={record.caliber === '旧口径' ? 'text-amber-600 font-medium' : 'text-slate-700'}>
            {record.caliber}
          </p>
        </div>
      </div>
      {record.remark && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            <span className="font-medium">备注：</span>
            {record.remark}
          </p>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>创建：{new Date(record.createdAt).toLocaleString('zh-CN')}</span>
        <span>更新：{new Date(record.updatedAt).toLocaleString('zh-CN')}</span>
      </div>
    </div>
  )
}
