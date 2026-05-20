import React, { useState, useEffect } from 'react'

function CreateCommandModal({ onClose, onSuccess }) {
  const [devices, setDevices] = useState([])
  const [formData, setFormData] = useState({
    device_id: '',
    command_type: 'REFRESH_CONFIG',
    payload: '{}',
    priority: 0,
    expire_hours: 24
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await fetch('/api/devices')
        const data = await res.json()
        setDevices(data)
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, device_id: data[0].id }))
        }
      } catch (err) {
        console.error('Failed to fetch devices:', err)
      }
    }
    fetchDevices()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      const res = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (res.ok) {
        onSuccess?.()
        onClose()
      }
    } catch (err) {
      console.error('Failed to create command:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const commandTypes = [
    'REFRESH_CONFIG',
    'REBOOT',
    'UPDATE_FIRMWARE',
    'SET_THRESHOLD',
    'SYNC_TIME',
    'BACKUP_DATA',
    'CLEAR_CACHE'
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>➕ 下发新指令</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>目标设备</label>
            <select
              value={formData.device_id}
              onChange={(e) => setFormData({ ...formData, device_id: parseInt(e.target.value) })}
              required
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.status})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>指令类型</label>
            <select
              value={formData.command_type}
              onChange={(e) => setFormData({ ...formData, command_type: e.target.value })}
              required
            >
              {commandTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>优先级 (0-5)</label>
            <input
              type="number"
              min="0"
              max="5"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label>过期时间 (小时)</label>
            <input
              type="number"
              min="1"
              value={formData.expire_hours}
              onChange={(e) => setFormData({ ...formData, expire_hours: parseInt(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label>指令内容 (JSON)</label>
            <textarea
              rows={4}
              value={formData.payload}
              onChange={(e) => setFormData({ ...formData, payload: e.target.value })}
              style={{ fontFamily: 'monospace' }}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-warning" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '提交中...' : '提交'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateCommandModal
