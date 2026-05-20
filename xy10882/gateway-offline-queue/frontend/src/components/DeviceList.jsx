import React, { useState, useEffect } from 'react'

function DeviceList({ onRefresh, onCreateCommand }) {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/devices')
      const data = await res.json()
      setDevices(data)
    } catch (err) {
      console.error('Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDevices()
  }, [])

  const toggleStatus = async (device) => {
    const newStatus = device.status === 'online' ? 'offline' : 'online'
    try {
      await fetch(`/api/devices/${device.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      fetchDevices()
      onRefresh?.()
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  return (
    <div className="section">
      <h2>
        <span>📱 网关设备列表</span>
        <button className="btn btn-primary" onClick={onCreateCommand}>
          ➕ 下发指令
        </button>
      </h2>

      {loading ? (
        <div className="empty-state">加载中...</div>
      ) : devices.length === 0 ? (
        <div className="empty-state">暂无设备</div>
      ) : (
        devices.map((device) => (
          <div key={device.id} className="device-card">
            <div className="device-header">
              <h3>{device.name}</h3>
              <div className="device-status">
                <span className={`status-dot ${device.status}`}></span>
                <span style={{ textTransform: 'capitalize' }}>{device.status}</span>
              </div>
            </div>
            <div className="device-info">
              <div>
                <span style={{ color: '#888' }}>设备ID: </span>
                {device.device_id}
              </div>
              <div>
                <span style={{ color: '#888' }}>最后心跳: </span>
                {new Date(device.last_heartbeat).toLocaleString()}
              </div>
              <div>
                <span style={{ color: '#888' }}>创建时间: </span>
                {new Date(device.created_at).toLocaleString()}
              </div>
            </div>
            <div className="device-actions">
              <button 
                className={`btn btn-small ${device.status === 'online' ? 'btn-danger' : 'btn-success'}`}
                onClick={() => toggleStatus(device)}
              >
                设为{device.status === 'online' ? '离线' : '在线'}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default DeviceList
