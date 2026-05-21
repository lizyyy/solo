import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { inventoryApi } from '../services/api'

function Deliveries() {
  const [deliveries, setDeliveries] = useState([])
  const [medicines, setMedicines] = useState([])
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ source_id: '', total_quantity: '' })
  const [success, setSuccess] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [dRes, mRes, sRes] = await Promise.all([
        inventoryApi.getDeliveries(),
        inventoryApi.getMedicines(),
        inventoryApi.getSources()
      ])
      setDeliveries(dRes.data.data)
      setMedicines(mRes.data.data)
      setSources(sRes.data.data)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await inventoryApi.createDelivery(form)
      setSuccess('配送单创建成功！')
      setShowCreate(false)
      setForm({ source_id: '', total_quantity: '' })
      loadData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    }
  }

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h2>配送单列表</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ 新建配送</button>
        </div>
        <div className="card-body">
          {deliveries.length === 0 ? (
            <div className="empty">暂无配送单</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>配送单号</th>
                  <th>来源系统</th>
                  <th>计划数量</th>
                  <th>实收数量</th>
                  <th>状态</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map(d => (
                  <tr key={d.id}>
                    <td>{d.delivery_no}</td>
                    <td>{d.source_name}</td>
                    <td>{d.total_quantity}</td>
                    <td>{d.received_quantity || 0}</td>
                    <td>
                      <span className={`badge ${d.status === 'pending' ? 'pending' : 'normal'}`}>
                        {d.status === 'pending' ? '待确认' : '已完成'}
                      </span>
                    </td>
                    <td>{new Date(d.created_at).toLocaleString()}</td>
                    <td>
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/deliveries/${d.id}`)}
                      >
                        {d.status === 'pending' ? '确认收货' : '查看'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="card">
          <div className="card-header">
            <h2>新建配送单</h2>
            <button className="btn btn-sm" onClick={() => setShowCreate(false)}>取消</button>
          </div>
          <div className="card-body">
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>来源系统 *</label>
                <select 
                  value={form.source_id}
                  onChange={e => setForm({...form, source_id: e.target.value})}
                  required
                >
                  <option value="">请选择</option>
                  {sources.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>计划总数量 *</label>
                <input 
                  type="number" 
                  min="1"
                  value={form.total_quantity}
                  onChange={e => setForm({...form, total_quantity: e.target.value})}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary">创建配送单</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Deliveries
