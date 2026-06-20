import { Link } from 'react-router-dom'
import { Upload, FileText, AlertTriangle, ArrowRight, CalendarDays } from 'lucide-react'
import StatsGrid from '../components/StatsGrid'
import OnboardingSidebar from '../components/OnboardingSidebar'
import { useReconcileStore } from '../store/useReconcileStore'
import { SCHEDULE_STATUS_LABEL } from '../types'
import { formatDateCN } from '../utils/helpers'

export default function Dashboard() {
  const schedules = useReconcileStore((s) => s.schedules)
  const anomalies = useReconcileStore((s) => s.anomalies)
  const stats = useReconcileStore((s) => s.stats)
  const loading = useReconcileStore((s) => s.loading)

  const recentSchedules = [...schedules]
    .sort((a, b) => b.course_date.localeCompare(a.course_date))
    .slice(0, 4)

  const anomalyCount = anomalies.length
  const scheduleAnomalies = anomalies.filter((a) => a.kind === 'schedule')

  return (
    <div className="flex gap-6 p-6">
      <div className="flex-1 min-w-0 space-y-6">
        <StatsGrid />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/import" className="card hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
                <Upload size={22} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-warm-800">导入训练课 CSV</p>
                <p className="text-xs text-warm-500 mt-0.5">上传排程表自动识别别名</p>
              </div>
              <ArrowRight size={16} className="text-warm-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link to="/import" className="card hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-success-100 text-success-700 flex items-center justify-center">
                <FileText size={22} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-warm-800">录入手写病历</p>
                <p className="text-xs text-warm-500 mt-0.5">带一条正常记录样例</p>
              </div>
              <ArrowRight size={16} className="text-warm-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link to="/anomalies" className="card hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                anomalyCount > 0 ? 'bg-danger-100 text-danger-700 animate-pulse-soft' : 'bg-warm-100 text-warm-500'
              }`}>
                <AlertTriangle size={22} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-warm-800">异常别名追踪</p>
                <p className="text-xs text-warm-500 mt-0.5">
                  {anomalyCount > 0 ? `${anomalyCount} 条待处理` : '暂无异常'}
                </p>
              </div>
              <ArrowRight size={16} className="text-warm-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-title mb-0">最近排程</h3>
            <Link to="/schedules" className="text-sm text-brand-600 hover:underline flex items-center gap-1">
              查看全部 <ArrowRight size={14} />
            </Link>
          </div>
          {loading && !schedules.length ? (
            <p className="text-warm-400 text-sm py-4">加载中...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-warm-500 border-b border-warm-200">
                    <th className="text-left py-2 font-medium">宠物名</th>
                    <th className="text-left py-2 font-medium">课程</th>
                    <th className="text-left py-2 font-medium">日期</th>
                    <th className="text-left py-2 font-medium">状态</th>
                    <th className="text-left py-2 font-medium">训导师</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSchedules.map((s) => (
                    <tr key={s.id} className="border-b border-warm-100 last:border-b-0">
                      <td className="py-2.5 font-medium text-warm-800">{s.pet_name}</td>
                      <td className="py-2.5 text-warm-600">{s.course_name}</td>
                      <td className="py-2.5 text-warm-500">{formatDateCN(s.course_date)}</td>
                      <td className="py-2.5">
                        <span className={`tag-${s.status} tag`}>
                          {SCHEDULE_STATUS_LABEL[s.status]}
                        </span>
                      </td>
                      <td className="py-2.5 text-warm-500">{s.trainer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="card-title flex items-center gap-2">
              <AlertTriangle size={18} className="text-danger-500" />
              别名冲突摘要
            </h3>
            {scheduleAnomalies.length === 0 ? (
              <p className="text-warm-400 text-sm">暂无别名冲突</p>
            ) : (
              <div className="space-y-2">
                {scheduleAnomalies.slice(0, 3).map((a) => {
                  const rec = a.record
                  return (
                    <Link
                      key={a.kind + (rec as { id: number }).id}
                      to="/anomalies"
                      className="block p-3 rounded-lg bg-danger-50 hover:bg-danger-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-danger-800">
                          {(rec as { pet_name: string }).pet_name}
                        </span>
                        <span className="text-xs text-danger-600">
                          影响 {a.impact.length} 条相关记录
                        </span>
                      </div>
                      <p className="text-xs text-danger-600 mt-1">
                        {(rec as { anomaly_reason?: string }).anomaly_reason || '别名未绑定'}
                      </p>
                    </Link>
                  )
                })}
              </div>
            )}
            <Link
              to="/anomalies"
              className="mt-3 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
            >
              去处理所有异常 →
            </Link>
          </div>

          <div className="card">
            <h3 className="card-title flex items-center gap-2">
              <CalendarDays size={18} className="text-brand-600" />
              快速操作
            </h3>
            <div className="space-y-2">
              <Link
                to="/schedules"
                className="block p-3 rounded-lg bg-brand-50 hover:bg-brand-100 transition-colors"
              >
                <p className="font-medium text-brand-800">处理待确认排程</p>
                <p className="text-xs text-brand-600 mt-0.5">
                  还有 {stats?.pending ?? 0} 条待人工确认
                </p>
              </Link>
              <Link
                to="/logs"
                className="block p-3 rounded-lg bg-warm-50 hover:bg-warm-100 transition-colors"
              >
                <p className="font-medium text-warm-800">公示前复盘操作记录</p>
                <p className="text-xs text-warm-500 mt-0.5">
                  查看所有确认/撤回前后的变更
                </p>
              </Link>
              <a
                href={apiExportUrl()}
                className="block p-3 rounded-lg bg-success-50 hover:bg-success-100 transition-colors"
                download
              >
                <p className="font-medium text-success-800">导出 CSV 明细</p>
                <p className="text-xs text-success-600 mt-0.5">
                  从 SQLite 实际数据导出，覆盖全状态
                </p>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="w-80 flex-shrink-0">
        <OnboardingSidebar />
      </div>
    </div>
  )
}

function apiExportUrl(): string {
  return '/exports/schedules.csv'
}
