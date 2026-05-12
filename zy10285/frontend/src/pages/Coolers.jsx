import React, { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { commonAPI } from '../utils/api'

const statusMap = {
  available: { text: '可用', class: 'status-signed' },
  in_use: { text: '使用中', class: 'status-dispatched' },
  maintenance: { text: '维修中', class: 'status-refunded' }
}

function Coolers() {
  const [coolers, setCoolers] = useState([])
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    loadCoolers()
  }, [filterStatus])

  const loadCoolers = async () => {
    try {
      const res = await commonAPI.getCoolers(filterStatus || undefined)
      setCoolers(res.data.data || [])
    } catch (error) {
      console.error('加载保温箱失败:', error)
    }
  }

  const handleReturn = async (coolerId) => {
    const notes = prompt('请输入备注:')
    try {
      await commonAPI.returnCooler(coolerId, notes)
      loadCoolers()
    } catch (error) {
      alert('操作失败: ' + error.message)
    }
  }

  const stats = {
    total: coolers.length,
    available: coolers.filter(c => c.status === 'available').length,
    in_use: coolers.filter(c => c.status === 'in_use').length
  }

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">保温箱总数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#52c41a' }}>{stats.available}</div>
          <div className="stat-label">可用</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#faad14' }}>{stats.in_use}</div>
          <div className="stat-label">使用中</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">保温箱管理</h2>
          <div className="filters" style={{ margin: 0 }}>
            <div className="filter-item">
              <label>状态:</label>
              <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">全部</option>
                <option value="available">可用</option>
                <option value="in_use">使用中</option>
                <option value="maintenance">维修中</option>
              </select>
            </div>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>编号</th>
              <th>状态</th>
              <th>当前使用客户</th>
              <th>分配时间</th>
              <th>最近归还时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {coolers.map(cooler => (
              <tr key={cooler.id}>
                <td><strong>{cooler.serial_number}</strong></td>
                <td>
                  <span className={`status-badge ${statusMap[cooler.status]?.class}`}>
                    {statusMap[cooler.status]?.text || cooler.status}
                  </span>
                </td>
                <td>{cooler.customer_name || '-'}</td>
                <td>{cooler.assigned_at ? dayjs(cooler.assigned_at).format('YYYY-MM-DD HH:mm') : '-'}</td>
                <td>{cooler.last_returned_at ? dayjs(cooler.last_returned_at).format('YYYY-MM-DD HH:mm') : '-'}</td>
                <td>
                  {cooler.status === 'in_use' && (
                    <button className="btn btn-sm btn-success" onClick={() => handleReturn(cooler.id)}>
                      归还
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Coolers
