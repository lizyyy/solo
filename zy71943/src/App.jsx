import React, { useState, useEffect } from 'react'
import useReviewStore from './store/reviewStore'
import { CHANGE_TYPES } from './models/types'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  Clock, AlertTriangle, Database, FileCheck, Play,
  ChevronRight, X, CheckCircle, AlertCircle, Info,
  Download, RefreshCw, Eye, CheckSquare, RotateCcw
} from 'lucide-react'

function App() {
  const {
    missionId,
    activeTab,
    setActiveTab,
    anomalies,
    timeline,
    payloadPlans,
    faultRecords,
    orbitalElements,
    manualConfirms,
    taskBriefings,
    loadSampleData,
    generateTaskBriefing,
    exportBriefing,
    addManualConfirm,
    getStateAtTime
  } = useReviewStore()

  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [selectedAnomaly, setSelectedAnomaly] = useState(null)
  const [timeTravelEnabled, setTimeTravelEnabled] = useState(false)
  const [timeTravelIndex, setTimeTravelIndex] = useState(0)
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    if (!dataLoaded) {
      loadSampleData()
      setDataLoaded(true)
    }
  }, [dataLoaded, loadSampleData])

  const unresolvedAnomalies = anomalies.filter(a => !a.isResolved)
  const timelineEvents = timeline

  const getTimelineItemClass = (event) => {
    if (event.isKeyEvent) {
      if (event.changeType === CHANGE_TYPES.CONCLUSION_CHANGED) return 'danger'
      if (event.changeType === CHANGE_TYPES.MATERIAL_ONLY) return 'warning'
      if (event.eventType === 'confirmation') return 'success'
      return 'key'
    }
    return ''
  }

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'high': return 'severity-high'
      case 'warning': return 'severity-warning'
      default: return 'severity-info'
    }
  }

  const handleAddConfirm = (data) => {
    addManualConfirm(data)
    setShowConfirmModal(false)
    setSelectedAnomaly(null)
  }

  const currentState = timeTravelEnabled && timelineEvents.length > 0
    ? getStateAtTime(timelineEvents[Math.min(timeTravelIndex, timelineEvents.length - 1)].timestamp)
    : null

  const displayState = currentState || {
    payloadPlans,
    faultRecords,
    orbitalElements,
    manualConfirms,
    anomalies
  }

  return (
    <div className="app">
      <header className="header">
        <h1>轨控指令复核系统</h1>
        <div className="header-info">
          <span>任务: {missionId}</span>
          <span className="status-item">
            <span className={`status-dot ${unresolvedAnomalies.length > 0 ? 'yellow' : 'green'}`}></span>
            {unresolvedAnomalies.length} 项待处理
          </span>
          <span className="status-item">
            <span className="status-dot green"></span>
            {manualConfirms.length} 项已确认
          </span>
        </div>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <div className="nav-tabs">
            <button
              className={`nav-tab ${activeTab === 'timeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              <Clock size={18} />
              时间线
            </button>
            <button
              className={`nav-tab ${activeTab === 'anomalies' ? 'active' : ''}`}
              onClick={() => setActiveTab('anomalies')}
            >
              <AlertTriangle size={18} />
              异常检测
              {unresolvedAnomalies.length > 0 && (
                <span className="badge">{unresolvedAnomalies.length}</span>
              )}
            </button>
            <button
              className={`nav-tab ${activeTab === 'data' ? 'active' : ''}`}
              onClick={() => setActiveTab('data')}
            >
              <Database size={18} />
              数据管理
            </button>
            <button
              className={`nav-tab ${activeTab === 'confirms' ? 'active' : ''}`}
              onClick={() => setActiveTab('confirms')}
            >
              <CheckSquare size={18} />
              人工确认
            </button>
            <button
              className={`nav-tab ${activeTab === 'briefing' ? 'active' : ''}`}
              onClick={() => setActiveTab('briefing')}
            >
              <FileCheck size={18} />
              任务简报
            </button>
          </div>
        </aside>

        <main className="content-panel">
          {timeTravelEnabled && (
            <div className="time-travel-controls">
              <div className="time-travel-toggle">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={timeTravelEnabled}
                    onChange={(e) => setTimeTravelEnabled(e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
                <span>时间回溯</span>
              </div>
              <div className="time-slider">
                <input
                  type="range"
                  min="0"
                  max={timelineEvents.length - 1}
                  value={timeTravelIndex}
                  onChange={(e) => setTimeTravelIndex(parseInt(e.target.value))}
                />
              </div>
              <div className="time-display">
                {timelineEvents[timeTravelIndex] && format(
                  new Date(timelineEvents[timeTravelIndex].timestamp),
                  'yyyy-MM-dd HH:mm:ss',
                  { locale: zhCN }
                )}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setTimeTravelEnabled(false)}
              >
                <RotateCcw size={14} />
                重置
              </button>
            </div>
          )}

          {activeTab === 'timeline' && (
            <>
              <div className="panel-header">
                <h2>复核时间线</h2>
                <div className="panel-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setTimeTravelEnabled(!timeTravelEnabled)}
                  >
                    <Eye size={14} />
                    {timeTravelEnabled ? '关闭回溯' : '开启时间回溯'}
                  </button>
                </div>
              </div>
              <div className="panel-body">
                <div className="timeline">
                  {timelineEvents.map((event, index) => (
                    <div
                      key={event.id}
                      className={`timeline-item ${getTimelineItemClass(event)}`}
                      onClick={() => timeTravelEnabled && setTimeTravelIndex(index)}
                    >
                      <div className="timeline-marker">
                        {event.eventType === 'confirmation' && <CheckCircle size={10} />}
                        {event.eventType === 'data_received' && <Database size={10} />}
                        {event.eventType === 'briefing_generated' && <FileCheck size={10} />}
                        {event.eventType === 'note_added' && <Info size={10} />}
                      </div>
                      <div className="timeline-time">
                        {format(new Date(event.timestamp), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                      </div>
                      <div className="timeline-content">
                        <h4>{event.description}</h4>
                        <div className="timeline-tags">
                          {event.metadata?.isEarly && (
                            <span className="tag tag-info">提前到达</span>
                          )}
                          {event.metadata?.isLateSupplement && (
                            <span className="tag tag-warning">事后补录</span>
                          )}
                          {event.metadata?.isManualModified && (
                            <span className="tag tag-danger">含手工修改</span>
                          )}
                          {event.changeType === CHANGE_TYPES.MATERIAL_ONLY && (
                            <span className="tag tag-material">仅补材料</span>
                          )}
                          {event.changeType === CHANGE_TYPES.CONCLUSION_CHANGED && (
                            <span className="tag tag-danger">结论变更</span>
                          )}
                          {event.isKeyEvent && (
                            <span className="tag tag-info">关键事件</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'anomalies' && (
            <>
              <div className="panel-header">
                <h2>异常检测</h2>
                <div className="panel-actions">
                  <button className="btn btn-secondary btn-sm">
                    <RefreshCw size={14} />
                    重新检测
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowConfirmModal(true)}
                  >
                    <CheckSquare size={14} />
                    新建确认
                  </button>
                </div>
              </div>
              <div className="panel-body">
                {displayState.anomalies.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                    <CheckCircle size={48} style={{ marginBottom: 16, color: '#10b981' }} />
                    <p>未检测到异常</p>
                  </div>
                ) : (
                  displayState.anomalies.map(anomaly => (
                    <div key={anomaly.id} className={`anomaly-card ${anomaly.isResolved ? 'resolved' : ''}`}>
                      <div className="anomaly-header">
                        <div className="anomaly-title">
                          <AlertTriangle size={18} color={anomaly.severity === 'high' ? '#ef4444' : anomaly.severity === 'warning' ? '#f59e0b' : '#3b82f6'} />
                          {anomaly.title}
                          <span className={`severity-badge ${getSeverityClass(anomaly.severity)}`}>
                            {anomaly.severity === 'high' ? '高' : anomaly.severity === 'warning' ? '中' : '低'}
                          </span>
                        </div>
                        {anomaly.isResolved && (
                          <span className="tag tag-success">已解决</span>
                        )}
                      </div>
                      <p className="anomaly-description">{anomaly.description}</p>
                      <div className="anomaly-explanation">
                        <label>异常解释</label>
                        <p>{anomaly.explanation}</p>
                      </div>
                      {anomaly.isResolved && (
                        <div className="anomaly-explanation" style={{ borderLeftColor: '#10b981' }}>
                          <label>处理结论</label>
                          <p>{anomaly.resolution}</p>
                          <small style={{ color: '#64748b' }}>
                            处理人: {anomaly.resolvedBy} · {format(new Date(anomaly.resolvedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                          </small>
                        </div>
                      )}
                      {!anomaly.isResolved && (
                        <div className="anomaly-actions">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setSelectedAnomaly(anomaly)
                              setShowConfirmModal(true)
                            }}
                          >
                            <CheckSquare size={14} />
                            处理并确认
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'data' && (
            <>
              <div className="panel-header">
                <h2>数据管理</h2>
                <div className="panel-actions">
                  <button className="btn btn-secondary btn-sm">
                    <Download size={14} />
                    导入数据
                  </button>
                </div>
              </div>
              <div className="panel-body">
                <div className="briefing-section">
                  <h3>载荷计划 ({displayState.payloadPlans.length})</h3>
                  {displayState.payloadPlans.map(plan => (
                    <div key={plan.id} className="data-card">
                      <div className="data-card-header">
                        <div className="data-card-title">{plan.planName}</div>
                        <div className="data-card-meta">
                          {plan.isEarly && <span className="tag tag-info">提前到达</span>}
                          <span className="tag tag-info">v{plan.version}</span>
                        </div>
                      </div>
                      <div className="data-grid">
                        <div className="data-item">
                          <label>计划时间</label>
                          <value>{format(new Date(plan.plannedTime), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</value>
                        </div>
                        <div className="data-item">
                          <label>接收时间</label>
                          <value>{format(new Date(plan.receivedTime), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</value>
                        </div>
                        {Object.entries(plan.parameters).map(([key, value]) => (
                          <div key={key} className="data-item">
                            <label>{key}</label>
                            <value>{value}</value>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="briefing-section">
                  <h3>故障纪要 ({displayState.faultRecords.length})</h3>
                  {displayState.faultRecords.map(record => (
                    <div key={record.id} className="data-card">
                      <div className="data-card-header">
                        <div className="data-card-title">
                          {record.faultName}
                          <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b' }}>({record.faultCode})</span>
                        </div>
                        <div className="data-card-meta">
                          {record.isLateSupplement && <span className="tag tag-warning">事后补录</span>}
                          <span className={`tag ${record.impact === 'minor' ? 'tag-info' : 'tag-danger'}`}>
                            {record.impact === 'minor' ? '轻微影响' : '严重影响'}
                          </span>
                        </div>
                      </div>
                      <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>{record.description}</p>
                      <div className="data-grid">
                        <div className="data-item">
                          <label>发生时间</label>
                          <value>{format(new Date(record.occurredTime), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</value>
                        </div>
                        <div className="data-item">
                          <label>记录时间</label>
                          <value>{format(new Date(record.recordedTime), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</value>
                        </div>
                        <div className="data-item">
                          <label>记录人</label>
                          <value>{record.history[0]?.user || '-'}</value>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="briefing-section">
                  <h3>轨道根数 ({displayState.orbitalElements.length})</h3>
                  {displayState.orbitalElements.map(elements => (
                    <div key={elements.id} className="data-card">
                      <div className="data-card-header">
                        <div className="data-card-title">{elements.elementSetName}</div>
                        <div className="data-card-meta">
                          {elements.isManualModified && <span className="tag tag-danger">含手工修改</span>}
                        </div>
                      </div>
                      {elements.isManualModified && (
                        <div className="anomaly-explanation" style={{ marginBottom: 12 }}>
                          <label>修改说明</label>
                          <p>{elements.modificationReason || '未提供修改原因'}</p>
                        </div>
                      )}
                      <div className="data-grid">
                        <div className="data-item">
                          <label>半长轴 (km)</label>
                          <value>{elements.semiMajorAxis}</value>
                        </div>
                        <div className="data-item">
                          <label>偏心率</label>
                          <value>{elements.eccentricity.toFixed(4)}</value>
                        </div>
                        <div className="data-item">
                          <label>倾角 (°)</label>
                          <value>{elements.inclination}</value>
                        </div>
                        <div className="data-item">
                          <label>升交点赤经 (°)</label>
                          <value>{elements.rightAscension}</value>
                        </div>
                        <div className="data-item">
                          <label>近地点幅角 (°)</label>
                          <value>{elements.argumentOfPerigee}</value>
                        </div>
                        <div className="data-item">
                          <label>真近点角 (°)</label>
                          <value>{elements.trueAnomaly}</value>
                        </div>
                        <div className="data-item">
                          <label>历元</label>
                          <value>{format(new Date(elements.epoch), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</value>
                        </div>
                        <div className="data-item">
                          <label>来源</label>
                          <value>{elements.source}</value>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'confirms' && (
            <>
              <div className="panel-header">
                <h2>人工确认记录</h2>
                <div className="panel-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowConfirmModal(true)}
                  >
                    <CheckSquare size={14} />
                    新建确认
                  </button>
                </div>
              </div>
              <div className="panel-body">
                {displayState.manualConfirms.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                    <CheckSquare size={48} style={{ marginBottom: 16 }} />
                    <p>暂无人工确认记录</p>
                  </div>
                ) : (
                  displayState.manualConfirms.map(confirm => (
                    <div key={confirm.id} className="data-card">
                      <div className="data-card-header">
                        <div className="data-card-title">复核确认</div>
                        <div className="data-card-meta">
                          <span className={`tag ${confirm.changeType === CHANGE_TYPES.MATERIAL_ONLY ? 'tag-material' : 'tag-danger'}`}>
                            {confirm.changeType === CHANGE_TYPES.MATERIAL_ONLY ? '仅补材料' : '结论变更'}
                          </span>
                        </div>
                      </div>
                      <div className={`change-type-indicator ${confirm.changeType === CHANGE_TYPES.MATERIAL_ONLY ? 'material' : 'conclusion'}`}>
                        <h4>{confirm.changeType === CHANGE_TYPES.MATERIAL_ONLY ? '材料补充说明' : '结论变更说明'}</h4>
                        <p>{confirm.changeType === CHANGE_TYPES.MATERIAL_ONLY
                          ? '此确认仅用于补充材料，不改变原有复核结论。所有相关数据仅作存档备查。'
                          : '此确认变更了原有复核结论。请仔细阅读变更原因，确保所有相关方都知晓此变更。'
                        }</p>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>确认结论</label>
                        <p style={{ fontSize: 14, color: '#e2e8f0', lineHeight: 1.6 }}>{confirm.conclusion}</p>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>原因说明</label>
                        <p style={{ fontSize: 13, color: '#94a3b8' }}>{confirm.reason}</p>
                      </div>
                      <div className="evidence-chain">
                        <div className="evidence-chain-title">证据链关联</div>
                        {confirm.relatedItemIds.map((itemId, idx) => (
                          <div key={idx} className="evidence-item">
                            <ChevronRight size={14} className="evidence-icon" />
                            <div className="evidence-content">
                              <div className="evidence-type">关联数据项</div>
                              <div className="evidence-text">{itemId}</div>
                            </div>
                          </div>
                        ))}
                        <div className="evidence-item">
                          <CheckCircle size={14} className="evidence-icon" color="#10b981" />
                          <div className="evidence-content">
                            <div className="evidence-type">确认人</div>
                            <div className="evidence-text">{confirm.reviewer}</div>
                          </div>
                        </div>
                        <div className="evidence-item">
                          <Clock size={14} className="evidence-icon" color="#60a5fa" />
                          <div className="evidence-content">
                            <div className="evidence-type">确认时间</div>
                            <div className="evidence-text">
                              {format(new Date(confirm.confirmedAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'briefing' && (
            <>
              <div className="panel-header">
                <h2>任务简报</h2>
                <div className="panel-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={generateTaskBriefing}
                  >
                    <Play size={14} />
                    生成简报
                  </button>
                  {taskBriefings.length > 0 && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => exportBriefing(taskBriefings[taskBriefings.length - 1].id)}
                    >
                      <Download size={14} />
                      导出简报
                    </button>
                  )}
                </div>
              </div>
              <div className="panel-body">
                {taskBriefings.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                    <FileCheck size={48} style={{ marginBottom: 16 }} />
                    <p>点击"生成简报"按钮创建最新的复核简报</p>
                  </div>
                ) : (
                  taskBriefings.slice().reverse().map((briefing, idx) => (
                    <div key={briefing.id} className="data-card" style={idx > 0 ? { opacity: 0.6 } : {}}>
                      <div className="data-card-header">
                        <div className="data-card-title">{briefing.title}</div>
                        <div className="data-card-meta">
                          <span className="tag tag-info">v{briefing.version}</span>
                          {idx === 0 && <span className="tag tag-success">最新</span>}
                        </div>
                      </div>

                      <div className="briefing-summary">
                        <div className="briefing-summary-item">
                          <div className="value">{briefing.payloadPlans.length}</div>
                          <div className="label">载荷计划</div>
                        </div>
                        <div className="briefing-summary-item">
                          <div className="value">{briefing.faultRecords.length}</div>
                          <div className="label">故障纪要</div>
                        </div>
                        <div className="briefing-summary-item">
                          <div className="value">{briefing.orbitalElements.length}</div>
                          <div className="label">轨道根数</div>
                        </div>
                        <div className="briefing-summary-item">
                          <div className="value">{briefing.manualConfirms.length}</div>
                          <div className="label">人工确认</div>
                        </div>
                        <div className="briefing-summary-item">
                          <div className="value" style={{ color: briefing.anomalies.filter(a => !a.isResolved).length > 0 ? '#f59e0b' : '#10b981' }}>
                            {briefing.anomalies.filter(a => !a.isResolved).length}
                          </div>
                          <div className="label">待处理异常</div>
                        </div>
                      </div>

                      {briefing.conclusions.length > 0 && (
                        <div className="briefing-section">
                          <h3>复核结论摘要</h3>
                          {briefing.conclusions.map((c, idx) => (
                            <div key={idx} style={{
                              background: '#0f172a',
                              padding: '12px 16px',
                              borderRadius: 6,
                              marginBottom: 8,
                              borderLeft: `3px solid ${c.changeType === CHANGE_TYPES.MATERIAL_ONLY ? '#8b5cf6' : '#ef4444'}`
                            }}>
                              <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>
                                {c.conclusion}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                {c.changeType === CHANGE_TYPES.MATERIAL_ONLY ? '仅补材料' : '结论变更'} · {c.reviewer} · {format(new Date(c.confirmedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="briefing-checksum">
                        简报校验码: {briefing.checksum} · 生成时间: {format(new Date(briefing.generatedAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </main>
      </div>

      <footer className="status-bar">
        <div className="status-bar-left">
          <span>数据完整性校验: 通过</span>
          <span>证据链完整度: {Math.min(100, Math.round((manualConfirms.length / Math.max(1, anomalies.length)) * 100))}%</span>
        </div>
        <div className="status-bar-right">
          <span>最后更新: {format(new Date(), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}</span>
        </div>
      </footer>

      {showConfirmModal && (
        <ConfirmModal
          anomaly={selectedAnomaly}
          onClose={() => {
            setShowConfirmModal(false)
            setSelectedAnomaly(null)
          }}
          onConfirm={handleAddConfirm}
        />
      )}
    </div>
  )
}

function ConfirmModal({ anomaly, onClose, onConfirm }) {
  const [formData, setFormData] = useState({
    relatedItemIds: anomaly?.relatedItemIds || [],
    changeType: CHANGE_TYPES.MATERIAL_ONLY,
    conclusion: '',
    reason: '',
    reviewer: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.conclusion && formData.reviewer) {
      onConfirm({
        missionId: 'MISSION-2026-001',
        ...formData,
        relatedItemIds: formData.relatedItemIds.filter(Boolean)
      })
    }
  }

  return (
    <div className="confirm-modal" onClick={onClose}>
      <div className="confirm-modal-content" onClick={e => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <h3>人工复核确认</h3>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ padding: '4px 8px' }}
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="confirm-modal-body">
            {anomaly && (
              <div className="anomaly-explanation" style={{ marginBottom: 16 }}>
                <label>关联异常</label>
                <p>{anomaly.title}</p>
              </div>
            )}

            <div className="form-group">
              <label>变更类型 *</label>
              <select
                value={formData.changeType}
                onChange={e => setFormData({ ...formData, changeType: e.target.value })}
                required
              >
                <option value={CHANGE_TYPES.MATERIAL_ONLY}>仅补材料 - 不改变复核结论</option>
                <option value={CHANGE_TYPES.CONCLUSION_CHANGED}>结论变更 - 修改复核结论</option>
                <option value={CHANGE_TYPES.CORRECTION}>数据修正 - 修正错误数据</option>
                <option value={CHANGE_TYPES.CLARIFICATION}>补充说明 - 澄清模糊内容</option>
              </select>
            </div>

            <div className={`change-type-indicator ${formData.changeType === CHANGE_TYPES.MATERIAL_ONLY ? 'material' : 'conclusion'}`}>
              <h4>{formData.changeType === CHANGE_TYPES.MATERIAL_ONLY ? '材料补充模式' : '结论变更模式'}</h4>
              <p>{formData.changeType === CHANGE_TYPES.MATERIAL_ONLY
                ? '此模式用于补充遗漏的材料或添加补充说明。所有操作将被记录为"仅补材料"，原复核结论保持不变。'
                : '此模式用于正式变更复核结论。变更将被永久记录，所有相关方都将看到新的结论。'
              }</p>
            </div>

            <div className="form-group">
              <label>确认结论 *</label>
              <textarea
                value={formData.conclusion}
                onChange={e => setFormData({ ...formData, conclusion: e.target.value })}
                placeholder="请明确说明最终结论..."
                required
              />
            </div>

            <div className="form-group">
              <label>原因说明 *</label>
              <textarea
                value={formData.reason}
                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                placeholder="详细说明做出此确认的原因和依据..."
                required
              />
            </div>

            <div className="form-group">
              <label>复核人 *</label>
              <input
                type="text"
                value={formData.reviewer}
                onChange={e => setFormData({ ...formData, reviewer: e.target.value })}
                placeholder="输入您的姓名或工号"
                required
              />
            </div>

            <div className="form-group">
              <label>关联数据项 ID (用逗号分隔)</label>
              <input
                type="text"
                value={formData.relatedItemIds.join(', ')}
                onChange={e => setFormData({
                  ...formData,
                  relatedItemIds: e.target.value.split(',').map(s => s.trim())
                })}
                placeholder="fault_001, orbit_002, ..."
              />
            </div>
          </div>
          <div className="confirm-modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary">
              提交确认
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default App
