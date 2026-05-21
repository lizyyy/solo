import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { inventoryApi } from '../services/api'

function BatchDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [batch, setBatch] = useState(null)
  const [occupancies, setOccupancies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [releasingId, setReleasingId] = useState(null)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [batchRes, occRes] = await Promise.all([
        inventoryApi.getBatch(id),
        inventoryApi.getOccupancies()
      ])
      setBatch(batchRes.data.data)
      setOccupancies(occRes.data.data.filter(o => o.batch_id === id))
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRelease = async (occupancyId) => {
    try {
      setReleasingId(occupancyId)
      await inventoryApi.releaseOccupancy(occupancyId, {
        operator: '管理员',
        reason: '手动释放'
      })
      setSuccess('占用已释放！')
      loadData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setReleasingId(null)
    }
  }

  if (loading) return <div className="loading">加载中...</div>
  if (error) return <div className="error">{error}</div>
  if (!batch) return <div className="empty">批次不存在</div>

  return (
    <div>
      <button className="back-btn" onClick={() => navigate('/batches')}>
        ← 返回列表
      </button>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h2>批次详情 - {batch.medicine_name}</h2>
          <span className={`badge ${batch.expiry_status}`}>
            {batch.expiry_status === 'critical' ? '临期' : 
             batch.expiry_status === 'warning' ? '预警' : '正常'}
          </span>
        </div>
        <div className="card-body">
          <div className="detail-row">
            <div className="detail-item">
              <label>药品编码</label>
              <div className="value">{batch.medicine_code}</div>
            </div>
            <div className="detail-item">
              <label>药品名称</label>
              <div className="value">{batch.medicine_name}</div>
            </div>
            <div className="detail-item">
              <label>批号</label>
              <div className="value">{batch.batch_no}</div>
            </div>
            <div className="detail-item">
              <label>来源系统</label>
              <div className="value">{batch.source_name}</div>
            </div>
          </div>
          <div className="detail-row">
            <div className="detail-item">
              <label>生产日期</label>
              <div className="value">{batch.production_date ? new Date(batch.production_date).toLocaleDateString() : '-'}</div>
            </div>
            <div className="detail-item">
              <label>有效期至</label>
              <div className="value">{new Date(batch.expiry_date).toLocaleDateString()}</div>
            </div>
            <div className="detail-item">
              <label>库位</label>
              <div className="value">{batch.warehouse_location || '-'}</div>
            </div>
            <div className="detail-item">
              <label>状态</label>
              <div className="value">{batch.status}</div>
            </div>
          </div>
          <div className="detail-row">
            <div className="detail-item">
              <label>库存数量</label>
              <div className="value" style={{ color: '#1890ff' }}>{batch.quantity}</div>
            </div>
            <div className="detail-item">
              <label>已占用</label>
              <div className="value" style={{ color: '#fa8c16' }}>{batch.occupied_quantity}</div>
            </div>
            <div className="detail-item">
              <label>可用数量</label>
              <div className="value" style={{ color: '#52c41a' }}>{batch.quantity - batch.occupied_quantity}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>占用记录</h2>
        </div>
        <div className="card-body">
          {occupancies.length === 0 ? (
            <div className="empty">暂无占用记录</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>数量</th>
                  <th>操作人</th>
                  <th>原因</th>
                  <th>状态</th>
                  <th>占用时间</th>
                  <th>释放时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {occupancies.map(occ => (
                  <tr key={occ.id}>
                    <td>{occ.quantity}</td>
                    <td>{occ.operator || '-'}</td>
                    <td>{occ.reason || '-'}</td>
                    <td><span className={`badge ${occ.status}`}>{occ.status}</span></td>
                    <td>{new Date(occ.created_at).toLocaleString()}</td>
                    <td>{occ.released_at ? new Date(occ.released_at).toLocaleString() : '-'}</td>
                    <td>
                      {occ.status === 'active' && (
                        <button 
                          className="btn btn-sm"
                          style={{ color: '#f5222d', border: '1px solid #ffa39e' }}
                          onClick={() => handleRelease(occ.id)}
                          disabled={releasingId === occ.id}
                        >
                          {releasingId === occ.id ? '释放中...' : '释放'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default BatchDetail
