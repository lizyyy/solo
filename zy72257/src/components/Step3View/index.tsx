import { useState, useMemo, useCallback } from 'react'
import { useAppState, apiPost, apiGet } from '../../store'
import type { MergedObstacle, SelfCheckIssue, ExportPayload } from '../../types'

interface ApiConfirmResponse {
  obstacleId: string
  newStatus: string
  payload: ExportPayload
}

interface ApiResultResponse {
  isMerged: boolean
  mergedResults: MergedObstacle[]
  selfCheckIssues: SelfCheckIssue[]
  payload: ExportPayload
}

function StatusBadge({ status }: { status: MergedObstacle['status'] }) {
  const map: Record<string, { cls: string; text: string }> = {
    pending_review: { cls: 'badge-pending', text: '待复核' },
    confirmed: { cls: 'badge-confirmed', text: '已确认' },
    anomaly: { cls: 'badge-anomaly', text: '异常待复核' },
  }
  const info = map[status] ?? { cls: 'badge-pending', text: status }
  return <span className={`badge ${info.cls}`}>{info.text}</span>
}

function AnnotationView({
  items,
  onSelect,
}: {
  items: MergedObstacle[]
  onSelect: (id: string) => void
}) {
  const positions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {}
    const count = items.length
    items.forEach((item, i) => {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2
      const rx = 320
      const ry = 160
      pos[item.obstacleId] = {
        x: 450 + rx * Math.cos(angle),
        y: 210 + ry * Math.sin(angle),
      }
    })
    return pos
  }, [items])

  if (items.length === 0) {
    return (
      <div className="annotation-view">
        <div className="empty-state">
          <div className="empty-icon">🏗️</div>
          <div>暂无标注数据</div>
        </div>
      </div>
    )
  }

  return (
    <div className="annotation-view">
      <svg viewBox="0 0 900 420">
        <defs>
          <radialGradient id="towerGrad" cx="50%" cy="40%">
            <stop offset="0%" stopColor="#e8f5e9" />
            <stop offset="100%" stopColor="#c8e6c9" />
          </radialGradient>
        </defs>
        <ellipse cx="450" cy="210" rx="380" ry="180" fill="none" stroke="#90caf9" strokeWidth="1" strokeDasharray="6,4" />
        <rect x="430" y="60" width="40" height="300" rx="20" fill="url(#towerGrad)" stroke="#66bb6a" strokeWidth="2" />
        <polygon points="450,20 490,80 410,80" fill="#a5d6a7" stroke="#66bb6a" strokeWidth="2" />
        <line x1="450" y1="60" x2="580" y2="40" stroke="#66bb6a" strokeWidth="3" />
        <line x1="450" y1="60" x2="320" y2="40" stroke="#66bb6a" strokeWidth="3" />
        <line x1="450" y1="60" x2="450" y2="-20" stroke="#66bb6a" strokeWidth="3" />

        {items.map(item => {
          const pos = positions[item.obstacleId]
          const color =
            item.status === 'anomaly' ? '#d93025' :
            item.status === 'confirmed' ? '#1e8e3e' :
            '#f9ab00'
          return (
            <g
              key={item.obstacleId}
              className="annotation-marker"
              onClick={() => onSelect(item.obstacleId)}
            >
              <circle cx={pos.x} cy={pos.y} r={item.radius ? Math.min(item.radius * 8, 40) : 20} fill={color} fillOpacity={0.15} stroke={color} strokeWidth="2" />
              <circle cx={pos.x} cy={pos.y} r="6" fill={color} />
              <text x={pos.x} y={pos.y - 12} textAnchor="middle" fontSize="11" fontWeight="600" fill={color}>
                {item.obstacleId}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function DetailPanel({
  item,
  onClose,
  onConfirm,
  confirming,
}: {
  item: MergedObstacle | null
  onClose: () => void
  onConfirm: (id: string) => void
  confirming: boolean
}) {
  if (!item) return null

  return (
    <div className={`detail-panel ${item ? 'open' : ''}`}>
      <button className="close-btn" onClick={onClose}>✕</button>

      <h3 style={{ marginBottom: 16 }}>
        {item.obstacleId} 详情
        <div style={{ marginTop: 4 }}><StatusBadge status={item.status} /></div>
      </h3>

      <div className="detail-section">
        <h4>基本信息</h4>
        <div className="detail-field">
          <span className="label">障碍物ID</span>
          <span className="value">{item.obstacleId}</span>
        </div>
        <div className="detail-field">
          <span className="label">安全半径</span>
          <span className="value">{item.radius ?? '-'} {item.unit}</span>
        </div>
        <div className="detail-field">
          <span className="label">数据来源</span>
          <span className="value">
            {item.source === 'both' ? '双源合并' :
             item.source === 'radius_table' ? '仅安全半径表' : '仅坐标原点说明'}
          </span>
        </div>
      </div>

      <div className="detail-section">
        <h4>名称对比</h4>
        <div className="detail-field">
          <span className="label">安全半径表名称</span>
          <span className="value">{item.namesFromRadiusTable.join(' / ') || '-'}</span>
        </div>
        <div className="detail-field">
          <span className="label">坐标原点说明名称</span>
          <span className="value">{item.namesFromOriginNote.join(' / ') || '-'}</span>
        </div>
        {item.hasDuplicateName && (
          <div className="alert alert-warning" style={{ marginTop: 8 }}>
            <span>⚠️</span>
            <div>{item.duplicateNameDetail}</div>
          </div>
        )}
      </div>

      <div className="detail-section">
        <h4>现场证据</h4>
        <div className="detail-field">
          <span className="label">原点描述</span>
          <span className="value">{item.originDescription || '-'}</span>
        </div>
        <div className="detail-field">
          <span className="label">现场说法</span>
          <span className="value">{item.fieldObservation || '-'}</span>
        </div>
      </div>

      <div className="detail-section">
        <h4>审计追踪</h4>
        <div className="detail-field">
          <span className="label">安全半径表原始行号</span>
          <span className="value">{item.originalRowNumbers.join(', ') || '-'}</span>
        </div>
        <div className="detail-field">
          <span className="label">人工改动记录</span>
          <span className="value">
            {item.manualChanges.length === 0
              ? '无'
              : item.manualChanges.map((c, i) => (
                  <div key={i} style={{ fontSize: 12 }}>
                    行{c.originalRowNumber}: {c.oldValue || '(空)'} → {c.newValue}
                  </div>
                ))
            }
          </span>
        </div>
        <div className="detail-field">
          <span className="label">当前处理状态</span>
          <span className="value"><StatusBadge status={item.status} /></span>
        </div>
      </div>

      {item.status === 'anomaly' && (
        <div className="alert alert-warning" style={{ marginTop: 12 }}>
          <span>⚠️</span>
          <div>
            此障碍物存在名称不一致，已标记为异常。
            <strong>不会自动归为正常</strong>，请培训学员复核后手动确认。
          </div>
        </div>
      )}

      <div className="actions-bar" style={{ marginTop: 20 }}>
        {item.status !== 'confirmed' && (
          <button
            className="btn btn-success"
            disabled={confirming}
            onClick={() => onConfirm(item.obstacleId)}
          >
            {confirming ? '确认中…' : '确认复核通过'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Step3View() {
  const { state, dispatch } = useAppState()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const selectedItem = useMemo(
    () => state.mergedResults.find(m => m.obstacleId === selectedId) ?? null,
    [state.mergedResults, selectedId]
  )

  const anomalyCount = state.mergedResults.filter(m => m.status === 'anomaly').length
  const confirmedCount = state.mergedResults.filter(m => m.status === 'confirmed').length
  const pendingCount = state.mergedResults.filter(m => m.status === 'pending_review').length

  const refreshFromApi = useCallback(async () => {
    try {
      const result = await apiGet<ApiResultResponse>('/api/result')
      if (result.isMerged && result.payload) {
        dispatch({
          type: 'SYNC_FROM_API',
          data: {
            mergedResults: result.mergedResults,
            selfCheckIssues: result.selfCheckIssues,
            exportPayload: result.payload,
          },
        })
      }
    } catch (e) {
      console.error('刷新失败:', e)
    }
  }, [dispatch])

  const handleConfirm = useCallback(async (id: string) => {
    setConfirming(true)
    try {
      await apiPost<ApiConfirmResponse>(`/api/confirm/${id}`)
      await refreshFromApi()
    } catch (e) {
      console.error('确认失败:', e)
    } finally {
      setConfirming(false)
    }
  }, [refreshFromApi])

  const handleResolveIssue = useCallback(async (issueId: string) => {
    try {
      await apiPost(`/api/resolve-issue/${issueId}`)
      dispatch({ type: 'RESOLVE_ISSUE', issueId })
    } catch (e) {
      console.error('标记失败:', e)
    }
  }, [dispatch])

  const handleExportJSON = useCallback(async () => {
    let payload = state.exportPayload
    if (!payload) return
    try {
      const result = await apiGet<ApiResultResponse>('/api/result')
      if (result.isMerged && result.payload) {
        payload = result.payload
      }
    } catch {
      // fallback to state
    }
    const json = JSON.stringify(payload, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `风机检修爬梯路径_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [state.exportPayload])

  const handleExportCSV = useCallback(async () => {
    let payload = state.exportPayload
    if (!payload) return
    try {
      const result = await apiGet<ApiResultResponse>('/api/result')
      if (result.isMerged && result.payload) {
        payload = result.payload
      }
    } catch {
      // fallback to state
    }
    const header = 'obstacleId,displayName,radius,unit,status,originalRowNumbers,hasAnomaly,anomalyDetail'
    const rows = payload.items.map(item =>
      `${item.obstacleId},${item.displayName},${item.radius ?? ''},${item.unit},${item.status},"${item.originalRowNumbers.join(';')}",${item.hasAnomaly},"${item.anomalyDetail ?? ''}"`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `风机检修爬梯路径_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [state.exportPayload])

  return (
    <div>
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--primary)' }}>
            {state.mergedResults.length}
          </div>
          <div className="stat-label">合并障碍物总数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {anomalyCount}
          </div>
          <div className="stat-label">异常待复核</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>
            {pendingCount}
          </div>
          <div className="stat-label">待复核</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {confirmedCount}
          </div>
          <div className="stat-label">已确认</div>
        </div>
      </div>

      {state.selfCheckIssues.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span className="icon">🔍</span>
            自检结果
          </div>
          {state.selfCheckIssues.map(issue => (
            <div key={issue.id} className={`self-check-item ${issue.severity} ${issue.resolved ? 'resolved' : ''}`}>
              <span className="sc-type">
                {issue.type === 'duplicate_import' ? '重复导入' :
                 issue.type === 'dual_name' ? '双命名' :
                 issue.type === 'recalc_mismatch' ? '补录重算' : '导出一致'}
              </span>
              <span className="sc-detail">{issue.detail}</span>
              <span className="sc-action">
                {!issue.resolved && (
                  <button
                    className="btn btn-sm"
                    onClick={() => handleResolveIssue(issue.id)}
                  >
                    标记已处理
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <span className="icon">🏗️</span>
          三维标注视图
        </div>
        <div className="legend">
          <div className="legend-item">
            <span className="legend-dot normal" /> 正常
          </div>
          <div className="legend-item">
            <span className="legend-dot anomaly" /> 异常
          </div>
          <div className="legend-item">
            <span className="legend-dot pending" /> 待复核
          </div>
          <div className="legend-item">
            <span className="legend-dot confirmed" /> 已确认
          </div>
        </div>
        <AnnotationView items={state.mergedResults} onSelect={setSelectedId} />
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gray-500)' }}>
          点击标注点查看详情，异常项不会被自动归为正常，需培训学员手动复核确认
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span className="icon">📋</span>
          合并结果明细（与导出/接口返回为同一数据源）
        </div>
        <div className="alert alert-info" style={{ marginBottom: 12 }}>
          <span>ℹ️</span>
          <div>
            以下数据来自服务端 <code>GET /api/result</code>，页面展示、导出明细和接口返回读取同一份服务端结果。
            确认操作通过 <code>POST /api/confirm/:id</code> 更新服务端状态后刷新。
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>障碍物ID</th>
                <th>显示名称</th>
                <th>安全半径</th>
                <th>原始行号</th>
                <th>名称来源(半径表)</th>
                <th>名称来源(原点说明)</th>
                <th>现场说法</th>
                <th>人工改动</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {state.exportPayload?.items.map(item => {
                const mergedItem = state.mergedResults.find(m => m.obstacleId === item.obstacleId)
                return (
                  <tr key={item.obstacleId}>
                    <td>{item.obstacleId}</td>
                    <td>{item.displayName}</td>
                    <td>{item.radius ?? '-'} {item.unit}</td>
                    <td>{item.originalRowNumbers.join(', ')}</td>
                    <td>{mergedItem?.namesFromRadiusTable.join(' / ') ?? '-'}</td>
                    <td>{mergedItem?.namesFromOriginNote.join(' / ') ?? '-'}</td>
                    <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mergedItem?.fieldObservation ?? '-'}
                    </td>
                    <td>
                      {mergedItem?.manualChanges.length
                        ? mergedItem.manualChanges.map(c => `行${c.originalRowNumber}:${c.newValue}`).join('; ')
                        : '无'}
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      <button
                        className="btn btn-sm"
                        onClick={() => setSelectedId(item.obstacleId)}
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span className="icon">📤</span>
          导出
        </div>
        <div className="alert alert-info">
          <span>ℹ️</span>
          <div>
            导出前会从 <code>GET /api/result</code> 拉取最新服务端结果，确保导出内容与接口返回、页面展示完全一致。
            同一障碍物双命名异常在所有位置均显示为"异常待复核"，不会出现一个地方显示异常、另一个地方消失的情况。
          </div>
        </div>
        <div className="actions-bar">
          <button className="btn" onClick={handleExportCSV}>
            导出 CSV
          </button>
          <button className="btn btn-primary" onClick={handleExportJSON}>
            导出 JSON
          </button>
        </div>
      </div>

      <DetailPanel
        item={selectedItem}
        onClose={() => setSelectedId(null)}
        onConfirm={handleConfirm}
        confirming={confirming}
      />
    </div>
  )
}
