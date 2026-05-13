import React, { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { ordersAPI, customersAPI, commonAPI } from '../utils/api'

const statusMap = {
  pending: '待确认',
  confirmed: '已确认',
  dispatched: '配送中',
  signed: '已签收',
  refunded: '已退款'
}

function Dashboard() {
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [iceSpecs, setIceSpecs] = useState([])
  const [deliverySlots, setDeliverySlots] = useState([])
  const [coolers, setCoolers] = useState([])
  const [filters, setFilters] = useState({ status: '', customer_id: '', delivery_date: '' })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [dispatchingOrder, setDispatchingOrder] = useState(null)
  const [selectedCooler, setSelectedCooler] = useState('')
  const [newOrder, setNewOrder] = useState({
    customer_id: '',
    ice_spec_id: '',
    quantity: 10,
    delivery_slot_id: '',
    delivery_address: '',
    contact_phone: ''
  })
  const [capacityCheck, setCapacityCheck] = useState(null)
  const [alert, setAlert] = useState(null)

  useEffect(() => {
    loadData()
  }, [filters])

  const loadData = async () => {
    try {
      const [ordersRes, customersRes, iceSpecsRes, slotsRes, coolersRes] = await Promise.all([
        ordersAPI.getOrders(filters),
        customersAPI.getCustomers(),
        commonAPI.getIceSpecs(),
        commonAPI.getDeliverySlots(),
        commonAPI.getCoolers('available')
      ])
      setOrders(ordersRes.data.data || [])
      setCustomers(customersRes.data.data || [])
      setIceSpecs(iceSpecsRes.data.data || [])
      setDeliverySlots(slotsRes.data.data || [])
      setCoolers(coolersRes.data.data || [])
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  }

  const checkCapacity = async () => {
    if (!newOrder.delivery_slot_id || !newOrder.ice_spec_id || !newOrder.quantity) return
    try {
      const res = await ordersAPI.checkCapacity({
        delivery_slot_id: newOrder.delivery_slot_id,
        quantity: newOrder.quantity,
        ice_spec_id: newOrder.ice_spec_id
      })
      setCapacityCheck(res.data.data)
    } catch (error) {
      console.error('产能检查失败:', error)
    }
  }

  useEffect(() => {
    checkCapacity()
  }, [newOrder.delivery_slot_id, newOrder.ice_spec_id, newOrder.quantity])

  const handleCreateOrder = async () => {
    try {
      const res = await ordersAPI.createOrder(newOrder)
      if (res.data.success) {
        setAlert({ type: 'success', message: '订单创建成功！' })
        setShowCreateModal(false)
        loadData()
        setNewOrder({
          customer_id: '',
          ice_spec_id: '',
          quantity: 10,
          delivery_slot_id: '',
          delivery_address: '',
          contact_phone: ''
        })
      } else {
        setAlert({ type: 'error', message: res.data.message })
      }
    } catch (error) {
      setAlert({ type: 'error', message: '创建订单失败：' + error.message })
    }
  }

  const handleConfirmOrder = async (id) => {
    try {
      await ordersAPI.confirmOrder(id)
      loadData()
      setAlert({ type: 'success', message: '订单已确认' })
    } catch (error) {
      setAlert({ type: 'error', message: '操作失败' })
    }
  }

  const handleDispatchOrder = (order) => {
    setDispatchingOrder(order)
    setSelectedCooler('')
    setShowDispatchModal(true)
  }

  const confirmDispatchOrder = async () => {
    if (!selectedCooler) {
      setAlert({ type: 'error', message: '请选择保温箱' })
      return
    }
    try {
      await ordersAPI.dispatchOrder(dispatchingOrder.id, selectedCooler)
      loadData()
      setShowDispatchModal(false)
      setAlert({ type: 'success', message: '订单已安排配送' })
    } catch (error) {
      setAlert({ type: 'error', message: '操作失败' })
    }
  }

  const handleSignOrder = async (id) => {
    const signedBy = prompt('请输入签收人:')
    if (!signedBy) return
    try {
      await ordersAPI.signOrder(id, signedBy)
      loadData()
      setAlert({ type: 'success', message: '订单已签收' })
    } catch (error) {
      setAlert({ type: 'error', message: '操作失败' })
    }
  }

  const handleRefundOrder = async (id) => {
    const reason = prompt('请输入退款原因:')
    if (!reason) return
    try {
      await ordersAPI.refundOrder(id, reason)
      loadData()
      setAlert({ type: 'success', message: '订单已退款' })
    } catch (error) {
      setAlert({ type: 'error', message: '操作失败' })
    }
  }

  const handleViewDetail = async (id) => {
    try {
      const res = await ordersAPI.getOrder(id)
      setSelectedOrder(res.data.data)
      setShowDetailModal(true)
    } catch (error) {
      setAlert({ type: 'error', message: '加载详情失败' })
    }
  }

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    dispatched: orders.filter(o => o.status === 'dispatched').length,
    signed: orders.filter(o => o.status === 'signed').length
  }

  return (
    <div>
      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.message}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">总订单数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#1890ff' }}>{stats.pending}</div>
          <div className="stat-label">待确认</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#faad14' }}>{stats.dispatched}</div>
          <div className="stat-label">配送中</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#52c41a' }}>{stats.signed}</div>
          <div className="stat-label">已签收</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">订单列表</h2>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + 新建订单
          </button>
        </div>

        <div className="filters">
          <div className="filter-item">
            <label>状态:</label>
            <select className="form-select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">全部</option>
              <option value="pending">待确认</option>
              <option value="confirmed">已确认</option>
              <option value="dispatched">配送中</option>
              <option value="signed">已签收</option>
              <option value="refunded">已退款</option>
            </select>
          </div>
          <div className="filter-item">
            <label>客户:</label>
            <select className="form-select" value={filters.customer_id} onChange={(e) => setFilters({ ...filters, customer_id: e.target.value })}>
              <option value="">全部</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label>配送日期:</label>
            <input type="date" className="form-input" value={filters.delivery_date} onChange={(e) => setFilters({ ...filters, delivery_date: e.target.value })} />
          </div>
          <button className="btn btn-default" onClick={() => setFilters({ status: '', customer_id: '', delivery_date: '' })}>
            重置
          </button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>订单号</th>
              <th>客户</th>
              <th>冰块规格</th>
              <th>数量</th>
              <th>金额</th>
              <th>配送时段</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id}>
                <td>{order.order_no}</td>
                <td>{order.customer_name}</td>
                <td>{order.ice_spec_name}</td>
                <td>{order.quantity}桶</td>
                <td>¥{order.total_amount}</td>
                <td>{order.delivery_date} {order.start_time}-{order.end_time}</td>
                <td>
                  <span className={`status-badge status-${order.status}`}>
                    {statusMap[order.status]}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <button className="btn btn-sm btn-default" onClick={() => handleViewDetail(order.id)}>
                      详情
                    </button>
                    {order.status === 'pending' && (
                      <button className="btn btn-sm btn-primary" onClick={() => handleConfirmOrder(order.id)}>
                        确认
                      </button>
                    )}
                    {order.status === 'confirmed' && (
                      <button className="btn btn-sm btn-warning" onClick={() => handleDispatchOrder(order)}>
                        配送
                      </button>
                    )}
                    {order.status === 'dispatched' && (
                      <button className="btn btn-sm btn-success" onClick={() => handleSignOrder(order.id)}>
                        签收
                      </button>
                    )}
                    {order.status !== 'refunded' && order.status !== 'signed' && (
                      <button className="btn btn-sm btn-danger" onClick={() => handleRefundOrder(order.id)}>
                        退款
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">新建订单</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>

            {capacityCheck && !capacityCheck.available && (
              <div className="alert alert-error">
                ⚠️ 产能预警：该时段负载已达 {capacityCheck.currentLoad}kg，新增 {capacityCheck.additionalLoad}kg 后将超出最大容量 {capacityCheck.maxCapacity}kg
              </div>
            )}
            {capacityCheck && capacityCheck.available && capacityCheck.currentLoad / capacityCheck.maxCapacity > 0.9 && (
              <div className="alert alert-warning">
                ⚠️ 产能紧张：该时段当前负载 {capacityCheck.currentLoad}kg，使用率 {Math.round(capacityCheck.currentLoad / capacityCheck.maxCapacity * 100)}%
              </div>
            )}

            <div className="form-group">
              <label className="form-label">客户</label>
              <select className="form-select" value={newOrder.customer_id} onChange={(e) => setNewOrder({ ...newOrder, customer_id: e.target.value })}>
                <option value="">请选择客户</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="row">
              <div className="col-6">
                <div className="form-group">
                  <label className="form-label">冰块规格</label>
                  <select className="form-select" value={newOrder.ice_spec_id} onChange={(e) => setNewOrder({ ...newOrder, ice_spec_id: e.target.value })}>
                    <option value="">请选择规格</option>
                    {iceSpecs.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.weight}kg - ¥{s.price})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="col-6">
                <div className="form-group">
                  <label className="form-label">数量（桶）</label>
                  <input type="number" className="form-input" value={newOrder.quantity} onChange={(e) => setNewOrder({ ...newOrder, quantity: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">配送时段</label>
              <select className="form-select" value={newOrder.delivery_slot_id} onChange={(e) => setNewOrder({ ...newOrder, delivery_slot_id: e.target.value })}>
                <option value="">请选择时段</option>
                {deliverySlots.map(s => (
                  <option key={s.id} value={s.id}>{s.date} {s.start_time}-{s.end_time} ({s.current_load}/{s.max_capacity}kg)</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">配送地址</label>
              <input type="text" className="form-input" value={newOrder.delivery_address} onChange={(e) => setNewOrder({ ...newOrder, delivery_address: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">联系电话</label>
              <input type="text" className="form-input" value={newOrder.contact_phone} onChange={(e) => setNewOrder({ ...newOrder, contact_phone: e.target.value })} />
            </div>

            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowCreateModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleCreateOrder} disabled={capacityCheck && !capacityCheck.available}>
                创建订单
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">订单详情 - {selectedOrder.order_no}</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>×</button>
            </div>

            <div className="row">
              <div className="col-6">
                <p><strong>客户:</strong> {selectedOrder.customer_name}</p>
                <p><strong>联系电话:</strong> {selectedOrder.contact_phone}</p>
                <p><strong>配送地址:</strong> {selectedOrder.delivery_address || selectedOrder.customer_address}</p>
              </div>
              <div className="col-6">
                <p><strong>冰块规格:</strong> {selectedOrder.ice_spec_name}</p>
                <p><strong>数量:</strong> {selectedOrder.quantity}桶</p>
                <p><strong>总金额:</strong> ¥{selectedOrder.total_amount}</p>
              </div>
            </div>

            <p><strong>配送时段:</strong> {selectedOrder.delivery_date} {selectedOrder.start_time}-{selectedOrder.end_time}</p>
            <p><strong>状态:</strong> <span className={`status-badge status-${selectedOrder.status}`}>{statusMap[selectedOrder.status]}</span></p>
            
            {selectedOrder.cooler_serial && (
              <p><strong>保温箱:</strong> {selectedOrder.cooler_serial}</p>
            )}

            {selectedOrder.signed_by && (
              <p><strong>签收人:</strong> {selectedOrder.signed_by} ({dayjs(selectedOrder.signed_at).format('YYYY-MM-DD HH:mm')})</p>
            )}

            {selectedOrder.refund_reason && (
              <p><strong>退款原因:</strong> {selectedOrder.refund_reason}</p>
            )}

            <h4 style={{ marginTop: '20px', marginBottom: '12px' }}>操作记录</h4>
            <div className="timeline">
              {selectedOrder.history?.map((item, index) => (
                <div key={index} className="timeline-item">
                  <div className="timeline-time">{dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}</div>
                  <div className="timeline-content">{item.action} - {item.notes || ''}</div>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowDetailModal(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {showDispatchModal && dispatchingOrder && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">安排配送 - {dispatchingOrder.order_no}</h3>
              <button className="modal-close" onClick={() => setShowDispatchModal(false)}>×</button>
            </div>

            <div className="form-group">
              <label className="form-label">客户</label>
              <p>{dispatchingOrder.customer_name}</p>
            </div>

            <div className="form-group">
              <label className="form-label">配送时段</label>
              <p>{dispatchingOrder.delivery_date} {dispatchingOrder.start_time}-{dispatchingOrder.end_time}</p>
            </div>

            <div className="form-group">
              <label className="form-label">选择保温箱 *</label>
              <select 
                className="form-select" 
                value={selectedCooler} 
                onChange={(e) => setSelectedCooler(e.target.value)}
              >
                <option value="">请选择可用保温箱</option>
                {coolers.map(c => (
                  <option key={c.id} value={c.serial_number}>{c.serial_number}</option>
                ))}
              </select>
              {coolers.length === 0 && (
                <p style={{ color: '#f5222d', fontSize: '12px', marginTop: '8px' }}>
                  暂无可用保温箱，请先归还已使用的保温箱
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowDispatchModal(false)}>取消</button>
              <button 
                className="btn btn-primary" 
                onClick={confirmDispatchOrder}
                disabled={!selectedCooler || coolers.length === 0}
              >
                确认配送
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
