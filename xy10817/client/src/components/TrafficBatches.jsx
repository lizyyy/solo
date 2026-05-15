import React, { useState } from 'react'

function TrafficBatches({ batches, onAction }) {
  const [rollbackReason, setRollbackReason] = useState('')
  const [showRollbackModal, setShowRollbackModal] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState(null)

  const handleRollback = () => {
    if (selectedBatch && rollbackReason) {
      onAction(selectedBatch.id, 'rollback', { reason: rollbackReason, operator: 'current_user' })
      setShowRollbackModal(false)
      setRollbackReason('')
      setSelectedBatch(null)
    }
  }

  const openRollbackModal = (batch) => {
    setSelectedBatch(batch)
    setShowRollbackModal(true)
  }

  if (batches.length === 0) {
    return (
      <div className="card">
        <h2>切流批次</h2>
        <div className="empty-state">暂无切流批次</div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>切流批次</h2>
      <table className="table">
        <thead>
          <tr>
            <th>批次名称</th>
            <th>调用系统</th>
            <th>新端点</th>
            <th>切流比例</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {batches.map(batch => (
            <tr key={batch.id}>
              <td>{batch.name}</td>
              <td>{batch.system_name || '-'}</td>
              <td>{batch.endpoint_name || '-'}</td>
              <td>{batch.traffic_percentage}%</td>
              <td>
                <span className={`status-badge status-${batch.status}`}>
                  {batch.status}
                </span>
              </td>
              <td>{new Date(batch.created_at).toLocaleString('zh-CN')}</td>
              <td>
                <div className="action-buttons">
                  {batch.status === 'planned' && (
                    <>
                      <button 
                        className="btn btn-warning btn-sm"
                        onClick={() => onAction(batch.id, 'validate', {})}
                      >
                        验证
                      </button>
                      <button 
                        className="btn btn-success btn-sm"
                        onClick={() => onAction(batch.id, 'status', { status: 'executing' })}
                      >
                        开始执行
                      </button>
                    </>
                  )}
                  {batch.status === 'executing' && (
                    <>
                      <button 
                        className="btn btn-success btn-sm"
                        onClick={() => onAction(batch.id, 'confirm', { operator: 'current_user' })}
                      >
                        确认完成
                      </button>
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => openRollbackModal(batch)}
                      >
                        回滚
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showRollbackModal && (
        <div className="modal-overlay" onClick={() => setShowRollbackModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>确认回滚</h2>
              <button className="modal-close" onClick={() => setShowRollbackModal(false)}>×</button>
            </div>
            <div className="form-group">
              <label>批次名称</label>
              <input type="text" value={selectedBatch?.name || ''} readOnly />
            </div>
            <div className="form-group">
              <label>回滚原因</label>
              <textarea
                value={rollbackReason}
                onChange={e => setRollbackReason(e.target.value)}
                placeholder="请输入回滚原因"
                rows={4}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRollbackModal(false)}>取消</button>
              <button className="btn btn-danger" onClick={handleRollback}>确认回滚</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TrafficBatches
