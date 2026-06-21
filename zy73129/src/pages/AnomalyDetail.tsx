import { useEffect, useState } from 'react'
import { useCoralStore } from '@/store/coralStore'
import { AlertTriangle, ChevronDown, ChevronUp, Filter, ArrowRight, Check, X, User, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const anomalyTypeLabels: Record<string, string> = {
  coordinate_swap: '坐标互换',
  time_mismatch: '时空错配',
  bleaching_anomaly: '白化异常',
  data_gap: '数据间隔',
}

const severityLabels: Record<string, string> = {
  critical: '严重',
  warning: '警告',
  info: '提示',
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-coral-100 text-coral-700',
  info: 'bg-ocean-100 text-ocean-700',
}

const statusLabels: Record<string, string> = {
  open: '待处理',
  acknowledged: '已确认',
  resolved: '已解决',
}

const statusColors: Record<string, string> = {
  open: 'bg-coral-50 text-coral-600',
  acknowledged: 'bg-seafoam-50 text-seafoam-600',
  resolved: 'bg-ocean-50 text-ocean-600',
}

export default function AnomalyDetail() {
  const { runs, currentRun, currentRunId, anomalies, loading, fetchRuns, fetchAnomalies, updateAnomalyStatus, persistCoordinateCorrection } = useCoralStore()
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (runs.length === 0) {
      fetchRuns()
    } else {
      fetchAnomalies(filters)
    }
  }, [])

  useEffect(() => {
    if (currentRunId) {
      fetchAnomalies(filters)
    }
  }, [currentRunId])

  const applyFilters = () => {
    fetchAnomalies(filters)
  }

  const byType: Record<string, number> = {}
  for (const a of anomalies) {
    byType[a.anomaly_type] = (byType[a.anomaly_type] || 0) + 1
  }

  const handleStatusChange = async (id: string, status: string) => {
    await updateAnomalyStatus(id, status)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {currentRun && (
        <div className="glass-card px-4 py-2.5 flex items-center gap-3 text-xs">
          <div className="w-2 h-2 rounded-full bg-seafoam-500" />
          <span className="text-ocean-400">当前跑批口径:</span>
          <span className="text-ocean-600 font-semibold font-mono">
            {new Date(currentRun.run_time).toLocaleString('zh-CN')}
          </span>
          <span className="text-ocean-300">·</span>
          <span className="text-ocean-500">
            总记录 <span className="font-mono text-ocean-600 font-semibold">{currentRun.total_records}</span>
          </span>
          <span className="text-ocean-300">·</span>
          <span className="text-ocean-500">
            异常 <span className="font-mono text-coral-600 font-semibold">{currentRun.anomaly_count}</span>
          </span>
          <span className="ml-auto px-2 py-0.5 rounded-full bg-seafoam-50 text-seafoam-700">
            状态: {currentRun.status === 'completed' ? '已完成' : currentRun.status}
          </span>
        </div>
      )}
      <div className="glass-card p-4">
        <h3 className="font-serif text-ocean-500 text-sm mb-3 flex items-center gap-2">
          <Filter className="w-4 h-4 text-seafoam-500" />
          筛选条件
        </h3>
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-xs text-ocean-400 mb-1">异常类型</label>
            <select
              value={filters.anomaly_type || ''}
              onChange={(e) => setFilters({ ...filters, anomaly_type: e.target.value })}
              className="px-3 py-1.5 rounded-lg border border-ocean-100 text-sm text-ocean-500 focus:outline-none focus:border-seafoam-500"
            >
              <option value="">全部</option>
              {Object.entries(anomalyTypeLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ocean-400 mb-1">严重度</label>
            <select
              value={filters.severity || ''}
              onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
              className="px-3 py-1.5 rounded-lg border border-ocean-100 text-sm text-ocean-500 focus:outline-none focus:border-seafoam-500"
            >
              <option value="">全部</option>
              {Object.entries(severityLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ocean-400 mb-1">状态</label>
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-1.5 rounded-lg border border-ocean-100 text-sm text-ocean-500 focus:outline-none focus:border-seafoam-500"
            >
              <option value="">全部</option>
              {Object.entries(statusLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <button
            onClick={applyFilters}
            className="bg-ocean-500 hover:bg-ocean-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
          >
            应用筛选
          </button>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-ocean-400">
          <span>共 {anomalies.length} 条异常</span>
          {Object.entries(byType).map(([type, count]) => (
            <span key={type}>{anomalyTypeLabels[type] || type}: {count}</span>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {loading && anomalies.length === 0 ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16 rounded-lg" />
            ))}
          </div>
        ) : anomalies.length === 0 ? (
          <div className="p-8 text-center text-ocean-400 text-sm">暂无异常记录</div>
        ) : (
          <div className="divide-y divide-ocean-50">
            {anomalies.map((anomaly: any) => {
              const isExpanded = expandedId === anomaly.id
              return (
                <div key={anomaly.id} className="animate-slide-up">
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover:bg-ocean-50/30 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : anomaly.id)}
                  >
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', severityColors[anomaly.severity])}>
                      {severityLabels[anomaly.severity]}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-ocean-50 text-ocean-600 text-xs font-semibold">
                      {anomalyTypeLabels[anomaly.anomaly_type] || anomaly.anomaly_type}
                    </span>
                    <span className="text-sm text-ocean-500 flex-1 truncate">{anomaly.description}</span>
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', statusColors[anomaly.status])}>
                      {statusLabels[anomaly.status]}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-ocean-300" /> : <ChevronDown className="w-4 h-4 text-ocean-300" />}
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4 bg-ocean-50/20">
                      <div>
                        <h4 className="text-xs font-semibold text-ocean-400 mb-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> 溯源链
                        </h4>
                        <div className="flex items-start gap-2 ml-2">
                          {(() => {
                            const chain = typeof anomaly.trace_chain === 'string'
                              ? JSON.parse(anomaly.trace_chain)
                              : anomaly.trace_chain
                            return (
                              <div className="flex items-start gap-2 flex-wrap">
                                <div className="bg-white rounded-lg px-3 py-1.5 text-xs border border-ocean-100">
                                  <span className="text-ocean-400">记录: </span>
                                  <span className="font-mono text-ocean-600">{chain.record_id?.substring(0, 8) || '—'}...</span>
                                  {chain.site && <span className="text-ocean-500 ml-1">({chain.site})</span>}
                                </div>
                                <ArrowRight className="w-3 h-3 text-ocean-300 mt-2" />
                                <div className="bg-white rounded-lg px-3 py-1.5 text-xs border border-ocean-100">
                                  <span className="text-ocean-400">校验: </span>
                                  <span className="text-ocean-600">{anomalyTypeLabels[anomaly.anomaly_type]}</span>
                                </div>
                                <ArrowRight className="w-3 h-3 text-ocean-300 mt-2" />
                                <div className="bg-white rounded-lg px-3 py-1.5 text-xs border border-ocean-100">
                                  <span className="text-ocean-400">异常: </span>
                                  <span className={cn('font-semibold', severityColors[anomaly.severity])}>
                                    {severityLabels[anomaly.severity]}
                                  </span>
                                </div>
                                <ArrowRight className="w-3 h-3 text-ocean-300 mt-2" />
                                <div className="bg-seafoam-50 rounded-lg px-3 py-1.5 text-xs border border-seafoam-100">
                                  <span className="text-seafoam-600">汇总口径</span>
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      </div>

                      {anomaly.anomaly_type === 'coordinate_swap' && anomaly.coordinate_correction && (
                        <div>
                          <h4 className="text-xs font-semibold text-ocean-400 mb-2">经纬度反写状态</h4>
                          <div className="bg-white rounded-lg px-4 py-3 text-xs border border-ocean-100 inline-flex items-center gap-3">
                            <span className="font-mono text-ocean-500">
                              ({anomaly.coordinate_correction.original_lat?.toFixed(4)}, {anomaly.coordinate_correction.original_lng?.toFixed(4)})
                            </span>
                            <ArrowRight className="w-4 h-4 text-seafoam-500" />
                            <span className="font-mono text-seafoam-600 font-semibold">
                              ({anomaly.coordinate_correction.corrected_lat?.toFixed(4)}, {anomaly.coordinate_correction.corrected_lng?.toFixed(4)})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => persistCoordinateCorrection(anomaly.id, 'detail')}
                              disabled={loading || !!anomaly.coordinate_correction.persisted_to_detail}
                              className={cn(
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors disabled:cursor-not-allowed',
                                anomaly.coordinate_correction.persisted_to_detail
                                  ? 'bg-seafoam-50 text-seafoam-600'
                                  : 'bg-gray-100 text-gray-500 hover:bg-seafoam-50 hover:text-seafoam-600'
                              )}
                            >
                              {anomaly.coordinate_correction.persisted_to_detail ? (
                                <><Check className="w-3 h-3" /> 已持久化到详情</>
                              ) : (
                                <><X className="w-3 h-3" /> 持久化到详情</>
                              )}
                            </button>
                            <button
                              onClick={() => persistCoordinateCorrection(anomaly.id, 'file')}
                              disabled={loading || !!anomaly.coordinate_correction.persisted_to_file}
                              className={cn(
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors disabled:cursor-not-allowed',
                                anomaly.coordinate_correction.persisted_to_file
                                  ? 'bg-seafoam-50 text-seafoam-600'
                                  : 'bg-gray-100 text-gray-500 hover:bg-seafoam-50 hover:text-seafoam-600'
                              )}
                            >
                              {anomaly.coordinate_correction.persisted_to_file ? (
                                <><Check className="w-3 h-3" /> 已持久化到文件</>
                              ) : (
                                <><X className="w-3 h-3" /> 持久化到文件</>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {anomaly.record_annotations && anomaly.record_annotations.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-ocean-400 mb-2 flex items-center gap-1">
                            <User className="w-3 h-3" /> 历史备注
                          </h4>
                          <div className="space-y-2 ml-2">
                            {anomaly.record_annotations.map((ann: any) => (
                              <div
                                key={ann.id}
                                className={cn(
                                  'bg-white rounded-lg px-3 py-2 text-xs border-l-4 border-ocean-200 border border-ocean-50',
                                  ann.is_retroactive && 'border-l-coral-400 bg-coral-50/30'
                                )}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-semibold text-ocean-600 flex items-center gap-1">
                                    <User className="w-3 h-3" /> {ann.annotator}
                                    {ann.is_retroactive && (
                                      <span className="ml-1 px-1.5 py-0.5 rounded bg-coral-100 text-coral-600 text-[10px]">后补</span>
                                    )}
                                  </span>
                                  <span className="text-ocean-300 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {ann.annotation_time}
                                  </span>
                                </div>
                                <p className="text-ocean-500 leading-relaxed">{ann.content}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <h4 className="text-xs font-semibold text-ocean-400 mb-2">状态更新</h4>
                        <div className="flex gap-2">
                          {(['open', 'acknowledged', 'resolved'] as const).map((status) => (
                            <button
                              key={status}
                              onClick={() => handleStatusChange(anomaly.id, status)}
                              disabled={anomaly.status === status || loading}
                              className={cn(
                                'px-3 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50',
                                anomaly.status === status
                                  ? statusColors[status]
                                  : 'bg-ocean-50 text-ocean-400 hover:bg-ocean-100'
                              )}
                            >
                              {statusLabels[status]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
