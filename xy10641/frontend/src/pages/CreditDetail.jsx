import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

function CreditDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [credit, setCredit] = useState(null)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [approveForm, setApproveForm] = useState({ approver: '李四', remarks: '' })
  const [rejectForm, setRejectForm] = useState({ approver: '李四', remarks: '' })

  useEffect(() => {
    fetchCreditDetail()
  }, [id])

  const fetchCreditDetail = async () => {
    try {
      const res = await axios.get(`/api/credits/${id}`)
      setCredit(res.data)
    } catch (err) {
      console.error('获取授信详情失败:', err)
    }
  }

  const handleApprove = async (e) => {
    e.preventDefault()
    try {
      await axios.post(`/api/credits/${id}/approve`, approveForm)
      setShowApproveModal(false)
      fetchCreditDetail()
    } catch (err) {
      console.error('审批失败:', err)
    }
  }

  const handleReject = async (e) => {
    e.preventDefault()
    try {
      await axios.post(`/api/credits/${id}/reject`, rejectForm)
      setShowRejectModal(false)
      fetchCreditDetail()
    } catch (err) {
      console.error('拒绝失败:', err)
    }
  }

  if (!credit) {
    return <div className="card">加载中...</div>
  }

  return (
    <div>
      <button className="btn" onClick={() => navigate('/credits')}>← 返回列表</button>
      
      <div className="card">
        <div className="card-header">
          <h2>授信详情</h2>
          {credit.status === 'PENDING' && (
            <div className="action-buttons">
              <button className="btn btn-success" onClick={() => setShowApproveModal(true)}>
                通过审批
              </button>
              <button className="btn btn-danger" onClick={() => setShowRejectModal(true)}>
                拒绝审批
              </button>
            </div>
          )}
        </div>

        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">农户姓名</span>
            <span className="detail-value">{credit.farmer_name}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">联系电话</span>
            <span className="detail-value">{credit.farmer_phone}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">农户地址</span>
            <span className="detail-value">{credit.farmer_address}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">授信额度</span>
            <span className="detail-value">¥{credit.credit_limit}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">已用额度</span>
            <span className="detail-value">¥{credit.used_limit}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">可用额度</span>
            <span className="detail-value">¥{credit.credit_limit - credit.used_limit}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">季节</span>
            <span className="detail-value">{credit.season}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">状态</span>
            <span className={`status-badge status-${credit.status}`}>
              {credit.status === 'PENDING' ? '待审批' : 
               credit.status === 'APPROVED' ? '已通过' : '已拒绝'}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">申请人</span>
            <span className="detail-value">{credit.applicant}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">申请时间</span>
            <span className="detail-value">{new Date(credit.apply_time).toLocaleString()}</span>
          </div>
          {credit.approver && (
            <div className="detail-item">
              <span className="detail-label">审批人</span>
              <span className="detail-value">{credit.approver}</span>
            </div>
          )}
        </div>

        {credit.remarks && (
          <div className="detail-item">
            <span className="detail-label">备注</span>
            <span className="detail-value">{credit.remarks}</span>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>变更记录</h2>
        </div>
        {credit.audit_logs && credit.audit_logs.length > 0 ? (
          credit.audit_logs.map(log => (
            <div key={log.id} className="audit-log">
              <div className="audit-log-header">
                <span className="audit-log-field">{log.field_name}</span>
                <span className="audit-log-time">{new Date(log.operate_time).toLocaleString()}</span>
              </div>
              <div className="audit-log-values">
                <span className="audit-log-old">旧值: {log.old_value}</span>
                <span className="audit-log-new">新值: {log.new_value}</span>
              </div>
              <div className="timeline-operator">操作人: {log.operator}</div>
              {log.remarks && <div>备注: {log.remarks}</div>}
            </div>
          ))
        ) : (
          <div className="empty-state">暂无变更记录</div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>操作时间线</h2>
        </div>
        {credit.timelines && credit.timelines.length > 0 ? (
          <div className="timeline">
            {credit.timelines.map(tl => (
              <div key={tl.id} className="timeline-item">
                <div className="timeline-time">{new Date(tl.operate_time).toLocaleString()}</div>
                <div className="timeline-action">{tl.action}</div>
                {tl.details && <div className="timeline-details">{tl.details}</div>}
                <div className="timeline-operator">操作人: {tl.operator}</div>
                {tl.remarks && <div className="timeline-details">备注: {tl.remarks}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">暂无操作记录</div>
        )}
      </div>

      {showApproveModal && (
        <div className="modal-overlay" onClick={() => setShowApproveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>通过授信审批</h3>
              <button className="modal-close" onClick={() => setShowApproveModal(false)}>×</button>
            </div>
            <form onSubmit={handleApprove}>
              <div className="form-group">
                <label>审批人</label>
                <input 
                  type="text"
                  value={approveForm.approver}
                  onChange={e => setApproveForm({...approveForm, approver: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>备注</label>
                <textarea 
                  value={approveForm.remarks}
                  onChange={e => setApproveForm({...approveForm, remarks: e.target.value})}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowApproveModal(false)}>取消</button>
                <button type="submit" className="btn btn-success">确认通过</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>拒绝授信审批</h3>
              <button className="modal-close" onClick={() => setShowRejectModal(false)}>×</button>
            </div>
            <form onSubmit={handleReject}>
              <div className="form-group">
                <label>审批人</label>
                <input 
                  type="text"
                  value={rejectForm.approver}
                  onChange={e => setRejectForm({...rejectForm, approver: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>拒绝原因</label>
                <textarea 
                  value={rejectForm.remarks}
                  onChange={e => setRejectForm({...rejectForm, remarks: e.target.value})}
                  required
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowRejectModal(false)}>取消</button>
                <button type="submit" className="btn btn-danger">确认拒绝</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CreditDetail
