import React, { useState, useEffect } from 'react'
import { commonAPI } from '../utils/api'

function CapacityAlerts() {
  const [slots, setSlots] = useState([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const res = await commonAPI.getCapacityAlerts()
      setSlots(res.data.data || [])
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  }

  const getCapacityClass = (slot) => {
    if (slot.alertLevel === 'critical') return 'capacity-critical'
    if (slot.alertLevel === 'warning') return 'capacity-warning'
    return 'capacity-normal'
  }

  const getAlertIcon = (slot) => {
    if (slot.alertLevel === 'critical') return '🔴'
    if (slot.alertLevel === 'warning') return '🟡'
    return '🟢'
  }

  const groupedSlots = slots.reduce((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = []
    acc[slot.date].push(slot)
    return acc
  }, {})

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">产能预警</h2>
        </div>

        {Object.keys(groupedSlots).length === 0 ? (
          <div className="alert alert-success">暂无配送时段数据</div>
        ) : (
          Object.entries(groupedSlots).map(([date, dateSlots]) => (
            <div key={date} style={{ marginBottom: '24px' }}>
              <h3 style={{ marginBottom: '16px', color: '#333' }}>{date}</h3>
              <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {dateSlots.map(slot => {
                  const utilization = Math.min(100, Math.round(slot.current_load / slot.max_capacity * 100))
                  return (
                    <div 
                      key={slot.id} 
                      className="card" 
                      style={{ 
                        marginBottom: 0, 
                        border: slot.alertLevel !== 'normal' ? `2px solid ${slot.alertLevel === 'critical' ? '#f5222d' : '#faad14'}` : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontWeight: 600 }}>
                          {getAlertIcon(slot)} {slot.start_time} - {slot.end_time}
                        </span>
                        <span className={`status-badge status-${slot.alertLevel === 'critical' ? 'refunded' : slot.alertLevel === 'warning' ? 'dispatched' : 'signed'}`}>
                          {utilization}%
                        </span>
                      </div>
                      <div className="capacity-bar">
                        <div 
                          className={`capacity-bar-fill ${getCapacityClass(slot)}`} 
                          style={{ width: `${Math.min(100, utilization)}%` }}
                        />
                      </div>
                      <div style={{ marginTop: '12px', fontSize: '14px', color: '#666' }}>
                        <p>当前负载: <strong>{slot.current_load}kg</strong></p>
                        <p>最大容量: <strong>{slot.max_capacity}kg</strong></p>
                        {slot.current_load > slot.max_capacity && (
                          <p style={{ color: '#f5222d', fontWeight: 600 }}>
                            ⚠️ 已超载 {slot.current_load - slot.max_capacity}kg
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h2 className="card-title" style={{ marginBottom: '16px' }}>图例说明</h2>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="capacity-bar" style={{ width: '60px', margin: 0 }}>
              <div className="capacity-bar-fill capacity-normal" style={{ width: '60%' }} />
            </div>
            <span>正常 (≤ 90%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="capacity-bar" style={{ width: '60px', margin: 0 }}>
              <div className="capacity-bar-fill capacity-warning" style={{ width: '95%' }} />
            </div>
            <span>紧张 (90% - 100%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="capacity-bar" style={{ width: '60px', margin: 0 }}>
              <div className="capacity-bar-fill capacity-critical" style={{ width: '100%' }} />
            </div>
            <span>超载 (> 100%)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CapacityAlerts
