import React, { useState, useEffect } from 'react'

function CommandDetailModal({ command, onClose, onRefresh }) {
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/commands/${command.id}`)
        const data = await res.json()
        setDetail(data)
      } catch (err) {
        console.error('Failed to fetch detail:', err)
      }
    }
    fetchDetail()
  }, [command.id])

  if (!detail) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📋 指令详情 - {detail.command_id}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="detail-row">
          <div className="detail-label">指令ID</div>
          <div className="detail-value">{detail.command_id}</div>
        </div>

        <div className="detail-row">
          <div className="detail-label">设备ID</div>
          <div className="detail-value">{detail.device_id}</div>
        </div>

        <div className="detail-row">
          <div className="detail-label">指令类型</div>
          <div className="detail-value">{detail.command_type}</div>
        </div>

        <div className="detail-row">
          <div className="detail-label">状态</div>
          <div className="detail-value">
            <span className={`status-badge status-${detail.status}`}>
              {detail.status}
            </span>
          </div>
        </div>

        <div className="detail-row">
          <div className="detail-label">优先级</div>
          <div className="detail-value">{detail.priority}</div>
        </div>

        <div className="detail-row">
          <div className="detail-label">序列号</div>
          <div className="detail-value">{detail.sequence || '-'}</div>
        </div>

        <div className="detail-row">
          <div className="detail-label">创建时间</div>
          <div className="detail-value">{new Date(detail.created_at).toLocaleString()}</div>
        </div>

        <div className="detail-row">
          <div className="detail-label">过期时间</div>
          <div className="detail-value">{new Date(detail.expire_at).toLocaleString()}</div>
        </div>

        {detail.executed_at && (
          <div className="detail-row">
            <div className="detail-label">执行时间</div>
            <div className="detail-value">{new Date(detail.executed_at).toLocaleString()}</div>
          </div>
        )}

        <div className="detail-row">
          <div className="detail-label">指令内容</div>
          <div className="detail-value" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
            {detail.payload}
          </div>
        </div>

        {detail.error_message && (
          <div className="error-text">
            ❌ 错误信息: {detail.error_message}
          </div>
        )}

        {detail.history && detail.history.length > 0 && (
          <>
            <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#fff' }}>📜 状态变更历史</h4>
            <div className="history-timeline">
              {detail.history.map((item, idx) => (
                <div key={idx} className="timeline-item">
                  <div className="timeline-time">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="timeline-content">
                    <div className="status">
                      {item.old_status ? `${item.old_status} → ${item.new_status}` : item.new_status}
                    </div>
                    <div className="desc">{item.description || '-'}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default CommandDetailModal
