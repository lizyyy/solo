import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { History, ArrowLeft } from 'lucide-react'
import AuditTimeline from '@/components/AuditTimeline'

export default function AuditLogPage() {
  const auditLogs = useStore((s) => s.auditLogs)
  const fetchAuditLogs = useStore((s) => s.fetchAuditLogs)

  useEffect(() => {
    fetchAuditLogs(100, 0)
  }, [fetchAuditLogs])

  return (
    <div className="min-h-screen bg-[#0f172a] p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回工作台
          </Link>
          <History className="h-5 w-5 text-amber-400" />
          <h1 className="text-lg font-semibold text-slate-100">审计日志</h1>
          <span className="text-xs text-slate-500">
            全局操作记录，按时间倒序
          </span>
        </div>

        <div className="rounded-lg border border-slate-700/50 bg-[#1e293b] p-6">
          {auditLogs.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              暂无审计日志
            </div>
          ) : (
            <AuditTimeline logs={auditLogs} />
          )}
        </div>
      </div>
    </div>
  )
}
