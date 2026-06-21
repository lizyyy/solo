import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCoralStore } from '@/store/coralStore'
import { Database, ThermometerSun, MapPin, Clock, ArrowRight, RefreshCw, AlertTriangle, GitCompare } from 'lucide-react'

function MetricCard({ icon: Icon, value, label, color }: { icon: any; value: number | string; label: string; color: string }) {
  return (
    <div className="glass-card p-5 animate-slide-up">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold text-ocean-500 font-mono">{value}</p>
          <p className="text-sm text-ocean-500/60 mt-1">{label}</p>
        </div>
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="skeleton h-8 w-16 rounded" />
          <div className="skeleton h-4 w-24 rounded" />
        </div>
        <div className="skeleton h-10 w-10 rounded-lg" />
      </div>
    </div>
  )
}

const anomalyTypeLabels: Record<string, string> = {
  coordinate_swap: '坐标互换',
  time_mismatch: '时空错配',
  bleaching_anomaly: '白化异常',
  data_gap: '数据间隔',
}

const anomalyTypeColors: Record<string, string> = {
  coordinate_swap: 'bg-seafoam-500',
  time_mismatch: 'bg-coral-500',
  bleaching_anomaly: 'bg-coral-700',
  data_gap: 'bg-ocean-400',
}

const severityLabels: Record<string, string> = {
  critical: '严重',
  warning: '警告',
  info: '提示',
}

export default function Dashboard() {
  const { runs, anomalies, snapshots, currentRun, loading, fetchRuns, fetchSnapshots, executeRun } = useCoralStore()

  useEffect(() => {
    fetchRuns()
    fetchSnapshots()
  }, [])

  const totalRecords = currentRun?.summary_metrics?.total_records ?? currentRun?.total_records ?? 0
  const anomalyCount = currentRun?.summary_metrics?.anomaly_count ?? currentRun?.anomaly_count ?? 0
  const coordSwapCount = anomalies.filter(a => a.anomaly_type === 'coordinate_swap').length
  const timeMismatchCount = anomalies.filter(a => a.anomaly_type === 'time_mismatch').length

  const byType: Record<string, number> = {}
  const bySeverity: Record<string, Record<string, number>> = {}
  for (const a of anomalies) {
    byType[a.anomaly_type] = (byType[a.anomaly_type] || 0) + 1
    if (!bySeverity[a.anomaly_type]) bySeverity[a.anomaly_type] = {}
    bySeverity[a.anomaly_type][a.severity] = (bySeverity[a.anomaly_type][a.severity] || 0) + 1
  }

  const summaryMappings: Record<string, string> = {
    coordinate_swap: '坐标修正',
    time_mismatch: '时空校验',
    bleaching_anomaly: '白化检出',
    data_gap: '完整性检查',
  }

  const latestTwo = snapshots.slice(0, 2)
  const hasDiff = latestTwo.length === 2

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        {loading && runs.length === 0 ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <MetricCard icon={Database} value={totalRecords} label="调查总记录" color="bg-ocean-500" />
            <MetricCard icon={ThermometerSun} value={anomalyCount} label="白化检出" color="bg-coral-500" />
            <MetricCard icon={MapPin} value={coordSwapCount} label="坐标修正" color="bg-seafoam-500" />
            <MetricCard icon={Clock} value={timeMismatchCount} label="时空错配" color="bg-coral-600" />
          </>
        )}
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 space-y-3">
          <h3 className="font-serif text-white text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-coral-400" />
            异常队列摘要
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.keys(anomalyTypeLabels).map((type) => (
              <Link
                key={type}
                to="/anomaly-detail"
                className="glass-card p-4 hover:shadow-lg transition-shadow cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-ocean-500">
                    {anomalyTypeLabels[type]}
                  </span>
                  <div className={`w-3 h-3 rounded-full ${anomalyTypeColors[type]}`} />
                </div>
                <p className="text-3xl font-bold text-ocean-500 font-mono">{byType[type] || 0}</p>
                <div className="mt-2 flex gap-2">
                  {bySeverity[type] && Object.entries(bySeverity[type]).map(([sev, count]) => (
                    <span key={sev} className="text-xs px-2 py-0.5 rounded-full bg-ocean-50 text-ocean-600">
                      {severityLabels[sev]} {count}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex items-center text-xs text-ocean-400 group-hover:text-coral-500 transition-colors">
                  查看详情 <ArrowRight className="w-3 h-3 ml-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="col-span-2">
          <h3 className="font-serif text-white text-base mb-3">汇总口径面板</h3>
          <div className="bg-seafoam-50/80 backdrop-blur-sm border border-seafoam-200 rounded-xl p-4">
            <p className="text-sm text-seafoam-800 font-semibold mb-3">异常类型 → 汇总口径映射</p>
            <div className="space-y-2">
              {Object.entries(summaryMappings).map(([type, mapping]) => (
                <div key={type} className="flex items-center gap-2 text-sm">
                  <span className="text-ocean-600 font-mono">{anomalyTypeLabels[type]}</span>
                  <ArrowRight className="w-3 h-3 text-seafoam-600" />
                  <span className="text-seafoam-800 font-semibold">{mapping}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3">
          <h3 className="font-serif text-white text-base mb-3 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-seafoam-400" />
            参数变更快照
          </h3>
          <div className="glass-card p-4 font-mono text-sm">
            {hasDiff ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-ocean-400 mb-3">
                  <span>Step #{latestTwo[0].change_step}</span>
                  <span>→</span>
                  <span>Step #{latestTwo[1].change_step}</span>
                </div>
                {(() => {
                  const fromParams = latestTwo[0].parameters as Record<string, any>
                  const toParams = latestTwo[1].parameters as Record<string, any>
                  const allKeys = new Set([...Object.keys(fromParams || {}), ...Object.keys(toParams || {})])
                  return Array.from(allKeys).map((key) => {
                    const fromVal = JSON.stringify(fromParams?.[key])
                    const toVal = JSON.stringify(toParams?.[key])
                    const changed = fromVal !== toVal
                    return (
                      <div key={key} className="flex items-center gap-3 py-1">
                        <span className="text-ocean-500 w-40 truncate">{key}</span>
                        {changed ? (
                          <>
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs line-through">
                              {fromVal}
                            </span>
                            <span className="text-ocean-300">→</span>
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">
                              {toVal}
                            </span>
                          </>
                        ) : (
                          <span className="text-ocean-400">{fromVal}</span>
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
            ) : (
              <p className="text-ocean-400 text-center py-4">暂无参数快照数据</p>
            )}
          </div>
        </div>

        <div className="col-span-2">
          <h3 className="font-serif text-white text-base mb-3">跑批状态</h3>
          <div className="glass-card p-4 space-y-3">
            {runs.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ocean-500 font-semibold">最近跑批</p>
                    <p className="text-xs text-ocean-400 mt-0.5">
                      {new Date(runs[0].run_time).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    runs[0].status === 'completed'
                      ? 'bg-seafoam-100 text-seafoam-700'
                      : runs[0].status === 'running'
                        ? 'bg-coral-100 text-coral-700'
                        : 'bg-red-100 text-red-700'
                  }`}>
                    {runs[0].status === 'completed' ? '已完成' : runs[0].status === 'running' ? '运行中' : '失败'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-ocean-500">
                  <span>记录: {runs[0].total_records}</span>
                  <span>异常: {runs[0].anomaly_count}</span>
                </div>
                <button
                  onClick={() => executeRun({ bleaching_threshold: 3, coordinate_tolerance: 1.0, time_gap_hours: 48 })}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-coral-500 hover:bg-coral-600 text-white py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  重新跑批
                </button>
                <div className="border-t border-ocean-100 pt-3 space-y-2">
                  <p className="text-xs text-ocean-400 font-semibold">历史跑批</p>
                  {runs.slice(1, 5).map((run) => (
                    <div key={run.id} className="flex items-center justify-between text-xs">
                      <span className="text-ocean-500">{new Date(run.run_time).toLocaleString('zh-CN')}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        run.status === 'completed' ? 'bg-seafoam-50 text-seafoam-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {run.status === 'completed' ? '完成' : run.status === 'running' ? '运行中' : '失败'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-ocean-400 text-center py-4 text-sm">暂无跑批记录</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
