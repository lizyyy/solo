import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { inventoryApi } from '../services/api'

function DeliveryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [delivery, setDelivery] = useState(null)
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([{ medicine_id: '', batch_no: '', planned_quantity: '', actual_quantity: '', expiry_date: '' }])
  const [operator, setOperator] = useState('')
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [dRes, mRes] = await Promise.all([
        inventoryApi.getDelivery(id),
        inventoryApi.getMedicines()
      ])
      setDelivery(dRes.data.data)
      setMedicines(mRes.data.data)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  const addItem = () => {
    setItems([...items, { medicine_id: '', batch_no: '', planned_quantity: '', actual_quantity: '', expiry_date: '' }])
  }

  const removeItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const updateItem = (idx, field, value) => {
    const newItems = [...items]
    newItems[idx][field] = value
    setItems(newItems)
  }

  const handleConfirm = async (e) => {
    e.preventDefault()
    try {
      await inventoryApi.confirmDelivery(id, { items, operator })
      setSuccess('配送确认成功！已自动生成差异单并更新库存。')
      setTimeout(() => {
        navigate('/deliveries')
      }, 2000)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    }
  }

  if (loading) return <div className="loading">加载中...</div>
  if (error) return <div className="error">{error}</div>
  if (!delivery) return <div className="empty">配送单不存在</div>

  return (
    <div>
      <button className="back-btn" onClick={() => navigate('/deliveries')}>
        ← 返回列表
      </button>

      {success && <div className="success">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h2>配送单详情 - {delivery.delivery_no}</h2>
          <span className={`badge ${delivery.status === 'pending' ? 'pending' : 'normal'}`}>
            {delivery.status === 'pending' ? '待确认' : '已完成'}
          </span>
        </div>
        <div className="card-body">
          <div className="detail-row">
            <div className="detail-item">
              <label>配送单号</label>
              <div className="value">{delivery.delivery_no}</div>
            </div>
            <div className="detail-item">
              <label>来源系统</label>
              <div className="value">{delivery.source_name}</div>
            </div>
            <div className="detail-item">
              <label>计划总数量</label>
              <div className="value">{delivery.total_quantity}</div>
            </div>
            <div className="detail-item">
              <label>实收数量</label>
              <div className="value">{delivery.received_quantity || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {delivery.status === 'pending' && (
        <div className="card">
          <div className="card-header">
            <h2>确认收货</h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleConfirm}>
              <div className="form-group">
                <label>操作人 *</label>
                <input 
                  type="text" 
                  value={operator}
                  onChange={e => setOperator(e.target.value)}
                  required
                />
              </div>

              <h4 style={{ margin: '16px 0 8px' }}>配送明细</h4>
              {items.map((item, idx) => (
                <div key={idx} style={{ padding: '12px', background: '#fafafa', borderRadius: '4px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span>药品 {idx + 1}</span>
                    {items.length > 1 && (
                      <button type="button" className="btn btn-sm" style={{ color: '#f5222d' }} onClick={() => removeItem(idx)}>删除</button>
                    )}
                  </div>
                  <div className="detail-row">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>药品 *</label>
                      <select 
                        value={item.medicine_id}
                        onChange={e => updateItem(idx, 'medicine_id', e.target.value)}
                        required
                      >
                        <option value="">请选择</option>
                        {medicines.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>批号 *</label>
                      <input 
                        type="text" 
                        value={item.batch_no}
                        onChange={e => updateItem(idx, 'batch_no', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>计划数量 *</label>
                      <input 
                        type="number" 
                        min="0"
                        value={item.planned_quantity}
                        onChange={e => updateItem(idx, 'planned_quantity', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>实际数量 *</label>
                      <input 
                        type="number" 
                        min="0"
                        value={item.actual_quantity}
                        onChange={e => updateItem(idx, 'actual_quantity', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>有效期 *</label>
                      <input 
                        type="date" 
                        value={item.expiry_date}
                        onChange={e => updateItem(idx, 'expiry_date', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  {item.planned_quantity && item.actual_quantity && parseInt(item.actual_quantity) !== parseInt(item.planned_quantity) && (
                    <div style={{ padding: '8px', background: '#fff7e6', borderRadius: '4px', marginTop: '8px' }}>
                      ⚠️ 数量差异: {parseInt(item.actual_quantity) - parseInt(item.planned_quantity)} 
                      {parseInt(item.actual_quantity) - parseInt(item.planned_quantity) > 0 ? ' (多送)' : ' (少送)'}
                      <br/>
                      <small>确认后将自动生成差异单</small>
                    </div>
                  )}
                </div>
              ))}

              <button type="button" className="btn btn-sm" style={{ marginBottom: '16px' }} onClick={addItem}>
                + 添加药品
              </button>

              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary">确认收货并生成差异单</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default DeliveryDetail
