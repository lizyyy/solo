import { useState, useEffect, useCallback } from 'react'
import { 
  FileText, Download, History, Plus, Edit2, Trash2, 
  CheckCircle, XCircle, AlertCircle, Clock, Save, X,
  User, Calendar
} from 'lucide-react'
import { api } from '../api'
import { 
  STATUS_MAP, RISK_LEVEL_MAP, ADOPTION_STATUS_MAP, CLAUSE_TYPE_MAP,
  formatDate, truncateText 
} from '../utils'
import './ContractDetail.css'

export default function ContractDetail({ contract, onRefresh, onShowToast, showHistory, onToggleHistory }) {
  const [contractDetail, setContractDetail] = useState(null)
  const [comments, setComments] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingComment, setEditingComment] = useState(null)
  const [selectedText, setSelectedText] = useState('')

  const loadData = useCallback(async () => {
    if (!contract) return
    setLoading(true)
    try {
      const [detailData, commentsData, historyData] = await Promise.all([
        api.getContract(contract.id),
        api.getComments(contract.id),
        api.getHistory(contract.id)
      ])
      setContractDetail(detailData)
      setComments(commentsData || [])
      setHistory(historyData || [])
    } catch (error) {
      onShowToast('加载数据失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [contract, onShowToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleStatusChange = async (newStatus) => {
    try {
      const result = await api.updateContractStatus(contract.id, newStatus)
      if (result.success) {
        onShowToast('状态更新成功', 'success')
        await loadData()
        await onRefresh()
      } else {
        onShowToast('状态更新失败', 'error')
      }
    } catch (error) {
      onShowToast('状态更新失败：' + error.message, 'error')
    }
  }

  const handleExport = async () => {
    try {
      const result = await api.exportExcel(contract.id)
      if (result.canceled) return
      if (result.success) {
        onShowToast(`导出成功：${result.fileName}（${result.commentCount}条批注）`, 'success')
      } else {
        onShowToast(result.error || '导出失败', 'error')
      }
    } catch (error) {
      onShowToast('导出失败：' + error.message, 'error')
    }
  }

  const handleSaveComment = async (commentData) => {
    try {
      if (!commentData.clause_text?.trim()) {
        onShowToast('条款内容不能为空', 'warning')
        return
      }
      
      const result = await api.saveComment({
        ...commentData,
        contract_id: contract.id
      })
      
      if (result.success) {
        onShowToast('批注保存成功', 'success')
        setShowAddForm(false)
        setSelectedText('')
        await loadData()
        await onRefresh()
      } else {
        onShowToast(result.message || '保存失败', 'error')
      }
    } catch (error) {
      onShowToast('保存失败：' + error.message, 'error')
    }
  }

  const handleUpdateComment = async (commentData) => {
    try {
      if (!commentData.clause_text?.trim()) {
        onShowToast('条款内容不能为空', 'warning')
        return
      }
      
      const result = await api.updateComment(commentData)
      if (result.success) {
        onShowToast('批注更新成功', 'success')
        setEditingComment(null)
        await loadData()
        await onRefresh()
      } else {
        onShowToast(result.message || '更新失败', 'error')
      }
    } catch (error) {
      onShowToast('更新失败：' + error.message, 'error')
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('确定要删除此批注吗？历史记录也将被清除。')) {
      return
    }
    
    try {
      const result = await api.deleteComment(commentId)
      if (result.success) {
        onShowToast('批注删除成功', 'success')
        await loadData()
        await onRefresh()
      } else {
        onShowToast('删除失败', 'error')
      }
    } catch (error) {
      onShowToast('删除失败：' + error.message, 'error')
    }
  }

  const handleTextSelect = (e) => {
    const selection = window.getSelection()
    const text = selection.toString().trim()
    if (text && text.length > 5) {
      setSelectedText(text)
    }
  }

  if (!contractDetail && !loading) {
    return (
      <div className="detail-empty">
        <FileText className="empty-icon" />
        <h3>加载合同详情中...</h3>
      </div>
    )
  }

  const currentStatus = contractDetail?.status || contract.status
  const status = STATUS_MAP[currentStatus] || STATUS_MAP['pending']

  return (
    <div className="contract-detail">
      <div className="detail-header">
        <div className="detail-title">
          <FileText size={24} className="title-icon" />
          <div>
            <h2>{contractDetail?.file_name || contract.file_name}</h2>
            <div className="detail-meta">
              <span>版本 v{contractDetail?.version || contract.version}</span>
              <span>•</span>
              <span>{formatDate(contractDetail?.updated_at || contract.updated_at)}</span>
            </div>
          </div>
        </div>
        
        <div className="detail-actions">
          <div className="status-select-wrapper">
            <span>状态：</span>
            <select 
              className="status-select"
              value={currentStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              style={{ borderColor: status.color, color: status.color }}
            >
              {Object.entries(STATUS_MAP).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
          
          <button 
            className={`btn ${showHistory ? 'btn-primary' : 'btn-secondary'}`}
            onClick={onToggleHistory}
          >
            <History size={16} />
            <span>{showHistory ? '返回批注' : '历史记录'}</span>
          </button>
          
          <button className="btn btn-primary" onClick={handleExport}>
            <Download size={16} />
            <span>导出</span>
          </button>
        </div>
      </div>

      <div className="detail-body">
        {showHistory ? (
          <HistoryPanel history={history} />
        ) : (
          <>
            <div className="panels">
              <div className="panel contract-content">
                <div className="panel-header">
                  <h3>合同内容</h3>
                  <small className="hint">选中文本后可快速添加批注</small>
                </div>
                <div 
                  className="content-body"
                  onMouseUp={handleTextSelect}
                >
                  {contractDetail?.content ? (
                    contractDetail.content.split('\n').map((line, idx) => (
                      <p key={idx} className={line.trim() ? '' : 'empty-line'}>
                        {line || '\u00A0'}
                      </p>
                    ))
                  ) : (
                    <div className="no-content">
                      <FileText className="empty-icon" />
                      <p>暂无合同内容</p>
                    </div>
                  )}
                </div>
                
                {selectedText && (
                  <div className="quick-add">
                    <AlertCircle size={16} />
                    <span className="selected-preview">已选中：{truncateText(selectedText, 60)}</span>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowAddForm(true)}
                    >
                      <Plus size={14} />
                      添加批注
                    </button>
                  </div>
                )}
              </div>

              <div className="panel comments-panel">
                <div className="panel-header">
                  <h3>风险条款批注</h3>
                  <span className="count">{comments.length} 条</span>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowAddForm(true)}
                  >
                    <Plus size={14} />
                    新增
                  </button>
                </div>

                {showAddForm && (
                  <CommentForm 
                    initialData={{ clause_text: selectedText }}
                    onSubmit={handleSaveComment}
                    onCancel={() => {
                      setShowAddForm(false)
                      setSelectedText('')
                    }}
                    mode="add"
                  />
                )}

                {comments.length === 0 && !showAddForm ? (
                  <div className="no-comments">
                    <AlertCircle className="empty-icon" />
                    <p>暂无批注</p>
                    <small>从合同文本中选中内容，或点击"新增"添加批注</small>
                  </div>
                ) : (
                  <div className="comments-list">
                    {comments.map(comment => (
                      editingComment?.id === comment.id ? (
                        <CommentForm 
                          key={comment.id}
                          initialData={comment}
                          onSubmit={handleUpdateComment}
                          onCancel={() => setEditingComment(null)}
                          mode="edit"
                        />
                      ) : (
                        <CommentCard 
                          key={comment.id}
                          comment={comment}
                          onEdit={() => setEditingComment(comment)}
                          onDelete={() => handleDeleteComment(comment.id)}
                          onUpdateStatus={async (newStatus) => {
                            await handleUpdateComment({ id: comment.id, adoption_status: newStatus })
                          }}
                        />
                      )
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function CommentCard({ comment, onEdit, onDelete, onUpdateStatus }) {
  const risk = RISK_LEVEL_MAP[comment.risk_level] || { label: '未设置', color: '#9ca3af' }
  const adoption = ADOPTION_STATUS_MAP[comment.adoption_status] || ADOPTION_STATUS_MAP['pending']
  const clauseType = CLAUSE_TYPE_MAP[comment.clause_type]?.label || '未分类'

  return (
    <div className="comment-card">
      <div className="comment-header">
        <div className="comment-tags">
          <span 
            className="risk-badge"
            style={{ backgroundColor: risk.color + '20', color: risk.color }}
          >
            {risk.label}
          </span>
          <span className="type-badge">{clauseType}</span>
          <span 
            className="version-badge"
            style={{ backgroundColor: adoption.color + '20', color: adoption.color }}
          >
            {adoption.label}
          </span>
        </div>
        <div className="comment-actions">
          <button className="icon-btn" onClick={onEdit} title="编辑">
            <Edit2 size={14} />
          </button>
          <button className="icon-btn danger" onClick={onDelete} title="删除">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="comment-clause">
        <h4>风险条款：</h4>
        <p className="clause-text">{comment.clause_text}</p>
      </div>

      {comment.comment_text && (
        <div className="comment-body">
          <h4>批注意见：</h4>
          <p>{comment.comment_text}</p>
        </div>
      )}

      <div className="comment-footer">
        <div className="comment-meta">
          {comment.reviewer && (
            <span className="meta-item">
              <User size={12} />
              {comment.reviewer}
            </span>
          )}
          {comment.review_date && (
            <span className="meta-item">
              <Calendar size={12} />
              {formatDate(comment.review_date)}
            </span>
          )}
          <span className="meta-item">v{comment.version}</span>
        </div>
        
        <div className="status-actions">
          <button 
            className={`status-btn ${comment.adoption_status === 'accepted' ? 'active' : ''}`}
            onClick={() => onUpdateStatus('accepted')}
            title="采纳"
          >
            <CheckCircle size={14} />
            采纳
          </button>
          <button 
            className={`status-btn ${comment.adoption_status === 'rejected' ? 'active' : ''}`}
            onClick={() => onUpdateStatus('rejected')}
            title="拒绝"
          >
            <XCircle size={14} />
            拒绝
          </button>
          <button 
            className={`status-btn ${comment.adoption_status === 'needs_review' ? 'active' : ''}`}
            onClick={() => onUpdateStatus('needs_review')}
            title="需复核"
          >
            <AlertCircle size={14} />
            复核
          </button>
        </div>
      </div>
    </div>
  )
}

function CommentForm({ initialData, onSubmit, onCancel, mode }) {
  const [formData, setFormData] = useState({
    clause_text: initialData?.clause_text || '',
    clause_type: initialData?.clause_type || '',
    risk_level: initialData?.risk_level || 'medium',
    comment_text: initialData?.comment_text || '',
    reviewer: initialData?.reviewer || '',
    adoption_status: initialData?.adoption_status || 'pending'
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      id: initialData?.id
    })
  }

  return (
    <div className="comment-form">
      <div className="form-header">
        <h4>{mode === 'add' ? '新增批注' : '编辑批注'}</h4>
        <button className="icon-btn" onClick={onCancel}>
          <X size={16} />
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>风险条款内容 *</label>
          <textarea
            value={formData.clause_text}
            onChange={(e) => setFormData({ ...formData, clause_text: e.target.value })}
            rows={3}
            placeholder="输入或粘贴合同条款内容..."
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>条款类型</label>
            <select
              value={formData.clause_type}
              onChange={(e) => setFormData({ ...formData, clause_type: e.target.value })}
            >
              <option value="">请选择</option>
              {Object.entries(CLAUSE_TYPE_MAP).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>风险等级</label>
            <select
              value={formData.risk_level}
              onChange={(e) => setFormData({ ...formData, risk_level: e.target.value })}
            >
              {Object.entries(RISK_LEVEL_MAP).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>批注意见</label>
          <textarea
            value={formData.comment_text}
            onChange={(e) => setFormData({ ...formData, comment_text: e.target.value })}
            rows={3}
            placeholder="输入批注意见、修改建议..."
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>批注人</label>
            <input
              type="text"
              value={formData.reviewer}
              onChange={(e) => setFormData({ ...formData, reviewer: e.target.value })}
              placeholder="批注人姓名"
            />
          </div>

          <div className="form-group">
            <label>采纳状态</label>
            <select
              value={formData.adoption_status}
              onChange={(e) => setFormData({ ...formData, adoption_status: e.target.value })}
            >
              {Object.entries(ADOPTION_STATUS_MAP).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            取消
          </button>
          <button type="submit" className="btn btn-primary">
            <Save size={14} />
            {mode === 'add' ? '保存批注' : '更新批注'}
          </button>
        </div>
      </form>
    </div>
  )
}

function HistoryPanel({ history }) {
  if (history.length === 0) {
    return (
      <div className="history-empty">
        <History className="empty-icon" />
        <h3>暂无历史记录</h3>
        <p>批注的新增、修改、删除都会记录在此处</p>
      </div>
    )
  }

  const grouped = history.reduce((acc, item) => {
    const key = item.comment_id
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  return (
    <div className="history-panel">
      <div className="panel-header">
        <h3>变更历史</h3>
        <span className="count">{history.length} 条记录</span>
      </div>
      
      <div className="history-timeline">
        {Object.entries(grouped).map(([commentId, items]) => (
          <div key={commentId} className="history-group">
            <div className="history-group-header">
              <Clock size={14} />
              <span>批注 #{commentId}</span>
              <span className="history-clause-preview">
                {truncateText(items[0].clause_text, 50)}
              </span>
            </div>
            
            <div className="history-items">
              {items.map((item, idx) => {
                const adoption = ADOPTION_STATUS_MAP[item.adoption_status] || { label: '-', color: '#9ca3af' }
                const risk = RISK_LEVEL_MAP[item.risk_level] || { label: '-', color: '#9ca3af' }
                
                return (
                  <div key={idx} className="history-item">
                    <div className="history-time">
                      {formatDate(item.changed_at)}
                    </div>
                    <div className={`history-type ${item.change_type === 'INSERT' ? 'insert' : 'update'}`}>
                      {item.change_type === 'INSERT' ? '新增' : '修改'}
                    </div>
                    <div className="history-content">
                      {item.comment_text && (
                        <p className="history-comment">{item.comment_text}</p>
                      )}
                      <div className="history-tags">
                        <span style={{ color: risk.color }}>{risk.label}</span>
                        <span style={{ color: adoption.color }}>{adoption.label}</span>
                        <span>v{item.version}</span>
                        {item.reviewer && <span>{item.reviewer}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
