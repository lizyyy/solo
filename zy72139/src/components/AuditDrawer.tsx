import { useScheduleStore, type AuditLogItem } from '@/stores/scheduleStore'
import { X, Clock, User, ArrowRight } from 'lucide-react'
import { useEffect } from 'react'

export default function AuditDrawer() {
  const { showAuditDrawer, setShowAuditDrawer, selectedId, auditLogs, fetchAuditLogs } = useScheduleStore()

  useEffect(() => {
    if (showAuditDrawer && selectedId) {
      fetchAuditLogs(selectedId)
    }
  }, [showAuditDrawer, selectedId, fetchAuditLogs])

  if (!showAuditDrawer) return null

  const formatDate = (d: string) => {
    if (!d) return '—'
    return d.replace('T', ' ').slice(0, 19)
  }

  const fieldLabels: Record<string, string> = {
    '创建': '创建',
    '备注': '备注',
    '状态': '状态',
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
        onClick={() => setShowAuditDrawer(false)}
      />
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-50 flex flex-col animate-slide-in">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg text-slate-800">变更历史</h3>
            <p className="text-xs text-slate-400 mt-0.5">记录 #{selectedId}</p>
          </div>
          <button
            onClick={() => setShowAuditDrawer(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {auditLogs.length === 0 ? (
            <div className="text-center text-slate-400 py-12">
              <Clock size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">暂无变更记录</p>
            </div>
          ) : (
            <div className="space-y-0">
              {auditLogs.map((log: AuditLogItem, idx: number) => (
                <div key={log.id} className="relative pl-6 pb-6">
                  {idx < auditLogs.length - 1 && (
                    <div className="absolute left-[7px] top-5 bottom-0 w-px bg-slate-200" />
                  )}
                  <div className="absolute left-0 top-1 w-[15px] h-[15px] rounded-full bg-amber-100 border-2 border-amber-400" />

                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                        {fieldLabels[log.field] || log.field}
                      </span>
                      <span className="text-xs text-slate-400 ml-auto flex items-center gap-1">
                        <Clock size={10} />
                        {formatDate(log.operated_at)}
                      </span>
                    </div>

                    {log.field === '创建' ? (
                      <p className="text-sm text-slate-600">{log.new_value}</p>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-xs font-mono max-w-[120px] truncate" title={log.old_value}>
                          {log.old_value || '(空)'}
                        </span>
                        <ArrowRight size={12} className="text-slate-300 flex-shrink-0" />
                        <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-xs font-mono max-w-[120px] truncate" title={log.new_value}>
                          {log.new_value || '(空)'}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                      <User size={10} />
                      <span>{log.operator}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.25s ease-out;
        }
      `}</style>
    </>
  )
}
