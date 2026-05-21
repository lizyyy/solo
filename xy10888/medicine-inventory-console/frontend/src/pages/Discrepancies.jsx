import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { inventoryApi } from '../services/api'

function Discrepancies() {
  const [discrepancies, setDiscrepancies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await inventoryApi.getDiscrepancies()
      setDiscrepancies(res.data.data)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <h2>差异单列表</h2>
        </div>
        <div className="card-body">
          {discrepancies.length === 0 ? (
            <div className="empty">暂无差异单</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>差异单号</th>
                  <th>类型</th>
                  <th>药品</th>
                  <th>批号</th>
                  <th>预期数量</th>
                  <th>实际数量</th>
                  <th>差异</th>
                  <th>状态</th>
                  <th>发现时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {discrepancies.map(d => (
                  <tr key={d.id}>
                    <td>{d.order_no}</td>
                    <td>{d.type}</td>
                    <td>{d.medicine_name || '-'}</td>
                    <td>{d.batch_no || '-'}</td>
                    <td>{d.expected_quantity}</td>
                    <td>{d.actual_quantity}</td>
                    <td style={{ color: d.difference > 0 ? '#52c41a' : '#f5222d' }}>
                      {d.difference > 0 ? '+' : ''}{d.difference}
                    </td>
                    <td>
                      <span className={`badge ${d.status === 'pending' ? 'pending' : 'normal'}`}>
                        {d.status === 'pending' ? '待处理' : '已处理'}
                      </span>
                    </td>
                    <td>{new Date(d.created_at).toLocaleString()}</td>
                    <td>
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/discrepancies/${d.id}`)}
                      >
                        {d.status === 'pending' ? '处理' : '查看'}
                      </button>
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

export default Discrepancies
