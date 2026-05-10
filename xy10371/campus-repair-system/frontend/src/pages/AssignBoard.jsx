import { useState, useEffect } from 'react'
import dayjs from 'dayjs'

const URGENCY_MAP = {
  urgent: { label: '紧急', color: 'bg-red-100 text-red-700', priority: 3 },
  normal: { label: '普通', color: 'bg-yellow-100 text-yellow-700', priority: 2 },
  low: { label: '低', color: 'bg-green-100 text-green-700', priority: 1 }
}

function AssignBoard() {
  const [data, setData] = useState({ pendingOrders: [], availableWorkers: [], buildings: [], urgentOverdue: [] })
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showSkipModal, setShowSkipModal] = useState(false)
  const [skipReason, setSkipReason] = useState('')
  const [selectedWorker, setSelectedWorker] = useState('')
  const [message, setMessage] = useState(null)
  const [filterBuilding, setFilterBuilding] = useState('')

  useEffect(() => {
    fetchData()
    fetchWorkers()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/assign-board')
      const data = await res.json()
      setData(data)
    } catch (e) {
      console.error('获取派工看板数据失败', e)
    } finally {
      setLoading(false)
    }
  }

  const fetchWorkers = async () => {
    try {
      const res = await fetch('/api/workers')
      const data = await res.json()
      setWorkers(data)
    } catch (e) {
      console.error('获取维修师傅列表失败', e)
    }
  }

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleAssign = async () => {
    if (!selectedWorker) {
      showMessage('error', '请选择维修师傅')
      return
    }

    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: selectedWorker })
      })

      if (res.ok) {
        showMessage('success', '派工成功！')
        setShowAssignModal(false)
        fetchData()
        fetchWorkers()
      } else {
        const data = await res.json()
        showMessage('error', data.error)
      }
    } catch (e) {
      showMessage('error', '派工失败，请重试')
    }
  }

  const handleSkip = async () => {
    if (!selectedWorker || !skipReason.trim()) {
      showMessage('error', '请选择维修师傅并填写跳过原因')
      return
    }

    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: selectedWorker, reason: skipReason.trim() })
      })

      if (res.ok) {
        showMessage('success', '已记录跳过原因')
        setShowSkipModal(false)
        setSkipReason('')
        fetchData()
      } else {
        const data = await res.json()
        showMessage('error', data.error)
      }
    } catch (e) {
      showMessage('error', '操作失败，请重试')
    }
  }

  const getMatchingWorkers = (order) => {
    return data.availableWorkers.filter(w => 
      w.specialty === order.category || w.specialty === '综合'
    )
  }

  const filteredOrders = filterBuilding 
    ? data.pendingOrders.filter(o => o.building === filterBuilding)
    : data.pendingOrders

  const getOrderUrgencyClass = (order) => {
    if (order.urgency === 'urgent') {
      const hours = dayjs().diff(dayjs(order.created_at), 'hour')
      if (hours >= 2) {
        return 'border-l-4 border-red-500 bg-red-50'
      }
      return 'border-l-4 border-orange-500'
    }
    return ''
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">📋 派工排序规则说明</h4>
        <div className="text-sm text-blue-700 space-y-1">
          <p><strong>1. 紧急程度优先：</strong>紧急工单 > 普通工单 > 低优先级工单</p>
          <p><strong>2. 等待时间优先：</strong>同一紧急程度下，等待时间越长排序越靠前</p>
          <p><strong>3. 师傅匹配优先：</strong>优先推荐擅长该报修类型的师傅</p>
          <p><strong>4. 任务负荷优先：</strong>优先选择当前任务量少的师傅</p>
          <p className="text-blue-600 italic mt-2">注：被跳过的工单会保留跳过原因和相关师傅信息，便于追溯调度历史。</p>
        </div>
      </div>

      {data.urgentOverdue && data.urgentOverdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <span className="text-red-600 text-xl">🚨</span>
            <h4 className="font-medium text-red-800">
              有 {data.urgentOverdue.length} 个紧急工单超过2小时未派工！
            </h4>
          </div>
          <ul className="mt-2 text-sm text-red-700">
            {data.urgentOverdue.slice(0, 3).map(order => (
              <li key={order.id}>
                • {order.building}{order.room} - {order.description} 
                <span className="text-red-500">（已等待 {dayjs().diff(dayjs(order.created_at), 'hour')} 小时）</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">待派工工单</h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">共 {filteredOrders.length} 单</span>
                {data.buildings && data.buildings.length > 0 && (
                  <select
                    value={filterBuilding}
                    onChange={(e) => setFilterBuilding(e.target.value)}
                    className="select w-32 text-sm"
                  >
                    <option value="">全部楼栋</option>
                    {data.buildings.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="text-center py-8 text-gray-500">加载中...</div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">暂无待派工工单</div>
              ) : (
                <div className="space-y-3">
                  {filteredOrders.map((order, index) => {
                    const matchingWorkers = getMatchingWorkers(order)
                    const skippedLogs = order.assignment_logs?.filter(l => l.action === 'skipped') || []
                    
                    return (
                      <div
                        key={order.id}
                        className={`p-4 rounded-lg border border-gray-200 ${getOrderUrgencyClass(order)} hover:shadow-md transition-shadow`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <span className="text-sm text-gray-400">#{index + 1}</span>
                              <h4 className="font-medium text-gray-900">
                                {order.category} - {order.building}{order.room}
                              </h4>
                              <span className={`badge ${URGENCY_MAP[order.urgency].color}`}>
                                {URGENCY_MAP[order.urgency].label}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{order.description}</p>
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>提交人：{order.student_name}</span>
                              <span>等待时间：{dayjs().diff(dayjs(order.created_at), 'hour')} 小时</span>
                            </div>
                            
                            {skippedLogs.length > 0 && (
                              <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                <p className="text-xs font-medium text-yellow-800 mb-1">⚠️ 调度历史（已被跳过）：</p>
                                <ul className="text-xs text-yellow-700 space-y-1">
                                  {skippedLogs.map(log => (
                                    <li key={log.id}>
                                      • {log.worker_name || '未知师傅'}：{log.reason}
                                      <span className="text-yellow-500">（{dayjs(log.timestamp).format('HH:mm')}）</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col space-y-2 ml-4">
                            <button
                              onClick={() => {
                                setSelectedOrder(order)
                                setSelectedWorker('')
                                setShowAssignModal(true)
                              }}
                              className="btn btn-primary text-sm px-4 py-1.5"
                            >
                              派工
                            </button>
                            <button
                              onClick={() => {
                                setSelectedOrder(order)
                                setSelectedWorker('')
                                setSkipReason('')
                                setShowSkipModal(true)
                              }}
                              className="btn btn-secondary text-sm px-4 py-1.5"
                            >
                              跳过
                            </button>
                          </div>
                        </div>
                        
                        {matchingWorkers.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-2">推荐师傅：</p>
                            <div className="flex flex-wrap gap-2">
                              {matchingWorkers.map(w => (
                                <span
                                  key={w.id}
                                  className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                                >
                                  {w.name} ({w.specialty})
                                </span>
                              ))}
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
        </div>

        <div className="lg:col-span-1">
          <div className="card">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">可用维修师傅</h3>
            </div>
            <div className="p-4">
              {data.availableWorkers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">暂无可用师傅</div>
              ) : (
                <div className="space-y-3">
                  {data.availableWorkers.map(worker => (
                    <div
                      key={worker.id}
                      className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{worker.name}</h4>
                          <p className="text-sm text-gray-500">工号：{worker.worker_id}</p>
                        </div>
                        <span className="badge bg-green-100 text-green-700">空闲</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <span>擅长：{worker.specialty}</span>
                        <span>当前任务：{worker.current_tasks} 个</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAssignModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">派工</h3>
            
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900">
                {selectedOrder.category} - {selectedOrder.building}{selectedOrder.room}
              </p>
              <p className="text-sm text-gray-600 mt-1">{selectedOrder.description}</p>
              <p className="text-xs text-gray-500 mt-2">提交人：{selectedOrder.student_name}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">选择维修师傅</label>
              <select
                value={selectedWorker}
                onChange={(e) => setSelectedWorker(e.target.value)}
                className="select"
              >
                <option value="">请选择师傅</option>
                {data.availableWorkers.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.specialty}) - 任务量：{w.current_tasks}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button onClick={handleAssign} className="btn btn-primary">
                确认派工
              </button>
            </div>
          </div>
        </div>
      )}

      {showSkipModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">记录跳过原因</h3>
            
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900">
                {selectedOrder.category} - {selectedOrder.building}{selectedOrder.room}
              </p>
              <p className="text-sm text-gray-600 mt-1">{selectedOrder.description}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">涉及的师傅</label>
              <select
                value={selectedWorker}
                onChange={(e) => setSelectedWorker(e.target.value)}
                className="select"
              >
                <option value="">请选择师傅</option>
                {data.availableWorkers.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.specialty})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">跳过原因</label>
              <textarea
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                className="input"
                rows={3}
                placeholder="请填写跳过原因，例如：该师傅正在处理其他紧急工单..."
              />
              <p className="text-xs text-gray-500 mt-1">此记录将保留在工单调度历史中</p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowSkipModal(false)}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button onClick={handleSkip} className="btn btn-warning">
                记录原因
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AssignBoard
