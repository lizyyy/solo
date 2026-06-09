import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle, BarChart3, Upload, Sliders, FileText, Clock, Shield, FileDown } from 'lucide-react'
import { useStore } from '@/store'

function StatCard({ icon: Icon, label, value, color, pulse, onClick, sub }: { icon: any; label: string; value: number; color: string; pulse?: boolean; onClick?: () => void; sub?: string }) {
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
    <div
      onClick={onClick}
      className={`bg-slate-800/50 backdrop-blur rounded-xl border ${colorMap[color]} p-5 ${pulse ? 'animate-pulse-amber' : ''} transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/20 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center gap-3">
        <Icon size={24} className={iconColorMap[color]} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-400">{label}</p>
          <p className={`text-2xl font-bold ${iconColorMap[color]}`}>{value}</p>
        </div>
      </div>
      {sub && (
        <p className="text-xs text-slate-500 mt-2">{sub}</p>
      )}
    </div>
  )
}

function QuickAction({ icon: Icon, label, to, color, onClick }: { icon: any; label: string; to?: string; color: string; onClick?: () => void }) {
  const iconBg: Record<string, string> = {
    amber: 'bg-amber-500/10 text-amber-500',
    green: 'bg-emerald-500/10 text-emerald-500',
    blue: 'bg-blue-500/10 text-blue-400',
    slate: 'bg-slate-500/10 text-slate-400',
  }
  const content = (
    <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-5 flex items-center gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/20 hover:border-slate-600/50 h-full">
      <div className={`w-12 h-12 rounded-lg ${iconBg[color]} flex items-center justify-center`}>
        <Icon size={24} />
      </div>
      <span className="text-slate-200 font-medium">{label}</span>
    </div>
  )
  if (onClick) {
    return <div onClick={onClick} className="cursor-pointer">{content}</div>
  }
  return <Link to={to!}>{content}</Link>
}

const actionHumanReadable: Record<string, (op: string) => string> = {
  import: (op) => `${op} 导入了抽样名单`,
  update: (op) => `${op} 更新了参数`,
  confirm: (op) => `${op} 确认了边界样本`,
  ignore: (op) => `${op} 忽略了边界样本`,
  rollback: (op) => `${op} 回滚了一条记录`,
  update_remark: (op) => `${op} 修改了备注`,
  correct_value: (op) => `${op} 修正了样本值`,
  boundary_detected: (op) => `系统检测到边界样本`,
}

export default function Dashboard() {
  const { calculationSummary, boundarySamples, changeLog, fetchCalculation, fetchBoundarySamples, fetchChangeLog, exportCalculation } = useStore()
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
        <StatCard
          icon={AlertTriangle}
          label="待处理边界样本"
          value={pendingCount}
          color="amber"
          pulse={pendingCount > 0}
          onClick={() => navigate('/boundary?status=pending')}
          sub={pendingCount > 0 ? '这些记录不会自动处理，请教研负责人吴老师确认。下一步找谁：教研负责人吴老师' : '暂无待处理事项'}
        />
        <StatCard icon={CheckCircle} label="已确认样本" value={confirmedCount} color="green" />
        <StatCard icon={BarChart3} label="总计算结果" value={totalResults} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-title)' }}>
            <Clock size={18} className="text-slate-400" />
            最近操作流
          </h3>
          <div className="space-y-3">
            {changeLog.length === 0 ? (
              <p className="text-slate-500 text-sm">暂无操作记录</p>
            ) : (
              changeLog.slice(0, 10).map(entry => {
                const humanFn = actionHumanReadable[entry.action]
                const text = humanFn ? humanFn(entry.operator) : `${entry.operator} 执行了 ${entry.action}`
                return (
                  <div key={entry.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 truncate">
                        {text}
                        {entry.field && <span className="text-slate-500 ml-1">({entry.field})</span>}
                      </p>
                      <p className="text-slate-500 text-xs">{new Date(entry.timestamp).toLocaleString('zh-CN')}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-200" style={{ fontFamily: 'var(--font-title)' }}>快捷入口</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <QuickAction icon={Upload} label="导入抽样名单" to="/sampling" color="amber" />
            <QuickAction icon={Sliders} label="参数调试" to="/params" color="green" />
            <QuickAction icon={FileText} label="查看报告" to="/calculation" color="blue" />
            <QuickAction icon={FileDown} label="导出计算明细报告" color="slate" onClick={exportCalculation} />
          </div>
          <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-amber-500/20 p-4 mt-4">
            <div className="flex items-start gap-3">
              <Shield size={20} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-slate-300 font-medium mb-1">工作流提示</p>
                <p className="text-slate-500 text-xs">
                  待处理边界样本需教研负责人吴老师确认后才会生效。如待处理数量不为 0，请尽快前往 <Link to="/boundary?status=pending" className="text-amber-500 hover:underline">边界样本报告</Link> 处理。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
