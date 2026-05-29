import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Anomaly, ErrorSeverity } from '../types'

const severityConfig: Record<ErrorSeverity, { bg: string; border: string; icon: string }> = {
  critical: { bg: 'bg-red-50', border: 'border-red-400', icon: '🚨' },
  warning: { bg: 'bg-yellow-50', border: 'border-yellow-400', icon: '⚠️' },
  info: { bg: 'bg-blue-50', border: 'border-blue-400', icon: 'ℹ️' }
}

const typeLabels: Record<string, string> = {
  duplicate_name: '指法同名',
  section_mismatch: '段落错位',
  duplicate_comment: '重复点评',
  missing_fingering: '缺失指法',
  practice_gap: '练习断层'
}

const sourceTypeLabels: Record<string, string> = {
  fingering: '指法字典',
  section: '曲谱段落',
  practice: '练习记录',
  comment: '老师点评'
}

export const AnomalyAlert: React.FC = () => {
  const { state, dispatch } = useApp()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)
  const [resolutionNote, setResolutionNote] = useState('')
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const displayedAnomalies = showResolved 
    ? state.anomalies 
    : state.anomalies.filter(a => !a.resolved)

  const unresolvedCount = state.anomalies.filter(a => !a.resolved).length

  const handleResolve = (anomaly: Anomaly) => {
    if (resolutionNote.trim()) {
      dispatch({
        type: 'RESOLVE_ANOMALY',
        payload: { id: anomaly.id, note: resolutionNote }
      })
      setResolutionNote('')
      setResolvingId(null)
      setExpandedId(null)
    }
  }

  const getSourceLinks = (anomaly: Anomaly) => {
    const sources: Record<string, any[]> = {
      fingering: state.fingerings,
      section: state.sections,
      practice: state.practiceRecords,
      comment: state.comments
    }
    return anomaly.sourceIds.map(id => {
      const source = sources[anomaly.sourceType]?.find(s => s.id === id)
      return source ? (source as any).name || (source as any).sectionName || (source as any).content?.substring(0, 20) || id : id
    }).join(', ')
  }

  if (unresolvedCount === 0 && !showResolved) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">✅</span>
            <span className="font-medium text-green-800">数据状态良好，未检测到异常</span>
          </div>
          <button
            onClick={() => setShowResolved(true)}
            className="text-sm text-green-600 hover:text-green-800"
          >
            查看已解决 ({state.anomalies.filter(a => a.resolved).length})
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-lg">异常检测中心</h3>
          {unresolvedCount > 0 && (
            <span className="badge badge-critical">{unresolvedCount} 个待处理</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => dispatch({ type: 'RESCAN_ANOMALIES' })}
            className="btn-secondary text-sm"
          >
            重新扫描
          </button>
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="text-sm text-guqin-600 hover:text-guqin-800"
          >
            {showResolved ? '隐藏已解决' : `查看已解决 (${state.anomalies.filter(a => a.resolved).length})`}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {displayedAnomalies.map(anomaly => {
          const config = severityConfig[anomaly.severity]
          const isExpanded = expandedId === anomaly.id
          const isResolving = resolvingId === anomaly.id

          return (
            <div
              key={anomaly.id}
              className={`${config.bg} border-l-4 ${config.border} rounded-r-lg p-4 transition-all ${anomaly.resolved ? 'opacity-60' : ''}`}
            >
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => !anomaly.resolved && setExpandedId(isExpanded ? null : anomaly.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{config.icon}</span>
                    <span className="font-semibold">{anomaly.title}</span>
                    <span className={`badge ${anomaly.severity === 'critical' ? 'badge-critical' : anomaly.severity === 'warning' ? 'badge-warning' : 'badge-info'}`}>
                      {typeLabels[anomaly.type] || anomaly.type}
                    </span>
                    {anomaly.resolved && (
                      <span className="badge badge-success">已解决</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{anomaly.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>来源: {sourceTypeLabels[anomaly.sourceType]}</span>
                    <span>关联: {getSourceLinks(anomaly)}</span>
                    <span>检测时间: {anomaly.createdAt}</span>
                  </div>
                  {anomaly.resolved && anomaly.resolutionNote && (
                    <div className="mt-2 p-2 bg-white rounded text-sm text-gray-700">
                      <span className="font-medium">处理结果：</span>{anomaly.resolutionNote}
                    </div>
                  )}
                </div>
                {!anomaly.resolved && (
                  <button className="text-gray-400 hover:text-gray-600 ml-4">
                    {isExpanded ? '▲' : '▼'}
                  </button>
                )}
              </div>

              {isExpanded && !anomaly.resolved && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="bg-white rounded p-3 mb-3">
                    <h4 className="font-medium text-sm mb-2">处理建议</h4>
                    {anomaly.type === 'duplicate_name' && (
                      <p className="text-sm text-gray-600">请检查指法字典，合并重复指法或修改名称/别名以避免歧义。</p>
                    )}
                    {anomaly.type === 'section_mismatch' && (
                      <p className="text-sm text-gray-600">请检查曲谱段落序号是否连续，版本链是否完整。必要时重新排序或同步版本。</p>
                    )}
                    {anomaly.type === 'duplicate_comment' && (
                      <p className="text-sm text-gray-600">同一次练习记录有多条点评，请确认是否为重复操作，建议保留最新一条。</p>
                    )}
                    {anomaly.type === 'missing_fingering' && (
                      <p className="text-sm text-gray-600">段落引用了不存在的指法ID，请检查指法字典是否完整，或修正段落中的指法引用。</p>
                    )}
                  </div>

                  {isResolving ? (
                    <div className="space-y-3">
                      <div>
                        <label className="label">处理说明</label>
                        <textarea
                          className="input"
                          rows={2}
                          placeholder="请说明如何处理此异常..."
                          value={resolutionNote}
                          onChange={(e) => setResolutionNote(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="btn-primary text-sm"
                          onClick={() => handleResolve(anomaly)}
                          disabled={!resolutionNote.trim()}
                        >
                          标记为已解决
                        </button>
                        <button
                          className="btn-secondary text-sm"
                          onClick={() => {
                            setResolvingId(null)
                            setResolutionNote('')
                          }}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn-primary text-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setResolvingId(anomaly.id)
                      }}
                    >
                      处理此异常
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
