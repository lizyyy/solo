import { useState, useEffect, useCallback } from 'react'
import Papa from 'papaparse'
import './App.css'

const { electronAPI } = window

const RISK_TYPE_MAP = {
  certificate_mismatch: { label: '证书不匹配', icon: '📋' },
  weight_abnormal: { label: '重量异常', icon: '⚖️' },
  claw_reinspection_missing: { label: '爪镶未复检', icon: '🔍' },
  overdue_notification_missing: { label: '逾期未通知', icon: '⏰' },
  deadline_approaching: { label: '取件期限临近', icon: '📅' }
}

const RISK_LEVEL_MAP = {
  critical: { label: '严重', class: 'badge-critical' },
  warning: { label: '警告', class: 'badge-warning' },
  info: { label: '信息', class: 'badge-info' }
}

const JUDGMENT_TYPES = [
  { value: 'confirm_risk', label: '确认风险' },
  { value: 'dismiss_risk', label: '驳回风险（无问题）' },
  { value: 'note_only', label: '仅添加备注' }
]

function App() {
  const [orders, setOrders] = useState([])
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [orderDetail, setOrderDetail] = useState(null)
  const [activeTab, setActiveTab] = useState('risks')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [importError, setImportError] = useState(null)
  const [judgmentForm, setJudgmentForm] = useState({})
  const [noteText, setNoteText] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const loadOrders = useCallback(async () => {
    try {
      const data = await electronAPI.getOrders()
      setOrders(data || [])
    } catch (error) {
      console.error('Failed to load orders:', error)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const loadOrderDetail = useCallback(async (orderId) => {
    if (!orderId) return
    try {
      const detail = await electronAPI.getOrderDetail(orderId)
      setOrderDetail(detail)
    } catch (error) {
      console.error('Failed to load order detail:', error)
    }
  }, [])

  useEffect(() => {
    if (selectedOrderId) {
      loadOrderDetail(selectedOrderId)
    }
  }, [selectedOrderId, loadOrderDetail])

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleFileSelect = async () => {
    const result = await electronAPI.showOpenDialog({
      title: '选择数据文件',
      filters: [
        { name: '数据文件', extensions: ['csv', 'json'] },
        { name: 'CSV 文件', extensions: ['csv'] },
        { name: 'JSON 文件', extensions: ['json'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || !result.filePaths?.length) return

    const filePath = result.filePaths[0]
    const fileResult = await electronAPI.readFile(filePath)

    if (!fileResult.success) {
      setImportError(fileResult.error)
      return
    }

    try {
      let parsedData
      if (filePath.toLowerCase().endsWith('.csv')) {
        const parseResult = Papa.parse(fileResult.content, {
          header: true,
          skipEmptyLines: true
        })
        if (parseResult.errors.length > 0) {
          throw new Error(`CSV 解析错误: ${parseResult.errors[0].message}`)
        }
        parsedData = transformCsvData(parseResult.data)
      } else {
        parsedData = JSON.parse(fileResult.content)
      }

      if (!Array.isArray(parsedData)) {
        parsedData = [parsedData]
      }

      setImportPreview(parsedData)
      setImportError(null)
    } catch (error) {
      setImportError(error.message)
      setImportPreview(null)
    }
  }

  const transformCsvData = (csvData) => {
    const ordersMap = new Map()

    csvData.forEach(row => {
      const orderNumber = row.order_number || row.订单编号
      if (!orderNumber) return

      if (!ordersMap.has(orderNumber)) {
        ordersMap.set(orderNumber, {
          order: {
            order_number: orderNumber,
            customer_name: row.customer_name || row.客户姓名 || '',
            phone: row.phone || row.联系电话 || '',
            repair_type: row.repair_type || row.维修类型 || '',
            description: row.description || row.问题描述 || ''
          },
          certificates: [],
          weightRecords: [],
          processes: [],
          deadline: null
        })
      }

      const orderData = ordersMap.get(orderNumber)

      if (row.stone_number || row.石号) {
        orderData.certificates.push({
          stone_number: row.stone_number || row.石号,
          certificate_number: row.certificate_number || row.证书编号 || null,
          stone_type: row.stone_type || row.宝石类型 || '',
          weight: parseFloat(row.weight || row.重量) || null,
          color: row.color || row.颜色 || '',
          clarity: row.clarity || row.净度 || ''
        })
      }

      if (row.record_type || row.记录类型) {
        orderData.weightRecords.push({
          record_type: row.record_type || row.记录类型,
          weight: parseFloat(row.weight || row.重量) || 0,
          recorded_at: row.recorded_at || row.记录时间 || null
        })
      }

      if (row.process_name || row.工序名称) {
        orderData.processes.push({
          process_name: row.process_name || row.工序名称,
          status: row.status || row.状态 || 'pending',
          is_reinspected: (row.is_reinspected || row.是否复检) === '是' || (row.is_reinspected || row.是否复检) === true || parseInt(row.is_reinspected || row.是否复检) === 1,
          started_at: row.started_at || row.开始时间 || null,
          completed_at: row.completed_at || row.完成时间 || null
        })
      }

      if (row.deadline_date || row.取件期限) {
        orderData.deadline = {
          deadline_date: row.deadline_date || row.取件期限,
          is_notified: (row.is_notified || row.是否通知) === '是' || (row.is_notified || row.是否通知) === true,
          notified_at: row.notified_at || row.通知时间 || null
        }
      }
    })

    return Array.from(ordersMap.values())
  }

  const handleImport = async () => {
    if (!importPreview) return

    setLoading(true)
    try {
      await electronAPI.importData(importPreview)
      showMessage('success', '数据导入成功！')
      setShowImportModal(false)
      setImportPreview(null)
      loadOrders()
    } catch (error) {
      setImportError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRunRiskCheck = async () => {
    if (!selectedOrderId) return

    setLoading(true)
    try {
      await electronAPI.runRiskCheck(selectedOrderId)
      await loadOrderDetail(selectedOrderId)
      showMessage('success', '风险检测完成！')
    } catch (error) {
      showMessage('danger', `风险检测失败: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveJudgment = async (riskCheckId) => {
    const form = judgmentForm[riskCheckId]
    if (!form) return

    try {
      await electronAPI.saveJudgment({
        order_id: selectedOrderId,
        risk_check_id: riskCheckId,
        judgment_type: form.judgment_type,
        note: form.note
      })
      await loadOrderDetail(selectedOrderId)
      setJudgmentForm(prev => {
        const next = { ...prev }
        delete next[riskCheckId]
        return next
      })
      showMessage('success', '改判已保存！')
    } catch (error) {
      showMessage('danger', `保存失败: ${error.message}`)
    }
  }

  const handleSaveNote = async () => {
    if (!noteText.trim() || !selectedOrderId) return

    try {
      await electronAPI.saveNote({
        order_id: selectedOrderId,
        note: noteText.trim()
      })
      setNoteText('')
      await loadOrderDetail(selectedOrderId)
      showMessage('success', '备注已保存！')
    } catch (error) {
      showMessage('danger', `保存失败: ${error.message}`)
    }
  }

  const handleExportMarkdown = async () => {
    if (!selectedOrderId) return

    try {
      const markdown = await electronAPI.exportMarkdown(selectedOrderId)
      if (!markdown) {
        showMessage('danger', '导出失败')
        return
      }

      const result = await electronAPI.showSaveDialog({
        title: '导出 Markdown 交付单',
        defaultPath: `交付单_${orderDetail?.order?.order_number || '订单'}.md`,
        filters: [{ name: 'Markdown 文件', extensions: ['md'] }]
      })

      if (result.canceled) return

      await electronAPI.writeFile(result.filePath, markdown)
      showMessage('success', 'Markdown 交付单已导出！')
    } catch (error) {
      showMessage('danger', `导出失败: ${error.message}`)
    }
  }

  const handleExportJson = async () => {
    if (!selectedOrderId) return

    try {
      const json = await electronAPI.exportJson(selectedOrderId)
      if (!json) {
        showMessage('danger', '导出失败')
        return
      }

      const result = await electronAPI.showSaveDialog({
        title: '导出 JSON 审计明细',
        defaultPath: `审计明细_${orderDetail?.order?.order_number || '订单'}.json`,
        filters: [{ name: 'JSON 文件', extensions: ['json'] }]
      })

      if (result.canceled) return

      await electronAPI.writeFile(result.filePath, json)
      showMessage('success', 'JSON 审计明细已导出！')
    } catch (error) {
      showMessage('danger', `导出失败: ${error.message}`)
    }
  }

  const pendingRisks = orderDetail?.riskChecks?.filter(r => !r.is_resolved) || []
  const resolvedRisks = orderDetail?.riskChecks?.filter(r => r.is_resolved) || []

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="flex justify-between items-center">
          <h1>💎 镶嵌返修复核台</h1>
          <button 
            className="button button-primary"
            onClick={() => setShowImportModal(true)}
          >
            📥 导入数据
          </button>
        </div>
      </header>

      {message && (
        <div className={`alert alert-${message.type}`} style={{ margin: '1rem 1.5rem 0' }}>
          {message.text}
        </div>
      )}

      <main className="app-content">
        <div className="layout-two-column">
          <aside className="sidebar">
            <div className="sidebar-header">
              <h2 className="sidebar-title">订单列表</h2>
              <span className="badge badge-info">{orders.length} 条</span>
            </div>

            <div className="order-list">
              {orders.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <p className="empty-state-text">暂无订单</p>
                  <button 
                    className="button button-primary"
                    onClick={() => setShowImportModal(true)}
                  >
                    导入数据
                  </button>
                </div>
              ) : (
                orders.map(order => (
                  <div
                    key={order.id}
                    className={`order-item ${selectedOrderId === order.id ? 'active' : ''}`}
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    <div className="order-item-number">{order.order_number}</div>
                    <div className="order-item-customer">
                      {order.customer_name || '未填写姓名'}
                      {order.phone && ` · ${order.phone}`}
                    </div>
                    <div className="order-item-meta">
                      {order.unresolved_risks > 0 && (
                        <span className="badge badge-critical">
                          {order.unresolved_risks} 个风险
                        </span>
                      )}
                      {order.deadline_date && (
                        <span className={`badge ${order.is_notified ? 'badge-success' : 'badge-warning'}`}>
                          取件: {order.deadline_date}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>

          <section className="main-content">
            {!selectedOrderId ? (
              <div className="empty-state" style={{ height: '100%' }}>
                <div className="empty-state-icon">👆</div>
                <p className="empty-state-text">请从左侧选择一个订单查看详情</p>
              </div>
            ) : !orderDetail ? (
              <div className="empty-state" style={{ height: '100%' }}>
                <div className="empty-state-icon">⏳</div>
                <p className="empty-state-text">加载中...</p>
              </div>
            ) : (
              <>
                <div className="content-header">
                  <h2 className="content-title">
                    订单: {orderDetail.order.order_number}
                    {orderDetail.order.customer_name && ` - ${orderDetail.order.customer_name}`}
                  </h2>
                  <div className="button-group">
                    <button 
                      className="button button-secondary"
                      onClick={handleRunRiskCheck}
                      disabled={loading}
                    >
                      🔍 风险检测
                    </button>
                    <button 
                      className="button button-secondary"
                      onClick={handleExportMarkdown}
                    >
                      📄 导出 Markdown
                    </button>
                    <button 
                      className="button button-secondary"
                      onClick={handleExportJson}
                    >
                      📊 导出 JSON
                    </button>
                  </div>
                </div>

                <div className="tabs">
                  <div 
                    className={`tab ${activeTab === 'risks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('risks')}
                  >
                    风险检测
                    {pendingRisks.length > 0 && (
                      <span className="tab-count">{pendingRisks.length}</span>
                    )}
                  </div>
                  <div 
                    className={`tab ${activeTab === 'detail' ? 'active' : ''}`}
                    onClick={() => setActiveTab('detail')}
                  >
                    订单详情
                  </div>
                  <div 
                    className={`tab ${activeTab === 'notes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('notes')}
                  >
                    备注记录
                    {orderDetail.notes?.length > 0 && (
                      <span className="tab-count">{orderDetail.notes.length}</span>
                    )}
                  </div>
                  <div 
                    className={`tab ${activeTab === 'judgments' ? 'active' : ''}`}
                    onClick={() => setActiveTab('judgments')}
                  >
                    改判历史
                    {orderDetail.judgments?.length > 0 && (
                      <span className="tab-count">{orderDetail.judgments.length}</span>
                    )}
                  </div>
                </div>

                <div className="content-body">
                  {activeTab === 'risks' && (
                    <div>
                      {pendingRisks.length > 0 && (
                        <div className="detail-section">
                          <h3 className="detail-section-title">⚠️ 待处理风险 ({pendingRisks.length})</h3>
                          {pendingRisks.map(risk => (
                            <div 
                              key={risk.id} 
                              className={`risk-item ${risk.risk_level}`}
                            >
                              <div className="risk-header">
                                <div>
                                  <div className="risk-type">
                                    {RISK_TYPE_MAP[risk.risk_type]?.icon || '⚠️'} {' '}
                                    {RISK_TYPE_MAP[risk.risk_type]?.label || risk.risk_type}
                                  </div>
                                  <div className="risk-description">{risk.description}</div>
                                </div>
                                <span className={`badge ${RISK_LEVEL_MAP[risk.risk_level]?.class}`}>
                                  {RISK_LEVEL_MAP[risk.risk_level]?.label}
                                </span>
                              </div>

                              <div className="risk-actions">
                                <div className="judgment-form">
                                  <div className="form-group">
                                    <label className="form-label">改判类型</label>
                                    <select 
                                      className="form-select"
                                      value={judgmentForm[risk.id]?.judgment_type || ''}
                                      onChange={(e) => setJudgmentForm(prev => ({
                                        ...prev,
                                        [risk.id]: {
                                          ...prev[risk.id],
                                          judgment_type: e.target.value
                                        }
                                      }))}
                                    >
                                      <option value="">请选择...</option>
                                      {JUDGMENT_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="form-group">
                                    <label className="form-label">备注说明</label>
                                    <textarea 
                                      className="form-input form-textarea"
                                      placeholder="请输入改判说明..."
                                      value={judgmentForm[risk.id]?.note || ''}
                                      onChange={(e) => setJudgmentForm(prev => ({
                                        ...prev,
                                        [risk.id]: {
                                          ...prev[risk.id],
                                          note: e.target.value
                                        }
                                      }))}
                                    />
                                  </div>
                                  <button 
                                    className="button button-primary"
                                    onClick={() => handleSaveJudgment(risk.id)}
                                    disabled={!judgmentForm[risk.id]?.judgment_type}
                                  >
                                    保存改判
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {resolvedRisks.length > 0 && (
                        <div className="detail-section">
                          <h3 className="detail-section-title">✅ 已处理风险 ({resolvedRisks.length})</h3>
                          {resolvedRisks.map(risk => (
                            <div 
                              key={risk.id} 
                              className={`risk-item ${risk.risk_level} resolved`}
                            >
                              <div className="risk-header">
                                <div>
                                  <div className="risk-type">
                                    {RISK_TYPE_MAP[risk.risk_type]?.icon || '⚠️'} {' '}
                                    {RISK_TYPE_MAP[risk.risk_type]?.label || risk.risk_type}
                                  </div>
                                  <div className="risk-description">{risk.description}</div>
                                </div>
                                <span className="badge badge-success">已解决</span>
                              </div>
                              {risk.resolved_note && (
                                <div className="judgment-result">
                                  <span className="label">处理说明:</span>
                                  {risk.resolved_note}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {pendingRisks.length === 0 && resolvedRisks.length === 0 && (
                        <div className="empty-state">
                          <div className="empty-state-icon">✅</div>
                          <p className="empty-state-text">暂无风险记录</p>
                          <button 
                            className="button button-primary"
                            onClick={handleRunRiskCheck}
                          >
                            运行风险检测
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'detail' && (
                    <div>
                      <div className="detail-section">
                        <h3 className="detail-section-title">📋 基本信息</h3>
                        <div className="detail-grid">
                          <div className="detail-item">
                            <span className="detail-label">订单编号</span>
                            <span className="detail-value">{orderDetail.order.order_number}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">客户姓名</span>
                            <span className="detail-value">{orderDetail.order.customer_name || '-'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">联系电话</span>
                            <span className="detail-value">{orderDetail.order.phone || '-'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">维修类型</span>
                            <span className="detail-value">{orderDetail.order.repair_type || '-'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">创建时间</span>
                            <span className="detail-value">{orderDetail.order.created_at || '-'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">更新时间</span>
                            <span className="detail-value">{orderDetail.order.updated_at || '-'}</span>
                          </div>
                        </div>
                        {orderDetail.order.description && (
                          <div className="mt-4">
                            <span className="detail-label">问题描述</span>
                            <p className="mt-1">{orderDetail.order.description}</p>
                          </div>
                        )}
                      </div>

                      {orderDetail.deadline && (
                        <div className="detail-section">
                          <h3 className="detail-section-title">📅 取件期限</h3>
                          <div className="detail-grid">
                            <div className="detail-item">
                              <span className="detail-label">取件日期</span>
                              <span className="detail-value">{orderDetail.deadline.deadline_date}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">通知状态</span>
                              <span className={`badge ${orderDetail.deadline.is_notified ? 'badge-success' : 'badge-warning'}`}>
                                {orderDetail.deadline.is_notified ? '已通知' : '未通知'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {orderDetail.certificates?.length > 0 && (
                        <div className="detail-section">
                          <h3 className="detail-section-title">💎 宝石证书 ({orderDetail.certificates.length})</h3>
                          <table className="table">
                            <thead>
                              <tr>
                                <th>石号</th>
                                <th>证书编号</th>
                                <th>宝石类型</th>
                                <th>重量(ct)</th>
                                <th>颜色</th>
                                <th>净度</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orderDetail.certificates.map(cert => (
                                <tr key={cert.id}>
                                  <td className="font-semibold">{cert.stone_number}</td>
                                  <td>
                                    {cert.certificate_number ? (
                                      <span className="badge badge-info">{cert.certificate_number}</span>
                                    ) : (
                                      <span className="badge badge-critical">缺失</span>
                                    )}
                                  </td>
                                  <td>{cert.stone_type || '-'}</td>
                                  <td>{cert.weight || '-'}</td>
                                  <td>{cert.color || '-'}</td>
                                  <td>{cert.clarity || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {orderDetail.weightRecords?.length > 0 && (
                        <div className="detail-section">
                          <h3 className="detail-section-title">⚖️ 称重记录 ({orderDetail.weightRecords.length})</h3>
                          <table className="table">
                            <thead>
                              <tr>
                                <th>记录类型</th>
                                <th>重量(g)</th>
                                <th>记录时间</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orderDetail.weightRecords.map(record => {
                                const typeMap = { before: '维修前', after: '维修后', intermediate: '中间记录' }
                                return (
                                  <tr key={record.id}>
                                    <td>
                                      <span className={`badge ${record.record_type === 'before' ? 'badge-info' : 'badge-success'}`}>
                                        {typeMap[record.record_type] || record.record_type}
                                      </span>
                                    </td>
                                    <td className="font-semibold">{record.weight}</td>
                                    <td>{record.recorded_at || '-'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {orderDetail.processes?.length > 0 && (
                        <div className="detail-section">
                          <h3 className="detail-section-title">🔧 工序记录 ({orderDetail.processes.length})</h3>
                          <table className="table">
                            <thead>
                              <tr>
                                <th>工序名称</th>
                                <th>状态</th>
                                <th>是否复检</th>
                                <th>开始时间</th>
                                <th>完成时间</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orderDetail.processes.map(proc => {
                                const statusMap = { pending: '待处理', in_progress: '进行中', completed: '已完成' }
                                const isClawProcess = proc.process_name.includes('爪镶')
                                return (
                                  <tr key={proc.id}>
                                    <td className="font-semibold">
                                      {isClawProcess && '🐾 '}
                                      {proc.process_name}
                                    </td>
                                    <td>
                                      <span className={`badge ${
                                        proc.status === 'completed' ? 'badge-success' : 
                                        proc.status === 'in_progress' ? 'badge-warning' : 'badge-pending'
                                      }`}>
                                        {statusMap[proc.status] || proc.status}
                                      </span>
                                    </td>
                                    <td>
                                      {isClawProcess ? (
                                        <span className={`badge ${proc.is_reinspected ? 'badge-success' : 'badge-warning'}`}>
                                          {proc.is_reinspected ? '已复检' : '未复检'}
                                        </span>
                                      ) : (
                                        <span className="text-muted">-</span>
                                      )}
                                    </td>
                                    <td>{proc.started_at || '-'}</td>
                                    <td>{proc.completed_at || '-'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'notes' && (
                    <div>
                      <div className="card mb-4">
                        <div className="card-header">添加备注</div>
                        <div className="card-body">
                          <div className="form-group">
                            <textarea 
                              className="form-input form-textarea"
                              placeholder="输入备注内容..."
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                            />
                          </div>
                          <button 
                            className="button button-primary"
                            onClick={handleSaveNote}
                            disabled={!noteText.trim()}
                          >
                            保存备注
                          </button>
                        </div>
                      </div>

                      {orderDetail.notes?.length > 0 ? (
                        <div>
                          <h3 className="detail-section-title">历史备注 ({orderDetail.notes.length})</h3>
                          {orderDetail.notes.map((note, index) => (
                            <div key={note.id} className="card mb-3">
                              <div className="card-header">
                                备注 #{index + 1}
                                <span className="text-sm text-muted" style={{ marginLeft: '1rem' }}>
                                  {note.created_by || '系统管理员'} · {note.created_at}
                                </span>
                              </div>
                              <div className="card-body">
                                <p>{note.note}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state">
                          <div className="empty-state-icon">📝</div>
                          <p className="empty-state-text">暂无备注记录</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'judgments' && (
                    <div>
                      {orderDetail.judgments?.length > 0 ? (
                        <div>
                          <h3 className="detail-section-title">改判历史 ({orderDetail.judgments.length})</h3>
                          {orderDetail.judgments.map(judgment => (
                            <div key={judgment.id} className="card mb-3">
                              <div className="card-header">
                                <span className="font-semibold">
                                  {RISK_TYPE_MAP[judgment.risk_type]?.label || judgment.risk_type}
                                </span>
                                <span className="text-sm text-muted" style={{ marginLeft: '1rem' }}>
                                  {judgment.judged_by || '系统管理员'} · {judgment.judged_at}
                                </span>
                              </div>
                              <div className="card-body">
                                <div className="mb-2">
                                  <span className="detail-label">改判类型:</span>
                                  <span className="ml-2 font-semibold">
                                    {JUDGMENT_TYPES.find(t => t.value === judgment.judgment_type)?.label || judgment.judgment_type}
                                  </span>
                                </div>
                                {judgment.note && (
                                  <div>
                                    <span className="detail-label">备注说明:</span>
                                    <p className="mt-1">{judgment.note}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state">
                          <div className="empty-state-icon">📋</div>
                          <p className="empty-state-text">暂无改判记录</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {showImportModal && (
        <div className="modal-overlay" onClick={() => {
          setShowImportModal(false)
          setImportPreview(null)
          setImportError(null)
        }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📥 导入数据</h3>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowImportModal(false)
                  setImportPreview(null)
                  setImportError(null)
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info mb-4">
                <strong>支持格式:</strong> CSV 和 JSON 文件。CSV 文件需要包含表头。
              </div>

              <button 
                className="button button-primary mb-4"
                onClick={handleFileSelect}
              >
                选择文件
              </button>

              {importError && (
                <div className="alert alert-danger mb-4">
                  {importError}
                </div>
              )}

              {importPreview && (
                <div>
                  <div className="alert alert-success mb-4">
                    已解析到 <strong>{importPreview.length}</strong> 条订单数据
                  </div>

                  <div className="card">
                    <div className="card-header">数据预览</div>
                    <div className="card-body" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {importPreview.map((item, index) => (
                        <div key={index} className="mb-4 pb-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <div className="font-semibold mb-2">
                            订单 #{index + 1}: {item.order.order_number}
                            {item.order.customer_name && ` (${item.order.customer_name})`}
                          </div>
                          <div className="grid grid-3 text-sm text-muted">
                            <div>💎 宝石: {item.certificates?.length || 0}</div>
                            <div>⚖️ 称重: {item.weightRecords?.length || 0}</div>
                            <div>🔧 工序: {item.processes?.length || 0}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="button button-secondary"
                onClick={() => {
                  setShowImportModal(false)
                  setImportPreview(null)
                  setImportError(null)
                }}
              >
                取消
              </button>
              <button 
                className="button button-primary"
                onClick={handleImport}
                disabled={!importPreview || loading}
              >
                {loading ? '导入中...' : '确认导入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
