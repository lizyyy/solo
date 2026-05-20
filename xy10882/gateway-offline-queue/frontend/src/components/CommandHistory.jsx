import React, { useState, useEffect } from 'react'

function CommandHistory({ filter, showAll, onRefresh }) {
  const [commands, setCommands] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchCommands = async () => {
    try {
      const url = showAll ? '/api/commands' : '/api/commands/abnormal'
      const res = await fetch(url)
      const data = await res.json()
      setCommands(data)
    } catch (err) {
      console.error('Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCommands()
  }, [showAll])

  const handleExport = () => {
    window.open('/api/export/commands', '_blank')
  }

  return (
    <div className="section">
      <h2>
        <span>📜 {showAll ? '全部指令列表' : '指令历史轨迹'}</span>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={handleExport}>
            📥 导出 CSV
          </button>
          <button className="refresh-btn" onClick={fetchCommands}>
            🔄 刷新
          </button>
        </div>
      </h2>

      {loading ? (
        <div className="empty-state">加载中...</div>
      ) : commands.length === 0 ? (
        <div className="empty-state">暂无数据</div>
      ) : (
        <table className="command-table">
          <thead>
            <tr>
              <th>指令ID</th>
              <th>设备ID</th>
              <th>类型</th>
              <th>状态</th>
              <th>优先级</th>
              <th>序列号</th>
              <th>创建时间</th>
              <th>执行时间</th>
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
                <td>{cmd.sequence || '-'}</td>
                <td>{new Date(cmd.created_at).toLocaleString()}</td>
                <td>{cmd.executed_at ? new Date(cmd.executed_at).toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default CommandHistory
