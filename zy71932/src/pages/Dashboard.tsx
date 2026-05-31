import { useStore } from '@/store'
import { StatusDot } from '@/components/StatusBadge'
import { AlertTriangle, CheckCircle2, Clock, XCircle, ArrowRight, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const { records, operationLogs, colorCards, revokeOperation } = useStore()
  const navigate = useNavigate()

  const confirmed = records.filter((r) => r.status === 'confirmed')
  const pending = records.filter((r) => r.status === 'pending')
  const expired = records.filter((r) => r.status === 'expired')
  const conflict = records.filter((r) => r.status === 'conflict')

  const anomalies = buildAnomalies(records, colorCards)

  const recentLogs = [...operationLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 15)

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">授权总览</h2>
          <p className="text-sm text-zinc-500 mt-1">当前字体授权状态概览与异常告警</p>
        </div>
        <div className="text-xs text-zinc-500 font-mono">
          共 {records.length} 条记录 · {colorCards.length} 张色卡
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="已确认"
          count={confirmed.length}
          color="text-confirm"
          bg="bg-confirm/10"
          onClick={() => navigate('/fonts?status=confirmed')}
        />
        <StatCard
          icon={<Clock size={18} />}
          label="待确认"
          count={pending.length}
          color="text-amber"
          bg="bg-amber/10"
          onClick={() => navigate('/fonts?status=pending')}
        />
        <StatCard
          icon={<XCircle size={18} />}
          label="已过期"
          count={expired.length}
          color="text-danger"
          bg="bg-danger/10"
          onClick={() => navigate('/fonts?status=expired')}
        />
        <StatCard
          icon={<AlertTriangle size={18} />}
          label="冲突"
          count={conflict.length}
          color="text-purple-400"
          bg="bg-purple-500/10"
          onClick={() => navigate('/fonts?status=conflict')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <AlertTriangle size={14} className="text-danger" />
              异常告警
            </h3>
            {anomalies.length > 0 && (
              <span className="badge-expired">{anomalies.length} 项</span>
            )}
          </div>
          <div className="max-h-[320px] overflow-auto">
            {anomalies.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">无异常</div>
            ) : (
              anomalies.map((a, i) => (
                <div
                  key={i}
                  className="px-4 py-3 border-l-2 border-l-danger flex items-start gap-3 hover:bg-surface-100/50 cursor-pointer transition-colors"
                  onClick={() => navigate('/fonts?status=expired')}
                >
                  <div className="mt-0.5">
                    {a.type === 'expired' ? (
                      <XCircle size={14} className="text-danger" />
                    ) : a.type === 'color_mismatch' ? (
                      <AlertTriangle size={14} className="text-purple-400" />
                    ) : (
                      <AlertTriangle size={14} className="text-amber" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-200 font-medium">{a.fontName}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{a.reason}</div>
                  </div>
                  <span className="badge-pending shrink-0">待确认</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="px-4 py-3 border-b border-surface-200">
            <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Clock size={14} className="text-zinc-400" />
              变更时间线
            </h3>
          </div>
          <div className="max-h-[320px] overflow-auto">
            {recentLogs.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">暂无操作记录</div>
            ) : (
              recentLogs.map((log) => {
                const actionMap: Record<string, { icon: React.ReactNode; color: string }> = {
                  import: { icon: <ArrowRight size={12} />, color: 'text-blue-400' },
                  update: { icon: <ArrowRight size={12} />, color: 'text-zinc-400' },
                  confirm: { icon: <CheckCircle2 size={12} />, color: 'text-confirm' },
                  revoke: { icon: <RotateCcw size={12} />, color: 'text-amber' },
                  merge: { icon: <ArrowRight size={12} />, color: 'text-purple-400' },
                  export: { icon: <ArrowRight size={12} />, color: 'text-blue-400' },
                }
                const { icon, color } = actionMap[log.action] || actionMap.update
                return (
                  <div key={log.id} className="px-4 py-2.5 flex items-start gap-3 border-b border-surface-200/50 last:border-0 hover:bg-surface-100/30">
                    <div className={`mt-1 ${color}`}>{icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-zinc-300">{log.detail}</div>
                      <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2">
                        <span className="font-mono">{formatTime(log.timestamp)}</span>
                        <span>·</span>
                        <span>{log.operator}</span>
                      </div>
                    </div>
                    {log.action !== 'revoke' && log.previousValue && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          revokeOperation(log.id)
                        }}
                        className="text-xs text-zinc-500 hover:text-amber transition-colors shrink-0 mt-0.5"
                        title="撤回此操作"
                      >
                        撤回
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  count,
  color,
  bg,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  count: number
  color: string
  bg: string
  onClick: () => void
}) {
  return (
    <div className="card px-4 py-4 cursor-pointer hover:border-surface-300 transition-colors" onClick={onClick}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded ${bg} ${color}`}>{icon}</div>
        <ArrowRight size={14} className="text-zinc-600" />
      </div>
      <div className={`text-2xl font-semibold font-mono ${color}`}>{count}</div>
      <div className="text-xs text-zinc-500 mt-1">{label}</div>
    </div>
  )
}

function buildAnomalies(records: { fontName: string; status: string; expiryDate?: string; colorCardVersion?: string }[], _colorCards: unknown[]) {
  const anomalies: { fontName: string; reason: string; type: string }[] = []
  const now = new Date()

  for (const r of records) {
    if (r.status === 'expired') {
      anomalies.push({ fontName: r.fontName, reason: `授权已过期（${r.expiryDate || '未知'}）`, type: 'expired' })
    }
    if (r.expiryDate) {
      const days = (new Date(r.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      if (days > 0 && days < 30 && r.status !== 'expired') {
        anomalies.push({ fontName: r.fontName, reason: `授权即将于 ${r.expiryDate} 过期`, type: 'expiring' })
      }
    }
    if (r.status === 'conflict') {
      anomalies.push({ fontName: r.fontName, reason: '色卡版本冲突', type: 'color_mismatch' })
    }
    if (!r.expiryDate && r.status !== 'expired') {
      anomalies.push({ fontName: r.fontName, reason: '缺少到期日', type: 'missing' })
    }
  }

  return anomalies
}

function formatTime(ts: string): string {
  const d = new Date(ts)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
