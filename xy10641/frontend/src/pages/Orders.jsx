import React, { useState, useEffect } from 'react'
import axios from 'axios'

function Orders() {
  const [orders, setOrders] = useState([])
  const [credits, setCredits] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    credit_id: '',
    farmer_id: '',
    total_amount: '',
    products: '',
    operator: '王五',
    remarks: ''
  })
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchOrders()
    fetchCredits()
  }, [])

  const fetchOrders = async () => {
    try {
      const res = await axios.get('/api/orders')
      setOrders(res.data)
    } catch (err) {
      console.error('获取订单列表失败:', err)
    }
  }

  const fetchCredits = async () => {
    try {
      const res = await axios.get('/api/credits')
      setCredits(res.data.filter(c => c.status === 'APPROVED'))
    } catch (err) {
      console.error('获取授信列表失败:', err)
    }
  }

  const handleCreditChange = (e) => {
    const creditId = e.target.value
    const credit = credits.find(c => c.id === creditId)
    setFormData({
      ...formData,
      credit_id: creditId,
      farmer_id: credit ? credit.farmer_id : ''
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await axios.post('/api/orders', {
        ...formData,
        products: formData.products.split(',').map(p => p.trim())
      })
      setShowModal(false)
      fetchOrders()
      setMessage({ type: 'success', text: '订单创建成功' })
      setFormData({
        credit_id: '',
        farmer_id: '',
        total_amount: '',
        products: '',
        operator: '王五',
        remarks: ''
      })
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || '创建订单失败' })
    }
  }

  const handleConfirm = async (orderId) => {
    try {
      await axios.post(`/api/orders/${orderId}/confirm`, {
        operator: '王五',
        remarks: '订单确认'
      })
      fetchOrders()
      setMessage({ type: 'success', text: '订单确认成功，已生成还款计划' })
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || '确认订单失败' })
    }
  }

  return (
    <div>
      {message && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>赊销订单</h2>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + 新建订单
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>订单号</th>
              <th>农户</th>
              <th>订单金额</th>
              <th>商品</th>
              <th>状态</th>
              <th>操作员</th>
              <th>下单时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id}>
                <td>{order.order_no}</td>
                <td>{order.farmer_name}</td>
                <td>¥{order.total_amount}</td>
                <td>{Array.isArray(order.products) ? order.products.join(', ') : order.products}</td>
                <td>
                  <span className={`status-badge status-${order.status}`}>
                    {order.status === 'PENDING' ? '待确认' : '已确认'}
                  </span>
                </td>
                <td>{order.operator}</td>
                <td>{new Date(order.order_time).toLocaleString()}</td>
                <td>
                  {order.status === 'PENDING' && (
                    <button 
                      className="btn btn-sm btn-success"
                      onClick={() => handleConfirm(order.id)}
                    >
                      确认订单
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {orders.length === 0 && (
          <div className="empty-state">暂无订单数据</div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>新建赊销订单</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>选择授信（仅显示已通过的授信）</label>
                <select 
                  value={formData.credit_id}
                  onChange={handleCreditChange}
                  required
                >
                  <option value="">请选择授信</option>
                  {credits.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.farmer_name} - 额度: ¥{c.credit_limit} - 可用: ¥{c.credit_limit - c.used_limit}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>订单金额</label>
                <input 
                  type="number"
                  value={formData.total_amount}
                  onChange={e => setFormData({...formData, total_amount: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>商品（逗号分隔）</label>
                <input 
                  type="text"
                  value={formData.products}
                  onChange={e => setFormData({...formData, products: e.target.value})}
                  placeholder="例如：化肥,种子,农药"
                  required
                />
              </div>
              <div className="form-group">
                <label>操作员</label>
                <input 
                  type="text"
                  value={formData.operator}
                  onChange={e => setFormData({...formData, operator: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>备注</label>
                <textarea 
                  value={formData.remarks}
                  onChange={e => setFormData({...formData, remarks: e.target.value})}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">提交</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Orders
