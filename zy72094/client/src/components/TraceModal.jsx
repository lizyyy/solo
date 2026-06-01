import React from 'react'

function TraceModal({ trace, onClose }) {
  return (
    <div className="trace-modal" onClick={onClose}>
      <div className="trace-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600' }}>📜 冲突检测过程追溯</h2>
          <button 
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '6px 12px' }}
          >
            ✕ 关闭
          </button>
        </div>

        <div style={{ 
          background: '#eff6ff', 
          padding: '12px 16px', 
          borderRadius: '8px', 
          marginBottom: '16px',
          border: '1px solid #bfdbfe',
          fontSize: '13px'
        }}>
          <strong>💡 说明:</strong> 以下是本次冲突检测的完整执行流程，每一步都有详细记录。
          每条冲突记录中的「检测步骤」编号可与以下步骤对应。
        </div>

        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {trace.map((step, idx) => (
            <div key={idx} className="trace-step">
              <div className="trace-step-number">
                步骤 #{step.step} - {step.action}
              </div>
              <div className="trace-step-detail">
                {step.detail}
              </div>
              <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                {new Date(step.timestamp).toLocaleTimeString('zh-CN')}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e1e8ed' }}>
          <div style={{ fontSize: '13px', color: '#666' }}>
            共 {trace.length} 个检测步骤 | 生成时间: {new Date().toLocaleString('zh-CN')}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TraceModal
