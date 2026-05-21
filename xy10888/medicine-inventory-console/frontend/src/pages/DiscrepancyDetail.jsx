import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { inventoryApi } from '../services/api'

function DiscrepancyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [discrepancy, setDiscrepancy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ resolution: '', resolver: '', remarks: '' })
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await inventoryApi.getDiscrepancy(id)
      setDiscrepancy(res.data.data)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (e) => {
    e.preventDefault()
    try {
      await inventoryApi.resolveDiscrepancy(id, form)
      setSuccess('差异处理成功！')
      setTimeout(() => {
        navigate('/discrepancies')
      }, 2000)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    }
  }

  if (loading) return <div className="loading">加载中...</div>
  if (error) return <div className="error">{error}</div>
  if (!discrepancy) return <div className="empty">差异单不存在</div>

  return (
    <div>
      <button className="back-btn" onClick={() => navigate('/discrepancies')}>
        ← 返回列表
      </button>

      {success && <div className="success">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h2>差异单详情 - {discrepancy.order_no}</h2>
          <span className={`badge ${discrepancy.status === 'pending' ? 'pending' : 'normal'}`}>
            {discrepancy.status === 'pending' ? '待处理' : '已处理'}
          </span>
        </div>
        <div className="card-body">
          <div className="detail-row">
            <div className="detail-item">
              <label>差异单号</label>
              <div className="value">{discrepancy.order_no}</div>
            </div>
            <div className="detail-item">
              <label>差异类型</label>
              <div className="value">{discrepancy.type}</div>
            </div>
            <div className="detail-item">
              <label>来源系统</label>
              <div className="value">{discrepancy.source_name || '-'}</div>
            </div>
          </div>
          <div className="detail-row">
            <div className="detail-item">
              <label>药品</label>
              <div className="value">{discrepancy.medicine_name || '-'}</div>
            </div>
            <div className="detail-item">
              <label>批号</label>
              <div className="value">{discrepancy.batch_no || '-'}</div>
            </div>
          </div>
          <div className="detail-row">
            <div className="detail-item">
              <label>预期数量</label>
              <div className="value">{discrepancy.expected_quantity}</div>
            </div>
            <div className="detail-item">
              <label>实际数量</label>
              <div className="value">{discrepancy.actual_quantity}</div>
            </div>
            <div className="detail-item">
              <label>差异数量</label>
              <div className="value" style={{ color: discrepancy.difference > 0 ? '#52c41a' : '#f5222d' }}>
                {discrepancy.difference > 0 ? '+' : ''}{discrepancy.difference}
              </div>
            </div>
          </div>
          <div className="detail-row">
            <div className="detail-item">
              <label>发现时间</label>
              <div className="value">{new Date(discrepancy.created_at).toLocaleString()}</div>
            </div>
            {discrepancy.resolver && (
              <>
                <div className="detail-item">
                  <label>处理人</label>
                  <div className="value">{discrepancy.resolver}</div>
                </div>
                <div className="detail-item">
                  <label>处理时间</label>
                  <div className="value">{discrepancy.resolved_at ? new Date(discrepancy.resolved_at).toLocaleString() : '-'}</div>
                </div>
              </>
            )}
          </div>
          {discrepancy.resolution && (
            <div className="form-group">
              <label>处理结果</label>
              <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
                {discrepancy.resolution}
              </div>
            </div>
          )}
        </div>
      </div>

      {discrepancy.status === 'pending' && (
        <div className="card">
          <div className="card-header">
            <h2>处理差异</h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleResolve}>
              <div className="form-group">
                <label>处理人 *</label>
                <input 
                  type="text" 
                  value={form.resolver}
                  onChange={e => setForm({...form, resolver: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>处理结果 *</label>
                <select 
                  value={form.resolution}
                  onChange={e => setForm({...form, resolution: e.target.value})}
                  required
                >
                  <option value="">请选择</option>
                  <option value="供应商补发">供应商补发</option>
                  <option value="库存调整">库存调整</option>
                  <option value="正常损耗">正常损耗</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              <div className="form-group">
                <label>备注</label>
                <textarea 
                  rows="3"
                  value={form.remarks}
                  onChange={e => setForm({...form, remarks: e.target.value})}
                />
              </div>
              <button type="submit" className="btn btn-primary">确认处理</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default DiscrepancyDetail
