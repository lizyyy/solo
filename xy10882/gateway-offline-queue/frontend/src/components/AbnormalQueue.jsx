import React, { useState, useEffect } from 'react'
import CommandDetailModal from './CommandDetailModal'

function AbnormalQueue({ onRefresh }) {
  const [commands, setCommands] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCommand, setSelectedCommand] = useState(null)

  const fetchAbnormal = async () => {
    try {
      const res = await fetch('/api/commands/abnormal')
      const data = await res.json()
      setCommands(data)
    } catch (err) {
      console.error('Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAbnormal()
  }, [])

  const handleRetry = async (id) => {
    try {
      await fetch(`/api/commands/${id}/retry`, { method: 'POST' })
      fetchAbnormal()
      onRefresh?.()
    } catch (err) {
      console.error('Retry failed:', err)
    }
  }

  const handleDiscard = async (id) => {
    try {
      await fetch(`/api/commands/${id}/discard`, { method: 'POST' })
      fetchAbnormal()
      onRefresh?.()
    } catch (err) {
      console.error('Discard failed:', err)
    }
  }

  const handleExport = () => {
    window.open('/api/export/commands', '_blank')
  }

  return (
    <div className="section">
      <h2>
        <span>⚠️ 异常指令队列</span>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={handleExport}>
            📥 导出 CSV
          </button>
          <button className="refresh-btn" onClick={fetchAbnormal}>
            🔄 刷新
          </button>
        </div>
      </h2>

      {loading ? (
        <div className="empty-state">加载中...</div>
      ) : commands.length === 0 ? (
        <div className="empty-state">✅ 暂无异常指令</div>
      ) : (
        <table className="command-table">
          <thead>
            <tr>
              <th>指令ID</th>
              <th>设备ID</th>
              <th>类型</th>
              <th>状态</th>
              <th>优先级</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {commands.map((cmd) => (
              <tr key={cmd.id}>
                <td>{cmd.command_id}</td>
                <td>{cmd.device_id}</td>
                <td>{cmd.command_type}</td>
                <td>
                  <span className={`status-badge status-${cmd.status}`}>
                    {cmd.status}
                  </span>
                </td>
                <td>{cmd.priority}</td>
                <td>{new Date(cmd.created_at).toLocaleString()}</td>
                <td className="action-buttons">
                  <button 
                    className="btn btn-small btn-warning"
                    onClick={() => setSelectedCommand(cmd)}
                  >
                    详情
                  </button>
                  {cmd.status === 'failed' && (
                    <button 
                      className="btn btn-small btn-success"
                      onClick={() => handleRetry(cmd.id)}
                    >
                      重试
                    </button>
                  )}
                  <button 
                    className="btn btn-small btn-danger"
                    onClick={() => handleDiscard(cmd.id)}
                  >
                    丢弃
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedCommand && (
        <CommandDetailModal 
          command={selectedCommand} 
          onClose={() => setSelectedCommand(null)}
          onRefresh={() => { fetchAbnormal(); onRefresh?.() }}
        />
      )}
    </div>
  )
}

export default AbnormalQueue
