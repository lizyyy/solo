import { useState, useEffect } from 'react'
import dayjs from 'dayjs'

const STATUS_MAP = {
  assigned: { label: '已派工', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: '进行中', color: 'bg-purple-100 text-purple-700' },
  completed: { label: '已完工', color: 'bg-green-100 text-green-700' }
}

function MaterialUsage() {
  const [orders, setOrders] = useState([])
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showMaterialModal, setShowMaterialModal] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [selectedMaterials, setSelectedMaterials] = useState([])
  const [message, setMessage] = useState(null)
  const [activeTab, setActiveTab] = useState('active')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [ordersRes, materialsRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/materials')
      ])
      const [ordersData, materialsData] = await Promise.all([
        ordersRes.json(),
        materialsRes.json()
      ])
      setOrders(ordersData)
      setMaterials(materialsData)
    } catch (e) {
      console.error('获取数据失败', e)
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const activeOrders = orders.filter(o => o.status === 'assigned' || o.status === 'in_progress')
  const completedOrders = orders.filter(o => o.status === 'completed')

  const handleAddMaterial = () => {
    setSelectedMaterials([...selectedMaterials, { material_id: '', quantity: 1 }])
  }

  const handleRemoveMaterial = (index) => {
    const updated = [...selectedMaterials]
    updated.splice(index, 1)
    setSelectedMaterials(updated)
  }

  const handleMaterialChange = (index, field, value) => {
    const updated = [...selectedMaterials]
    updated[index][field] = field === 'quantity' ? parseInt(value) || 0 : value
    setSelectedMaterials(updated)
  }

  const handleSubmitMaterials = async () => {
    const validMaterials = selectedMaterials.filter(m => m.material_id && m.quantity > 0)
    
    if (validMaterials.length === 0) {
      showMessage('error', '请至少选择一种材料并填写数量')
      return
    }

    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materials: validMaterials })
      })

      const data = await res.json()

      if (res.ok) {
        showMessage('success', '材料领用成功！')
        setShowMaterialModal(false)
        setSelectedMaterials([])
        fetchData()
      } else {
        if (data.insufficient) {
          showMessage('error', `材料库存不足：${data.insufficient.map(m => `${m.name}(需要${m.requested}，现有${m.available})`).join('、')}`)
        } else {
          showMessage('error', data.error)
        }
      }
    } catch (e) {
      showMessage('error', '领用失败，请重试')
    }
  }

  const handleComplete = async () => {
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (res.ok) {
        showMessage('success', '完工确认成功！')
        setShowCompleteModal(false)
        fetchData()
      } else {
        const data = await res.json()
        showMessage('error', data.error)
      }
    } catch (e) {
      showMessage('error', '操作失败，请重试')
    }
  }

  const displayOrders = activeTab === 'active' ? activeOrders : completedOrders

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">工单列表</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setActiveTab('active')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === 'active'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    进行中 ({activeOrders.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('completed')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === 'completed'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    已完工 ({completedOrders.length})
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="text-center py-8 text-gray-500">加载中...</div>
              ) : displayOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {activeTab === 'active' ? '暂无进行中的工单' : '暂无已完工工单'}
                </div>
              ) : (
                <div className="space-y-4">
                  {displayOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="font-medium text-gray-900">
                              {order.category} - {order.building}{order.room}
                            </h4>
                            <span className={`badge ${STATUS_MAP[order.status].color}`}>
                              {STATUS_MAP[order.status].label}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{order.description}</p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>提交人：{order.student_name}</span>
                            <span>维修师傅：{order.worker_name || '-'}</span>
                            <span>派工时间：{order.assigned_at ? dayjs(order.assigned_at).format('MM-DD HH:mm') : '-'}</span>
                          </div>

                          {order.material_usages && order.material_usages.length > 0 && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                              <p className="text-xs font-medium text-gray-700 mb-2">已领用材料：</p>
                              <div className="flex flex-wrap gap-2">
                                {order.material_usages.map((usage) => (
                                  <span
                                    key={usage.id}
                                    className="px-2 py-1 bg-white rounded text-xs text-gray-600 border border-gray-200"
                                  >
                                    {usage.material_name} × {usage.quantity} {usage.material_unit}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {(order.status === 'assigned' || order.status === 'in_progress') && (
                          <div className="flex flex-col space-y-2 ml-4">
                            <button
                              onClick={() => {
                                setSelectedOrder(order)
                                setSelectedMaterials([])
                                setShowMaterialModal(true)
                              }}
                              className="btn btn-primary text-sm px-4 py-1.5"
                            >
                              领用材料
                            </button>
                            <button
                              onClick={() => {
                                setSelectedOrder(order)
                                setShowCompleteModal(true)
                              }}
                              className="btn btn-success text-sm px-4 py-1.5"
                            >
                              完工确认
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="card">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">材料库存</h3>
            </div>
            <div className="p-4">
              {materials.length === 0 ? (
                <div className="text-center py-4 text-gray-500">暂无材料</div>
              ) : (
                <div className="space-y-2">
                  {materials.map((material) => (
                    <div
                      key={material.id}
                      className={`p-3 rounded-lg border ${
                        material.stock < 10
                          ? 'bg-red-50 border-red-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm text-gray-900">{material.name}</p>
                          <p className="text-xs text-gray-500">单位：{material.unit}</p>
                        </div>
                        <span className={`text-sm font-bold ${
                          material.stock < 10 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {material.stock}
                        </span>
                      </div>
                      {material.stock < 10 && (
                        <p className="text-xs text-red-500 mt-1">⚠️ 库存不足</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showMaterialModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">领用材料</h3>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900">
                {selectedOrder.category} - {selectedOrder.building}{selectedOrder.room}
              </p>
              <p className="text-sm text-gray-600 mt-1">{selectedOrder.description}</p>
              {selectedOrder.material_usages && selectedOrder.material_usages.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-700">已领用：</p>
                  <p className="text-xs text-gray-500">
                    {selectedOrder.material_usages.map(m => `${m.material_name}×${m.quantity}`).join('、')}
                  </p>
                </div>
              )}
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-700">选择材料</label>
                <button
                  type="button"
                  onClick={handleAddMaterial}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + 添加
                </button>
              </div>

              {selectedMaterials.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">点击上方"添加"按钮选择材料</p>
              ) : (
                <div className="space-y-3">
                  {selectedMaterials.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <select
                        value={item.material_id}
                        onChange={(e) => handleMaterialChange(index, 'material_id', e.target.value)}
                        className="select flex-1 text-sm"
                      >
                        <option value="">请选择材料</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} (库存：{m.stock})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleMaterialChange(index, 'quantity', e.target.value)}
                        className="input w-20 text-sm"
                        placeholder="数量"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveMaterial(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowMaterialModal(false)}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button onClick={handleSubmitMaterials} className="btn btn-primary">
                确认领用
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompleteModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">完工确认</h3>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900">
                {selectedOrder.category} - {selectedOrder.building}{selectedOrder.room}
              </p>
              <p className="text-sm text-gray-600 mt-1">{selectedOrder.description}</p>
              <p className="text-sm text-gray-500 mt-2">维修师傅：{selectedOrder.worker_name}</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-yellow-700">
                ⚠️ 确认完工后，维修师傅将恢复空闲状态，并且不能再领用材料。
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCompleteModal(false)}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button onClick={handleComplete} className="btn btn-success">
                确认完工
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MaterialUsage
