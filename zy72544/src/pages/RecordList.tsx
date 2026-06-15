import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'
import { Link2, AlertTriangle, CheckCircle, ShieldAlert, FileDown, Clock } from 'lucide-react'

export default function RecordList() {
  const records = useStore((s) => s.records)
  const phoneExposures = useStore((s) => s.phoneExposures)
  const knowledgeLinks = useStore((s) => s.knowledgeLinks)
  const feedbackTickets = useStore((s) => s.feedbackTickets)
  const navigate = useNavigate()

  const statusConfig = {
    normal: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: '正常' },
    warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', label: '警示' },
    danger: { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10', label: '漏遮' },
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-slate-100">视频章节自动切分</h2>
        <p className="text-sm text-slate-500 mt-1">审核切分结果、补录知识库链接、管理脱敏导出</p>
      </div>

      <div className="grid gap-5">
        {records.map((record) => {
          const exposures = phoneExposures.filter((e) => e.recordId === record.id)
          const links = knowledgeLinks.filter((l) => l.recordId === record.id)
          const tickets = feedbackTickets.filter((t) => t.recordId === record.id)
          const leakedCount = exposures.filter((e) => e.isLeaked).length
          const cfg = statusConfig[record.status]
          const StatusIcon = cfg.icon

          return (
            <div
              key={record.id}
              className="bg-[#16162a] border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-base font-medium text-slate-100">{record.title}</h3>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                      <StatusIcon size={12} />
                      {cfg.label}
                    </span>
                    <span className="text-xs text-slate-600 bg-slate-800/50 px-2 py-0.5 rounded">
                      {record.chapterType}
                    </span>
                  </div>

                  <div className="flex items-center gap-5 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert size={13} className={leakedCount > 0 ? 'text-red-400' : 'text-slate-500'} />
                      漏遮手机号 <strong className={leakedCount > 0 ? 'text-red-400' : 'text-slate-300'}>{leakedCount}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Link2 size={13} className="text-amber-400" />
                      知识库链接 <strong className="text-amber-400">{links.length}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle size={13} className={tickets.length > 0 ? 'text-amber-400' : 'text-slate-500'} />
                      工单 <strong className={tickets.length > 0 ? 'text-amber-400' : 'text-slate-300'}>{tickets.length}</strong>
                    </span>
                    <span className="text-slate-600">
                      {new Date(record.createdAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => navigate(`/record/${record.id}/supplement`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                  >
                    <Link2 size={13} />
                    补录链接
                  </button>
                  <button
                    onClick={() => navigate('/export')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    <FileDown size={13} />
                    导出
                  </button>
                  <button
                    onClick={() => navigate('/history')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    <Clock size={13} />
                    历史
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
