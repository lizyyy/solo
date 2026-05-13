import React, { useState, useEffect } from 'react'
import axios from 'axios'

function Extensions() {
  const [extensions, setExtensions] = useState([])
  const [repayments, setRepayments] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    repayment_id: '',
    extension_days: 30,
    reason: '',
    applicant: '孙七'
  })
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchExtensions()
    fetchRepayments()
  }, [])

  const fetchExtensions = async () => {
    try {
      const res = await axios.get('/api/extensions')
      setExtensions(res.data)
    } catch (err) {
      console.error('获取展期列表失败:', err)
    }
  }

  const fetchRepayments = async () => {
    try {
      const res = await axios.get('/api/repayments')
      setRepayments(res.data.filter(r => ['PENDING', 'PARTIAL', 'OVERDUE'].includes(r.status)))
    } catch (err) {
      console.error('获取还款列表失败:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await axios.post('/api/extensions', formData)
      setShowModal(false)
      fetchExtensions()
      setMessage({ type: 'success', text: '展期申请提交成功' })
      setFormData({
        repayment_id: '',
        extension_days: 30,
        reason: '',
        applicant: '孙七'
      })
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || '提交失败' })
    }
  }

  const handleApprove = async (id) => {
    try {
      await axios.post(`/api/extensions/${id}/approve`, {
        approver: '周八',
        remarks: '审批通过'
      })
      fetchExtensions()
      fetchRepayments()
      setMessage({ type: 'success', text: '展期审批通过，已更新还款计划' })
    } catch (err) {
      setMessage({ type: 'error', text: '审批失败' })
    }
  }

  const handleReject = async (id) => {
    try {
      await axios.post(`/api/extensions/${id}/reject`, {
        approver: '周八',
        remarks: '审批拒绝'
      })
      fetchExtensions()
      setMessage({ type: 'success', text: '展期已拒绝' })
    } catch (err) {
      setMessage({ type: 'error', text: '拒绝失败' })
    }
  }

  const getStatusText = (status) => {
    const statusMap = {
      'PENDING': '待审批',
      'APPROVED': '已通过',
      'REJECTED': '已拒绝'
    }
    return statusMap[status] || status
  }

  return (
    <div>
      {message && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>展期审批</h2>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + 申请展期
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>农户</th>
              <th>原到期日</th>
              <th>新到期日</th>
              <th>展期天数</th>
              <th>申请原因</th>
              <th>申请人</th>
              <th>申请时间</th>
              <th>状态</th>
              <th>审批人</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {extensions.map(e => (
              <tr key={e.id}>
                <td>{e.farmer_name}</td>
                <td>{e.original_due_date}</td>
                <td>{e.new_due_date}</td>
                <td>{e.extension_days}天</td>
                <td>{e.reason}</td>
                <td>{e.applicant}</td>
                <td>{new Date(e.apply_time).toLocaleString()}</td>
                <td>
                  <span className={`status-badge status-${e.status}`}>
                    {getStatusText(e.status)}
                  </span>
                </td>
                <td>{e.approver || '-'}</td>
                <td>
                  {e.status === 'PENDING' && (
                    <>
                      <button 
                        className="btn btn-sm btn-success"
                        onClick={() => handleApprove(e.id)}
                        style={{marginRight: '5px'}}
                      >
                        通过
                      </button>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => handleReject(e.id)}
                      >
                        拒绝
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {extensions.length === 0 && (
          <div className="empty-state">暂无展期申请</div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>申请展期</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>选择还款计划</label>
                <select 
                  value={formData.repayment_id}
                  onChange={e => setFormData({...formData, repayment_id: e.target.value})}
                  required
                >
                  <option value="">请选择还款计划</option>
                  {repayments.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.farmer_name} - ¥{r.remaining_amount} - 到期日: {r.due_date}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>展期天数</label>
                <input 
                  type="number"
                  value={formData.extension_days}
                  onChange={e => setFormData({...formData, extension_days: parseInt(e.target.value)})}
                  required
                />
              </div>
              <div className="form-group">
                <label>申请原因</label>
                <textarea 
                  value={formData.reason}
                  onChange={e => setFormData({...formData, reason: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>申请人</label>
                <input 
                  type="text"
                  value={formData.applicant}
                  onChange={e => setFormData({...formData, applicant: e.target.value})}
                  required
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">提交申请</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Extensions
