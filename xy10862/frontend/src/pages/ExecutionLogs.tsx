import { useState, useEffect } from 'react'
import { executionLogApi } from '../services/api'
import { ExecutionLog } from '../types'

export default function ExecutionLogs() {
  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [filter, setFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const fetchLogs = async () => {
    try {
      const res = await executionLogApi.getAll({ limit: 100 })
      setLogs(res.data)
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const handleExport = async () => {
    try {
      const res = await executionLogApi.export()
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'execution_logs.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Failed to export:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      success: 'badge-success',
      running: 'badge-running',
      pending: 'badge-pending',
      failed: 'badge-failed',
    }
    return badges[status] || 'badge-pending'
  }

  const filteredLogs = filter
    ? logs.filter((log) => log.status === filter)
    : logs

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  return (
    <div>
      <div className="card">
        <div className="filter-bar">
          <h2 className="card-title" style={{ margin: 0 }}>📜 执行日志</h2>
          <div className="flex-spacer" />
          <div className="form-group">
            <select className="form-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">全部状态</option>
              <option value="success">成功</option>
              <option value="running">运行中</option>
              <option value="pending">等待中</option>
              <option value="failed">失败</option>
            </select>
          </div>
          <button className="btn btn-success" onClick={handleExport}>导出CSV</button>
          <button className="btn btn-primary" onClick={fetchLogs}>刷新</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>任务ID</th>
              <th>锁ID</th>
              <th>实例ID</th>
              <th>状态</th>
              <th>开始时间</th>
              <th>完成时间</th>
              <th>耗时</th>
              <th>重复</th>
              <th>错误</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => (
              <tr key={log.id}>
                <td>{log.id}</td>
                <td>{log.task_id}</td>
                <td>{log.lock_id || '-'}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{log.instance_id}</td>
                <td><span className={`badge ${getStatusBadge(log.status)}`}>{log.status}</span></td>
                <td style={{ fontSize: '12px' }}>{new Date(log.started_at).toLocaleString()}</td>
                <td style={{ fontSize: '12px' }}>{log.completed_at ? new Date(log.completed_at).toLocaleString() : '-'}</td>
                <td>{log.duration_seconds ? `${log.duration_seconds.toFixed(2)}s` : '-'}</td>
                <td>{log.is_duplicate ? <span className="text-danger">是</span> : '否'}</td>
                <td style={{ fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {log.error_message || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredLogs.length === 0 && (
          <div className="empty-state">暂无执行日志</div>
        )}
      </div>
    </div>
  )
}
