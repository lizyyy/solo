import { useState } from 'react'
import dayjs from 'dayjs'
import { Consultant, Course } from '../types'
import { bookingsApi } from '../services/api'

interface Props {
  onClose: () => void
  onSuccess: () => void
  consultants: Consultant[]
  courses: Course[]
}

export default function CreateBookingModal({ onClose, onSuccess, consultants, courses }: Props) {
  const [formData, setFormData] = useState({
    child_name: '',
    child_age: '',
    parent_name: '',
    phone: '',
    course_id: '',
    consultant_id: '',
    booking_date: dayjs().add(1, 'day').format('YYYY-MM-DDTHH:mm'),
    notes: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await bookingsApi.create({
        ...formData,
        child_age: Number(formData.child_age),
        course_id: Number(formData.course_id),
        consultant_id: Number(formData.consultant_id),
        booking_date: formData.booking_date.replace('T', ' ') + ':00'
      })
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.error || '创建预约失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>新建试听预约</h3>
        
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="detail-grid">
            <div className="form-group">
              <label>孩子姓名 *</label>
              <input 
                required
                value={formData.child_name}
                onChange={e => setFormData({ ...formData, child_name: e.target.value })}
                placeholder="请输入孩子姓名"
              />
            </div>
            <div className="form-group">
              <label>孩子年龄 *</label>
              <input 
                type="number"
                required
                min="1"
                max="12"
                value={formData.child_age}
                onChange={e => setFormData({ ...formData, child_age: e.target.value })}
                placeholder="岁"
              />
            </div>
            <div className="form-group">
              <label>家长姓名</label>
              <input 
                value={formData.parent_name}
                onChange={e => setFormData({ ...formData, parent_name: e.target.value })}
                placeholder="请输入家长姓名"
              />
            </div>
            <div className="form-group">
              <label>联系电话</label>
              <input 
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="请输入联系电话"
              />
            </div>
            <div className="form-group">
              <label>选择课程 *</label>
              <select 
                required
                value={formData.course_id}
                onChange={e => setFormData({ ...formData, course_id: e.target.value })}
              >
                <option value="">请选择课程</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.age_range})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>负责顾问 *</label>
              <select 
                required
                value={formData.consultant_id}
                onChange={e => setFormData({ ...formData, consultant_id: e.target.value })}
              >
                <option value="">请选择顾问</option>
                {consultants.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.department})</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>预约时间 *</label>
              <input 
                type="datetime-local"
                required
                value={formData.booking_date}
                onChange={e => setFormData({ ...formData, booking_date: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>备注</label>
              <textarea 
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="可选，填写备注信息"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '创建中...' : '创建预约'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
