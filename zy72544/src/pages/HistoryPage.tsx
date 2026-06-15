import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'
import {
  Link2,
  FileDown,
  Pencil,
  RefreshCw,
  Trash2,
  ArrowRight,
  Clock,
  ShieldAlert,
} from 'lucide-react'

const actionConfig = {
  link_added: { icon: Link2, label: '补录链接', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  link_note_edited: { icon: Pencil, label: '编辑备注', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  link_removed: { icon: Trash2, label: '移除链接', color: 'text-red-400', bg: 'bg-red-500/10' },
  export_regenerated: { icon: RefreshCw, label: '重新生成导出', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  review_status_changed: { icon: ShieldAlert, label: '复核状态变更', color: 'text-purple-400', bg: 'bg-purple-500/10' },
}

export default function HistoryPage() {
  const records = useStore((s) => s.records)
  const history = useStore((s) => s.history)
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const navigate = useNavigate()

  const getRecordTitle = (recordId: string) => {
    const r = records.find((rec) => rec.id === recordId)
    return r ? r.title : recordId
  }

  const grouped = history.reduce<Record<string, typeof history>>((acc, entry) => {
    const date = new Date(entry.timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(entry)
    return acc
  }, {})

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-slate-100">变更历史</h2>
        <p className="text-sm text-slate-500 mt-1">查看改前改后差异、参数版本和取舍理由</p>
      </div>

      <div className="space-y-8">
        {Object.entries(grouped).map(([date, entries]) => (
          <div key={date}>
            <div className="flex items-center gap-3 mb-4">
              <Clock size={14} className="text-slate-600" />
              <span className="text-xs font-medium text-slate-500">{date}</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            <div className="space-y-3 ml-4 border-l-2 border-slate-800 pl-6">
              {entries.map((entry) => {
                const cfg = actionConfig[entry.action as keyof typeof actionConfig] ?? actionConfig.link_added
                const Icon = cfg.icon

                return (
                  <div key={entry.id} className="relative">
                    <div className={`absolute -left-[31px] top-3 w-3 h-3 rounded-full ${cfg.bg} border-2 border-[#0f0f1a]`} />

                    <div className="bg-[#16162a] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                            <Icon size={12} />
                            {cfg.label}
                          </span>
                          <span className="text-xs text-slate-600">
                            {getRecordTitle(entry.recordId)}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-600">
                          {new Date(entry.timestamp).toLocaleTimeString('zh-CN')}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        {entry.oldValue && (
                          <span className="px-2 py-1 bg-red-500/5 border border-red-500/10 rounded text-red-400 text-xs line-through">
                            {entry.oldValue}
                          </span>
                        )}
                        {entry.oldValue && entry.newValue && (
                          <ArrowRight size={12} className="text-slate-600 shrink-0" />
                        )}
                        {entry.newValue && (
                          <span className="px-2 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded text-emerald-400 text-xs">
                            {entry.newValue}
                          </span>
                        )}
                        {!entry.oldValue && !entry.newValue && (
                          <span className="text-xs text-slate-500">无内容变更</span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-600">
                        <span>操作人: {entry.operator}</span>
                        {entry.paramVersion && (
                          <span className="font-mono">参数: {entry.paramVersion}</span>
                        )}
                        {entry.tradeoffReason && (
                          <span>取舍: {entry.tradeoffReason}</span>
                        )}
                      </div>

                      {entry.action === 'export_regenerated' && (
                        <button
                          onClick={() => navigate('/export')}
                          className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-400/70 hover:text-amber-400 transition-colors"
                        >
                          <FileDown size={10} />
                          查看导出内容
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {history.length === 0 && (
          <div className="text-center py-12 text-sm text-slate-600">暂无变更历史</div>
        )}
      </div>
    </div>
  )
}
