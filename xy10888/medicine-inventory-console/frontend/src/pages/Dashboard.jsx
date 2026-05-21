import React, { useState, useEffect } from 'react'
import { inventoryApi } from '../services/api'

function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadStatistics()
  }, [])

  const loadStatistics = async () => {
    try {
      setLoading(true)
      const response = await inventoryApi.getStatistics()
      setStats(response.data.data)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">加载中...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">库存批次总数</div>
          <div className="value">{stats?.totalBatches || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">库存总量</div>
          <div className="value">{stats?.totalQuantity || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">已占用数量</div>
          <div className="value" style={{ color: '#fa8c16' }}>{stats?.occupiedQuantity || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">待处理配送</div>
          <div className="value" style={{ color: '#1890ff' }}>{stats?.pendingDeliveries || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">待处理差异</div>
          <div className="value" style={{ color: '#f5222d' }}>{stats?.pendingDiscrepancies || 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>临期预警</h2>
        </div>
        <div className="card-body">
          {stats?.expiringBatches?.length > 0 ? (
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {stats.expiringBatches.map((item, idx) => (
                <div key={idx} className="stat-card">
                  <div className="label">
                    {item.status === 'critical' ? '30天内到期' : item.status === 'warning' ? '90天内到期' : '其他'}
                  </div>
                  <div className={`value`} style={{ 
                    color: item.status === 'critical' ? '#f5222d' : item.status === 'warning' ? '#fa8c16' : '#52c41a' 
                  }}>
                    {item.count}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">暂无临期药品</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>系统说明</h2>
        </div>
        <div className="card-body">
          <ul style={{ paddingLeft: '20px', lineHeight: '2' }}>
            <li><strong>多源同步</strong>：支持HIS、WMS、配送系统等多源库存数据接入</li>
            <li><strong>批号管理</strong>：按药品批号精细化管理，支持批号占用和释放</li>
            <li><strong>临期拦截</strong>：自动识别临期药品，临界期禁止出库占用</li>
            <li><strong>配送对账</strong>：配送单确认时自动核对数量差异</li>
            <li><strong>差异处理</strong>：自动生成差异单，支持人工复核和处理</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
