import React from 'react'

function ExceptionQueue({ exceptions, onRefresh }) {
  if (exceptions.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h2>异常队列</h2>
          <button className="btn btn-secondary btn-sm" onClick={onRefresh}>刷新</button>
        </div>
        <div className="empty-state">暂无异常记录</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>异常队列</h2>
        <button className="btn btn-secondary btn-sm" onClick={onRefresh}>刷新</button>
      </div>
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
          {exceptions.map(ex => (
            <tr key={ex.id}>
              <td>{new Date(ex.timestamp).toLocaleString('zh-CN')}</td>
              <td>{ex.batch_name || '-'}</td>
              <td>{ex.system_name || '-'}</td>
              <td>
                <span className={`status-badge status-${ex.status}`}>
                  {ex.status}
                </span>
              </td>
              <td>{ex.error_message || '-'}</td>
              <td>{ex.responsible_node || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ExceptionQueue
