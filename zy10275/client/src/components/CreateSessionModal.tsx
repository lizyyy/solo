import React, { useState } from 'react'
import { CreateSessionRequest } from '../types'

interface CreateSessionModalProps {
  onSubmit: (data: CreateSessionRequest) => void
  onClose: () => void
}

const CreateSessionModal: React.FC<CreateSessionModalProps> = ({ onSubmit, onClose }) => {
  const today = new Date().toISOString().split('T')[0]
  const [formData, setFormData] = useState<CreateSessionRequest>({
    courtNumber: 1,
    date: today,
    startTime: '18:00',
    endTime: '20:00',
    maxPlayers: 4,
    minPlayers: 2,
    totalFee: 120,
    autoCancelIfNotEnough: true,
    cancelThresholdMinutes: 60
  })

  const handleChange = (field: keyof CreateSessionRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>🏸 新开拼场</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>场地号</label>
              <input
                type="number"
                min="1"
                value={formData.courtNumber}
                onChange={e => handleChange('courtNumber', parseInt(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>日期</label>
              <input
                type="date"
                value={formData.date}
                onChange={e => handleChange('date', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>开始时间</label>
              <input
                type="time"
                value={formData.startTime}
                onChange={e => handleChange('startTime', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>结束时间</label>
              <input
                type="time"
                value={formData.endTime}
                onChange={e => handleChange('endTime', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>最大人数</label>
              <input
                type="number"
                min="2"
                value={formData.maxPlayers}
                onChange={e => handleChange('maxPlayers', parseInt(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>最低人数</label>
              <input
                type="number"
                min="1"
                value={formData.minPlayers}
                onChange={e => handleChange('minPlayers', parseInt(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>总费用 (元)</label>
              <input
                type="number"
                min="0"
                value={formData.totalFee}
                onChange={e => handleChange('totalFee', parseInt(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>取消提前通知 (分钟)</label>
              <input
                type="number"
                min="0"
                value={formData.cancelThresholdMinutes}
                onChange={e => handleChange('cancelThresholdMinutes', parseInt(e.target.value))}
              />
            </div>
            <div className="form-group checkbox" style={{ gridColumn: '1 / -1' }}>
              <input
                type="checkbox"
                id="autoCancel"
                checked={formData.autoCancelIfNotEnough}
                onChange={e => handleChange('autoCancelIfNotEnough', e.target.checked)}
              />
              <label htmlFor="autoCancel">人数不足时自动取消场次</label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary">
              创建场次
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateSessionModal
