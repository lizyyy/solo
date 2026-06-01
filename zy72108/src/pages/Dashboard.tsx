import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle, Clock, FileWarning, ChevronRight } from 'lucide-react'
import { useReviewStore } from '@/store'

const STATUS_LABEL: Record<string, string> = {
  pending: '待复核',
  reviewing: '复核中',
  passed: '已通过',
  anomaly: '异常',
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'status-pending',
  reviewing: 'status-reviewing',
  passed: 'status-passed',
  anomaly: 'status-anomaly',
}

const SEVERITY_STYLE: Record<string, { bar: string; text: string }> = {
  conflict: { bar: 'bg-data-warning', text: 'text-data-warning' },
  anomaly: { bar: 'bg-data-anomaly', text: 'text-data-anomaly' },
}

export default function Dashboard() {
  const { batches, currentThreshold } = useReviewStore()
  const navigate = useNavigate()
  const threshold = currentThreshold()

  const pendingCount = batches.filter((b) => b.status === 'pending' || b.status === 'reviewing').length
  const passedCount = batches.filter((b) => b.status === 'passed').length
  const anomalyCount = batches.filter((b) => b.status === 'anomaly').length

  const anomalyLogs = batches
    .flatMap((b) =>
      b.auditLogs
        .filter((l) => l.action.includes('异常') || l.action.includes('冲突'))
        .map((l) => ({ ...l, batchName: b.name }))
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8)

  const recentBatches = [...batches]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  const statusCards = [
    { label: '待复核', count: pendingCount, icon: Clock, iconCls: 'text-data-warning', numCls: 'text-data-warning', bgCls: 'bg-data-warning/10', borderCls: 'border-data-warning/30' },
    { label: '已通过', count: passedCount, icon: CheckCircle, iconCls: 'text-data-normal', numCls: 'text-data-normal', bgCls: 'bg-data-normal/10', borderCls: 'border-data-normal/30' },
    { label: '异常', count: anomalyCount, icon: AlertTriangle, iconCls: 'text-data-anomaly', numCls: 'text-data-anomaly', bgCls: 'bg-data-anomaly/10', borderCls: 'border-data-anomaly/30' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">
          小提琴琴弦张力复核 · 仪表盘
        </h1>
        <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-brand/15 text-brand-light border border-brand/30">
          阈值 {threshold.version}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {statusCards.map((card) => (
          <div key={card.label} className={`card ${card.bgCls} border ${card.borderCls} rounded-xl p-5`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-400">{card.label}</span>
              <card.icon className={`w-5 h-5 ${card.iconCls}`} />
            </div>
            <p className={`text-4xl font-mono font-bold ${card.numCls}`}>{card.count}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 card rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <FileWarning className="w-4 h-4 text-data-anomaly" />
            近期异常与冲突
          </h2>
          {anomalyLogs.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">暂无异常记录</p>
          ) : (
            <div className="space-y-2">
              {anomalyLogs.map((log) => {
                const style = log.action.includes('冲突') ? SEVERITY_STYLE.conflict : SEVERITY_STYLE.anomaly
                return (
                  <div key={log.id} className="flex gap-3 rounded-lg bg-surface-raised/60 border border-surface-border p-3">
                    <div className={`w-1 shrink-0 rounded-full ${style.bar}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${style.text}`}>{log.action}</span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {new Date(log.timestamp).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{log.reason}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{log.batchName}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="col-span-2 card rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-light" />
            近期批次
          </h2>
          <div className="space-y-2">
            {recentBatches.map((batch) => (
              <div
                key={batch.id}
                onClick={() => navigate(`/review/${batch.id}`)}
                className="flex items-center gap-3 rounded-lg bg-surface-raised/60 border border-surface-border p-3 cursor-pointer hover:border-brand/40 hover:bg-surface-overlay/50 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-200 truncate">{batch.name}</p>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                    {new Date(batch.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[batch.status]}`}>
                  {STATUS_LABEL[batch.status]}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-brand transition-colors" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
