import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle, BarChart3, Upload, Sliders, FileText, Clock } from 'lucide-react'
import { useStore } from '@/store'

function StatCard({ icon: Icon, label, value, color, pulse }: { icon: any; label: string; value: number; color: string; pulse?: boolean }) {
  const colorMap: Record<string, string> = {
    amber: 'border-amber-500/30 bg-amber-500/5',
    green: 'border-emerald-500/30 bg-emerald-500/5',
    blue: 'border-blue-500/30 bg-blue-500/5',
  }
  const iconColorMap: Record<string, string> = {
    amber: 'text-amber-500',
    green: 'text-emerald-500',
    blue: 'text-blue-500',
  }
  return (
    <div className={`bg-slate-800/50 backdrop-blur rounded-xl border ${colorMap[color]} p-5 ${pulse ? 'animate-pulse-amber' : ''} transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/20`}>
      <div className="flex items-center gap-3">
        <Icon size={24} className={iconColorMap[color]} />
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className={`text-2xl font-bold ${iconColorMap[color]}`}>{value}</p>
        </div>
      </div>
    </div>
  )
}

function QuickAction({ icon: Icon, label, to, color }: { icon: any; label: string; to: string; color: string }) {
  const iconBg: Record<string, string> = {
    amber: 'bg-amber-500/10 text-amber-500',
    green: 'bg-emerald-500/10 text-emerald-500',
    blue: 'bg-blue-500/10 text-blue-500',
  }
  return (
    <Link to={to} className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-5 flex items-center gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/20 hover:border-slate-600/50">
      <div className={`w-12 h-12 rounded-lg ${iconBg[color]} flex items-center justify-center`}>
        <Icon size={24} />
      </div>
      <span className="text-slate-200 font-medium">{label}</span>
    </Link>
  )
}

const actionLabels: Record<string, string> = {
  import: '导入抽样名单',
  update: '更新参数',
  confirm: '确认边界样本',
  ignore: '忽略边界样本',
  rollback: '回滚变更',
}

export default function Dashboard() {
  const { calculationSummary, boundarySamples, changeLog, fetchCalculation, fetchBoundarySamples, fetchChangeLog } = useStore()
  const navigate = useNavigate()

  useEffect(() => {
    fetchCalculation()
    fetchBoundarySamples('pending')
    fetchChangeLog()
  }, [])

  const pendingCount = boundarySamples.filter(b => b.status === 'pending').length
  const confirmedCount = boundarySamples.filter(b => b.status === 'confirmed').length
  const totalResults = calculationSummary?.totalSamples ?? 0

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100" style={{ fontFamily: 'var(--font-title)' }}>系统概览</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={AlertTriangle} label="待处理边界样本" value={pendingCount} color="amber" pulse={pendingCount > 0} />
        <StatCard icon={CheckCircle} label="已确认样本" value={confirmedCount} color="green" />
        <StatCard icon={BarChart3} label="总计算结果" value={totalResults} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-title)' }}>
            <Clock size={18} className="text-slate-400" />
            最近操作
          </h3>
          <div className="space-y-3">
            {changeLog.length === 0 ? (
              <p className="text-slate-500 text-sm">暂无操作记录</p>
            ) : (
              changeLog.slice(0, 10).map(entry => (
                <div key={entry.id} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 truncate">
                      <span className="text-slate-400">[{entry.operator}]</span> {actionLabels[entry.action] || entry.action} - {entry.entityType}/{entry.entityId.slice(0, 8)}
                    </p>
                    <p className="text-slate-500 text-xs">{new Date(entry.timestamp).toLocaleString('zh-CN')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-200" style={{ fontFamily: 'var(--font-title)' }}>快捷操作</h3>
          <div className="space-y-3">
            <QuickAction icon={Upload} label="导入抽样名单" to="/sampling" color="amber" />
            <QuickAction icon={Sliders} label="参数调试" to="/params" color="green" />
            <QuickAction icon={FileText} label="查看报告" to="/calculation" color="blue" />
          </div>
        </div>
      </div>
    </div>
  )
}
