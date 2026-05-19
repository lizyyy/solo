import React from 'react'

function RequestLogs({ logs }) {
  if (logs.length === 0) {
    return (
      <div className="card">
        <h2>历史轨迹</h2>
        <div className="empty-state">暂无请求记录</div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>历史轨迹</h2>
      <table className="table">
        <thead>
          <tr>
            <th>时间</th>
            <th>批次名称</th>
            <th>调用系统</th>
            <th>状态</th>
            <th>错误信息</th>
            <th>责任节点</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td>{new Date(log.timestamp).toLocaleString('zh-CN')}</td>
              <td>{log.batch_name || '-'}</td>
              <td>{log.system_name || '-'}</td>
              <td>
                <span className={`status-badge status-${log.status}`}>
                  {log.status}
                </span>
              </td>
              <td>{log.error_message || '-'}</td>
              <td>{log.responsible_node || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default RequestLogs
