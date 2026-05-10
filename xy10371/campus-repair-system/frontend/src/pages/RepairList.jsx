import { useState, useEffect } from 'react'
import dayjs from 'dayjs'

const URGENCY_MAP = {
  urgent: { label: '紧急', color: 'bg-red-100 text-red-700' },
  normal: { label: '普通', color: 'bg-yellow-100 text-yellow-700' },
  low: { label: '低', color: 'bg-green-100 text-green-700' }
}

const STATUS_MAP = {
  pending: { label: '待派工', color: 'bg-gray-100 text-gray-700' },
  assigned: { label: '已派工', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: '进行中', color: 'bg-purple-100 text-purple-700' },
  completed: { label: '已完工', color: 'bg-green-100 text-green-700' }
}

const CATEGORIES = ['水电', '门窗', '家具', '网络', '其他']
const BUILDINGS = ['1号楼', '2号楼', '3号楼', '4号楼', '5号楼']

function RepairList() {
  const [orders, setOrders] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showRateModal, setShowRateModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [newOrder, setNewOrder] = useState({
    student_id: '',
    building: '',
    room: '',
    category: '',
    description: '',
    urgency: 'normal'
  })
  const [rating, setRating] = useState(5)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchOrders()
    fetchStudents()
  }, [statusFilter])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const url = statusFilter ? `/api/orders?status=${statusFilter}` : '/api/orders'
      const res = await fetch(url)
      const data = await res.json()
      setOrders(data)
    } catch (e) {
      console.error('获取工单失败', e)
    } finally {
      setLoading(false)
    }
  }

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students')
      const data = await res.json()
      setStudents(data)
    } catch (e) {
      console.error('获取学生列表失败', e)
    }
  }

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleSubmitOrder = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder)
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('success', '报修提交成功！')
        setShowCreateModal(false)
        setNewOrder({
          student_id: '',
          building: '',
          room: '',
          category: '',
          description: '',
          urgency: 'normal'
        })
        fetchOrders()
      } else {
        showMessage('error', data.message || data.error)
      }
    } catch (e) {
      showMessage('error', '提交失败，请重试')
    }
  }

  const handleRate = async () => {
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ satisfaction: rating })
      })
      if (res.ok) {
        showMessage('success', '评价提交成功！')
        setShowRateModal(false)
        fetchOrders()
      } else {
        const data = await res.json()
        showMessage('error', data.error)
      }
    } catch (e) {
      showMessage('error', '评价失败，请重试')
    }
  }

  const renderStars = (count, interactive = false) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => interactive && setRating(star)}
            className={`text-2xl transition-colors ${
              interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'
            }`}
          >
            {star <= count ? '⭐' : '☆'}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-gray-900">报修列表</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select w-40"
          >
            <option value="">全部状态</option>
            <option value="pending">待派工</option>
            <option value="assigned">已派工</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完工</option>
          </select>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          + 提交报修
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">暂无报修工单</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">工单信息</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">紧急程度</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">维修师傅</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">满意度</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{order.category} - {order.building}{order.room}</div>
                      <div className="text-sm text-gray-500">{order.description}</div>
                      <div className="text-xs text-gray-400 mt-1">提交人：{order.student_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${URGENCY_MAP[order.urgency].color}`}>
                        {URGENCY_MAP[order.urgency].label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${STATUS_MAP[order.status].color}`}>
                        {STATUS_MAP[order.status].label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {order.worker_name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {dayjs(order.created_at).format('YYYY-MM-DD HH:mm')}
                    </td>
                    <td className="px-6 py-4">
                      {order.satisfaction ? renderStars(order.satisfaction) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      {order.status === 'completed' && !order.satisfaction && (
                        <button
                          onClick={() => {
                            setSelectedOrder(order)
                            setRating(5)
                            setShowRateModal(true)
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          评价
                        </button>
                      )}
                      {order.material_usages && order.material_usages.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          领用材料：{order.material_usages.map(m => `${m.material_name}x${m.quantity}`).join('、')}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-6">提交报修</h3>
            <form onSubmit={handleSubmitOrder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">学生</label>
                <select
                  value={newOrder.student_id}
                  onChange={(e) => setNewOrder({ ...newOrder, student_id: e.target.value })}
                  className="select"
                  required
                >
                  <option value="">请选择学生</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} - {s.dormitory}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">楼栋</label>
                  <select
                    value={newOrder.building}
                    onChange={(e) => setNewOrder({ ...newOrder, building: e.target.value })}
                    className="select"
                    required
                  >
                    <option value="">请选择</option>
                    {BUILDINGS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">房间号</label>
                  <input
                    type="text"
                    value={newOrder.room}
                    onChange={(e) => setNewOrder({ ...newOrder, room: e.target.value })}
                    className="input"
                    placeholder="如：302"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">报修类型</label>
                <select
                  value={newOrder.category}
                  onChange={(e) => setNewOrder({ ...newOrder, category: e.target.value })}
                  className="select"
                  required
                >
                  <option value="">请选择类型</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">问题描述</label>
                <textarea
                  value={newOrder.description}
                  onChange={(e) => setNewOrder({ ...newOrder, description: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="请详细描述问题..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">紧急程度</label>
                <div className="flex space-x-3">
                  {Object.entries(URGENCY_MAP).map(([key, val]) => (
                    <label key={key} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="urgency"
                        value={key}
                        checked={newOrder.urgency === key}
                        onChange={(e) => setNewOrder({ ...newOrder, urgency: e.target.value })}
                        className="text-blue-600"
                      />
                      <span className={`badge ${val.color}`}>{val.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  提交报修
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRateModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">满意度评价</h3>
            <p className="text-gray-600 mb-4">请对维修服务进行评价</p>
            <div className="flex justify-center mb-6">
              {renderStars(rating, true)}
            </div>
            <div className="text-center text-sm text-gray-500 mb-6">
              当前评分：{rating} 星
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowRateModal(false)}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button onClick={handleRate} className="btn btn-primary">
                提交评价
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RepairList
