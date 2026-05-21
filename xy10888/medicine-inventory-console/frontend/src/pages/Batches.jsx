import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { inventoryApi } from '../services/api'

function Batches() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showOccupy, setShowOccupy] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [occupyForm, setOccupyForm] = useState({ quantity: '', operator: '', reason: '' })
  const [success, setSuccess] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadBatches()
  }, [])

  const loadBatches = async () => {
    try {
      setLoading(true)
      const response = await inventoryApi.getBatches()
      setBatches(response.data.data)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOccupy = async (e) => {
    e.preventDefault()
    try {
      await inventoryApi.occupyBatch({
        batch_id: selectedBatch.id,
        ...occupyForm
      })
      setSuccess('占用成功！')
      setShowOccupy(false)
      setOccupyForm({ quantity: '', operator: '', reason: '' })
      loadBatches()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    }
  }

  const handleExport = async () => {
    try {
      const response = await inventoryApi.exportBatches()
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `inventory_${Date.now()}.csv`)
      document.body.appendChild(link)
      link.click()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h2>库存批次列表</h2>
          <button className="btn btn-primary btn-sm" onClick={handleExport}>导出CSV</button>
        </div>
        <div className="card-body">
          {batches.length === 0 ? (
            <div className="empty">暂无库存数据</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>药品名称</th>
                  <th>批号</th>
                  <th>有效期至</th>
                  <th>库存数量</th>
                  <th>已占用</th>
                  <th>可用</th>
                  <th>来源</th>
                  <th>临期状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(batch => (
                  <tr key={batch.id}>
                    <td>{batch.medicine_name}</td>
                    <td>{batch.batch_no}</td>
                    <td>{new Date(batch.expiry_date).toLocaleDateString()}</td>
                    <td>{batch.quantity}</td>
                    <td>{batch.occupied_quantity}</td>
                    <td>{batch.quantity - batch.occupied_quantity}</td>
                    <td>{batch.source_name}</td>
                    <td>
                      <span className={`badge ${batch.expiry_status}`}>
                        {batch.expiry_status === 'critical' ? '临期' : 
                         batch.expiry_status === 'warning' ? '预警' : '正常'}
                      </span>
                    </td>
                    <td>
                      <div className="flex">
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate(`/batches/${batch.id}`)}
                        >
                          详情
                        </button>
                        {batch.expiry_status !== 'critical' && (
                          <button 
                            className="btn btn-success btn-sm"
                            onClick={() => {
                              setSelectedBatch(batch)
                              setShowOccupy(true)
                            }}
                          >
                            占用
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showOccupy && selectedBatch && (
        <div className="card">
          <div className="card-header">
            <h2>占用库存 - {selectedBatch.medicine_name} ({selectedBatch.batch_no})</h2>
            <button className="btn btn-sm" onClick={() => setShowOccupy(false)}>取消</button>
          </div>
          <div className="card-body">
            <div className="detail-row">
              <div className="detail-item">
                <label>可用数量</label>
                <div className="value">{selectedBatch.quantity - selectedBatch.occupied_quantity}</div>
              </div>
              <div className="detail-item">
                <label>有效期至</label>
                <div className="value">{new Date(selectedBatch.expiry_date).toLocaleDateString()}</div>
              </div>
            </div>
            <form onSubmit={handleOccupy}>
              <div className="form-group">
                <label>占用数量 *</label>
                <input 
                  type="number" 
                  min="1" 
                  max={selectedBatch.quantity - selectedBatch.occupied_quantity}
                  value={occupyForm.quantity}
                  onChange={e => setOccupyForm({...occupyForm, quantity: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>操作人 *</label>
                <input 
                  type="text" 
                  value={occupyForm.operator}
                  onChange={e => setOccupyForm({...occupyForm, operator: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>占用原因</label>
                <input 
                  type="text" 
                  value={occupyForm.reason}
                  onChange={e => setOccupyForm({...occupyForm, reason: e.target.value})}
                />
              </div>
              <button type="submit" className="btn btn-primary">确认占用</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Batches
