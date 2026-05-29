import { useEffect } from 'react'
import { Clock, ArrowRight } from 'lucide-react'
import { useStore } from '@/store'

export default function Reschedule() {
  const { rescheduleLogs, loading, fetchAll } = useStore()

  useEffect(() => { if (rescheduleLogs.length === 0) fetchAll() }, [])

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold text-slate2-700">改期记录</h2>
        <span className="bg-clay-50 text-clay-600 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1.5">
          <Clock className="w-4 h-4" /> 共 {rescheduleLogs.length} 条
        </span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate2-400">加载中…</div>
      ) : rescheduleLogs.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="w-12 h-12 mx-auto text-clay-200 mb-3" />
          <p className="text-slate2-400">暂无改期记录</p>
        </div>
      ) : (
        <div className="relative pl-8">
          <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-clay-200" />

          <div className="space-y-8">
            {rescheduleLogs.map(log => (
              <div key={log.id} className="relative">
                <div className="absolute -left-8 top-1 w-5 h-5 rounded-full bg-clay-400 border-4 border-clay-50" />

                <div className="card p-5">
                  <h3 className="font-serif font-semibold text-slate2-700 mb-2">{log.work_name || log.work_id}</h3>

                  <div className="flex items-center gap-2 text-sm mb-2">
                    <span className="bg-clay-50 text-clay-600 px-2 py-0.5 rounded text-xs font-medium">{log.from_batch_name || log.from_batch_id}</span>
                    <ArrowRight className="w-4 h-4 text-clay-300" />
                    <span className="bg-kiln-50 text-kiln-500 px-2 py-0.5 rounded text-xs font-medium">
                      {log.to_batch_name || '待重新排队'}
                    </span>
                  </div>

                  {log.reason && (
                    <p className="text-sm text-slate2-500 mb-2">{log.reason}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-slate2-400">
                    <span>{log.operated_by}</span>
                    <span>·</span>
                    <span>{formatTime(log.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
