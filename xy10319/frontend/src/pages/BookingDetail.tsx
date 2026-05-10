import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { BookingDetail as BookingDetailType, Consultant, Promotion, statusLabels } from '../types'
import { bookingsApi, consultantsApi, promotionsApi } from '../services/api'

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [booking, setBooking] = useState<BookingDetailType | null>(null)
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [showEnroll, setShowEnroll] = useState(false)
  const [showLost, setShowLost] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showReactivate, setShowReactivate] = useState(false)
  
  const [followUpForm, setFollowUpForm] = useState({
    consultant_id: '',
    follow_up_type: '电话跟进',
    content: '',
    next_follow_up_date: ''
  })
  
  const [enrollForm, setEnrollForm] = useState({
    promotion_id: '',
    amount: '',
    notes: ''
  })
  
  const [lostForm, setLostForm] = useState({ lost_reason: '' })
  const [feedbackForm, setFeedbackForm] = useState({ satisfaction: 5, feedback_text: '' })
  const [reactivateForm, setReactivateForm] = useState({
    new_booking_date: '',
    new_consultant_id: '',
    new_course_id: ''
  })

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [bookingData, consultantsData, promotionsData] = await Promise.all([
        bookingsApi.getDetail(Number(id)),
        consultantsApi.getAll(),
        promotionsApi.getAll()
      ])
      setBooking(bookingData)
      setConsultants(consultantsData)
      setPromotions(promotionsData)
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const handleCheckIn = async () => {
    clearMessages()
    try {
      await bookingsApi.checkIn(Number(id))
      setSuccess('签到成功')
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.error || '签到失败')
    }
  }

  const handleNoShow = async (reason: string) => {
    clearMessages()
    try {
      await bookingsApi.markNoShow(Number(id), reason)
      setSuccess('已标记为未到课')
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.error || '操作失败')
    }
  }

  const handleAddFeedback = async () => {
    clearMessages()
    try {
      await bookingsApi.addFeedback(
        Number(id),
        feedbackForm.satisfaction,
        feedbackForm.feedback_text
      )
      setSuccess('反馈已保存')
      setShowFeedback(false)
      setFeedbackForm({ satisfaction: 5, feedback_text: '' })
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.error || '保存失败')
    }
  }

  const handleAddFollowUp = async () => {
    clearMessages()
    try {
      await bookingsApi.addFollowUp(Number(id), {
        consultant_id: Number(followUpForm.consultant_id),
        follow_up_type: followUpForm.follow_up_type,
        content: followUpForm.content,
        next_follow_up_date: followUpForm.next_follow_up_date || undefined
      })
      setSuccess('跟进记录已添加')
      setShowFollowUp(false)
      setFollowUpForm({
        consultant_id: booking?.consultant_id?.toString() || '',
        follow_up_type: '电话跟进',
        content: '',
        next_follow_up_date: ''
      })
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.error || '添加失败')
    }
  }

  const handleEnroll = async () => {
    clearMessages()
    try {
      await bookingsApi.enroll(Number(id), {
        promotion_id: enrollForm.promotion_id ? Number(enrollForm.promotion_id) : undefined,
        amount: enrollForm.amount ? Number(enrollForm.amount) : undefined,
        notes: enrollForm.notes || undefined
      })
      setSuccess('报名成功！')
      setShowEnroll(false)
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.error || '报名失败')
    }
  }

  const handleMarkLost = async () => {
    clearMessages()
    try {
      await bookingsApi.markLost(Number(id), lostForm.lost_reason)
      setSuccess('已标记为流失线索')
      setShowLost(false)
      setLostForm({ lost_reason: '' })
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.error || '操作失败')
    }
  }

  const handleReactivate = async () => {
    clearMessages()
    try {
      const data: any = {}
      if (reactivateForm.new_booking_date) {
        data.new_booking_date = reactivateForm.new_booking_date.replace('T', ' ') + ':00'
      }
      if (reactivateForm.new_consultant_id) {
        data.new_consultant_id = Number(reactivateForm.new_consultant_id)
      }
      await bookingsApi.reactivate(Number(id), data)
      setSuccess('线索已重新激活')
      setShowReactivate(false)
      setReactivateForm({ new_booking_date: '', new_consultant_id: '', new_course_id: '' })
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.error || '操作失败')
    }
  }

  if (loading) {
    return <div className="card"><div className="empty-state">加载中...</div></div>
  }

  if (!booking) {
    return (
      <div className="card">
        <div className="empty-state">预约记录不存在</div>
        <button className="btn btn-primary" onClick={() => navigate('/')}>返回列表</button>
      </div>
    )
  }

  const canCheckIn = booking.status === 'booked' || booking.status === 'following'
  const canFollowUp = booking.status !== 'enrolled'
  const canEnroll = booking.status === 'following' && booking.check_in_time
  const canMarkLost = booking.status !== 'enrolled' && booking.status !== 'lost'
  const canReactivate = booking.status === 'lost'

  return (
    <div>
      <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ marginBottom: '15px' }}>
        ← 返回列表
      </button>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ marginBottom: 0 }}>预约详情 #{booking.id}</h2>
          <span className={`status-badge ${booking.status}`}>
            {statusLabels[booking.status]}
          </span>
        </div>

        <div className="detail-grid">
          <div>
            <div className="section-title">客户信息</div>
            <div className="detail-item">
              <div className="label">孩子姓名</div>
              <div className="value">{booking.child_name}</div>
            </div>
            <div className="detail-item">
              <div className="label">孩子年龄</div>
              <div className="value">{booking.child_age}岁</div>
            </div>
            <div className="detail-item">
              <div className="label">家长姓名</div>
              <div className="value">{booking.parent_name || '-'}</div>
            </div>
            <div className="detail-item">
              <div className="label">联系电话</div>
              <div className="value">{booking.phone || '-'}</div>
            </div>
          </div>

          <div>
            <div className="section-title">预约信息</div>
            <div className="detail-item">
              <div className="label">课程</div>
              <div className="value">{booking.course_name} ({booking.age_range})</div>
            </div>
            <div className="detail-item">
              <div className="label">顾问</div>
              <div className="value">{booking.consultant_name} ({booking.department})</div>
            </div>
            <div className="detail-item">
              <div className="label">预约时间</div>
              <div className="value">{dayjs(booking.booking_date).format('YYYY-MM-DD HH:mm')}</div>
            </div>
            <div className="detail-item">
              <div className="label">签到时间</div>
              <div className="value">
                {booking.check_in_time 
                  ? dayjs(booking.check_in_time).format('YYYY-MM-DD HH:mm')
                  : '未签到'
                }
              </div>
            </div>
          </div>
        </div>

        {booking.satisfaction && (
          <div style={{ marginTop: '20px' }}>
            <div className="section-title">家长反馈</div>
            <div className="detail-item">
              <div className="label">满意度</div>
              <div className="rating">
                {[1, 2, 3, 4, 5].map(i => (
                  <span key={i} className={`star ${i <= booking.satisfaction! ? 'filled' : ''}`}>★</span>
                ))}
              </div>
            </div>
            {booking.feedback_text && (
              <div className="detail-item">
                <div className="label">反馈内容</div>
                <div className="value">{booking.feedback_text}</div>
              </div>
            )}
          </div>
        )}

        {booking.enrollment_id && (
          <div style={{ marginTop: '20px' }}>
            <div className="section-title">报名信息</div>
            <div className="detail-grid">
              <div className="detail-item">
                <div className="label">报名时间</div>
                <div className="value">{dayjs(booking.enrollment_date).format('YYYY-MM-DD HH:mm')}</div>
              </div>
              <div className="detail-item">
                <div className="label">报名金额</div>
                <div className="value">¥{booking.amount}</div>
              </div>
              <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                <div className="label">备注</div>
                <div className="value">{booking.enrollment_notes || '-'}</div>
              </div>
            </div>
          </div>
        )}

        {booking.lost_history.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div className="section-title">流失历史记录</div>
            {booking.lost_history.map(lost => (
              <div key={lost.id} className="card" style={{ padding: '15px', marginBottom: '10px' }}>
                <div className="detail-item">
                  <div className="label">流失时间</div>
                  <div className="value">{dayjs(lost.lost_date).format('YYYY-MM-DD HH:mm')}</div>
                </div>
                <div className="detail-item">
                  <div className="label">流失原因</div>
                  <div className="value">{lost.lost_reason}</div>
                </div>
                {lost.reactivated_at && (
                  <div className="detail-item">
                    <div className="label">重新激活时间</div>
                    <div className="value" style={{ color: '#4caf50' }}>
                      {dayjs(lost.reactivated_at).format('YYYY-MM-DD HH:mm')}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="section-title" style={{ marginTop: '20px' }}>跟进记录</div>
        {booking.follow_ups.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px' }}>暂无跟进记录</div>
        ) : (
          <ul className="timeline">
            {booking.follow_ups.map(fu => (
              <li key={fu.id} className="timeline-item">
                <div className="time">{dayjs(fu.created_at).format('YYYY-MM-DD HH:mm')}</div>
                <div className="type">{fu.follow_up_type} - {fu.consultant_name}</div>
                <div className="content">{fu.content}</div>
                {fu.next_follow_up_date && (
                  <div style={{ fontSize: '12px', color: '#667eea', marginTop: '5px' }}>
                    下次跟进：{dayjs(fu.next_follow_up_date).format('YYYY-MM-DD')}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="section-title">操作</div>
        <div className="action-buttons">
          {canCheckIn && (
            <>
              <button className="btn btn-success" onClick={handleCheckIn}>
                签到确认
              </button>
              <button className="btn btn-danger" onClick={() => handleNoShow('未到课')}>
                标记未到课
              </button>
            </>
          )}
          
          {canFollowUp && (
            <>
              <button className="btn btn-primary" onClick={() => setShowFollowUp(true)}>
                添加跟进
              </button>
              <button className="btn btn-warning" onClick={() => setShowFeedback(true)}>
                记录反馈
              </button>
            </>
          )}
          
          {canEnroll && (
            <button className="btn btn-success" onClick={() => setShowEnroll(true)}>
              正式报名
            </button>
          )}
          
          {canMarkLost && (
            <button className="btn btn-secondary" onClick={() => setShowLost(true)}>
              标记流失
            </button>
          )}
          
          {canReactivate && (
            <button className="btn btn-success" onClick={() => setShowReactivate(true)}>
              重新激活
            </button>
          )}
        </div>

        {booking.status === 'no_show' && (
          <div className="alert alert-info" style={{ marginTop: '15px' }}>
            未到课的预约不能转正式报名。如需报名，请重新安排试听并完成签到。
          </div>
        )}
        
        {booking.status === 'booked' && !booking.check_in_time && (
          <div className="alert alert-warning" style={{ marginTop: '15px' }}>
            请先完成签到，之后才能进行正式报名操作。
          </div>
        )}
      </div>

      {showFollowUp && (
        <div className="modal-overlay" onClick={() => setShowFollowUp(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>添加跟进记录</h3>
            <div className="form-group">
              <label>跟进人</label>
              <select 
                value={followUpForm.consultant_id || booking.consultant_id}
                onChange={e => setFollowUpForm({ ...followUpForm, consultant_id: e.target.value })}
              >
                {consultants.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>跟进方式</label>
              <select 
                value={followUpForm.follow_up_type}
                onChange={e => setFollowUpForm({ ...followUpForm, follow_up_type: e.target.value })}
              >
                <option value="电话跟进">电话跟进</option>
                <option value="微信沟通">微信沟通</option>
                <option value="到店沟通">到店沟通</option>
                <option value="短信提醒">短信提醒</option>
              </select>
            </div>
            <div className="form-group">
              <label>跟进内容</label>
              <textarea 
                value={followUpForm.content}
                onChange={e => setFollowUpForm({ ...followUpForm, content: e.target.value })}
                placeholder="请输入跟进内容..."
              />
            </div>
            <div className="form-group">
              <label>下次跟进时间（可选）</label>
              <input 
                type="date"
                value={followUpForm.next_follow_up_date}
                onChange={e => setFollowUpForm({ ...followUpForm, next_follow_up_date: e.target.value })}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowFollowUp(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleAddFollowUp}>保存</button>
            </div>
          </div>
        </div>
      )}

      {showEnroll && (
        <div className="modal-overlay" onClick={() => setShowEnroll(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>正式报名</h3>
            <div className="alert alert-info">
              请选择优惠并确认报名信息。优惠名额校验会在后端执行，确保不被重复锁定。
            </div>
            <div className="form-group">
              <label>选择优惠（可选）</label>
              <select 
                value={enrollForm.promotion_id}
                onChange={e => setEnrollForm({ ...enrollForm, promotion_id: e.target.value })}
              >
                <option value="">不使用优惠</option>
                {promotions.map(p => (
                  <option key={p.id} value={p.id} disabled={!p.is_available}>
                    {p.name} (-¥{p.discount_amount}) {!p.is_available && '(不可用)'}
                    [已用{p.used_count}/{p.max_count}]
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>报名金额</label>
              <input 
                type="number"
                value={enrollForm.amount}
                onChange={e => setEnrollForm({ ...enrollForm, amount: e.target.value })}
                placeholder="请输入金额"
              />
            </div>
            <div className="form-group">
              <label>备注</label>
              <textarea 
                value={enrollForm.notes}
                onChange={e => setEnrollForm({ ...enrollForm, notes: e.target.value })}
                placeholder="可选"
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowEnroll(false)}>取消</button>
              <button className="btn btn-success" onClick={handleEnroll}>确认报名</button>
            </div>
          </div>
        </div>
      )}

      {showLost && (
        <div className="modal-overlay" onClick={() => setShowLost(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>标记为流失线索</h3>
            <div className="form-group">
              <label>流失原因</label>
              <textarea 
                value={lostForm.lost_reason}
                onChange={e => setLostForm({ ...lostForm, lost_reason: e.target.value })}
                placeholder="请输入流失原因..."
              />
            </div>
            <div className="alert alert-warning">
              标记流失后，该线索会记录在流失历史中。如需重新激活，可以在详情页操作。
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowLost(false)}>取消</button>
              <button className="btn btn-danger" onClick={handleMarkLost}>确认标记</button>
            </div>
          </div>
        </div>
      )}

      {showFeedback && (
        <div className="modal-overlay" onClick={() => setShowFeedback(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>记录家长反馈</h3>
            <div className="form-group">
              <label>满意度</label>
              <select 
                value={feedbackForm.satisfaction}
                onChange={e => setFeedbackForm({ ...feedbackForm, satisfaction: Number(e.target.value) })}
              >
                <option value={5}>5星 - 非常满意</option>
                <option value={4}>4星 - 比较满意</option>
                <option value={3}>3星 - 一般</option>
                <option value={2}>2星 - 不太满意</option>
                <option value={1}>1星 - 很不满意</option>
              </select>
            </div>
            <div className="form-group">
              <label>反馈内容</label>
              <textarea 
                value={feedbackForm.feedback_text}
                onChange={e => setFeedbackForm({ ...feedbackForm, feedback_text: e.target.value })}
                placeholder="请输入家长反馈内容..."
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowFeedback(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleAddFeedback}>保存</button>
            </div>
          </div>
        </div>
      )}

      {showReactivate && (
        <div className="modal-overlay" onClick={() => setShowReactivate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>重新激活流失线索</h3>
            <div className="alert alert-info">
              激活后，该预约的流失记录会保留，状态将更新为"跟进中"。
            </div>
            <div className="form-group">
              <label>新预约时间（可选）</label>
              <input 
                type="datetime-local"
                value={reactivateForm.new_booking_date}
                onChange={e => setReactivateForm({ ...reactivateForm, new_booking_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>更换顾问（可选）</label>
              <select 
                value={reactivateForm.new_consultant_id}
                onChange={e => setReactivateForm({ ...reactivateForm, new_consultant_id: e.target.value })}
              >
                <option value="">不更换</option>
                {consultants.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowReactivate(false)}>取消</button>
              <button className="btn btn-success" onClick={handleReactivate}>确认激活</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
