import { useState, useEffect } from 'react'
import { abnormalApi } from '../services/api'
import { AbnormalQueue } from '../types'

export default function AbnormalQueuePage() {
  const [abnormals, setAbnormals] = useState<AbnormalQueue[]>([])
  const [filterResolved, setFilterResolved] = useState<string>('false')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const fetchAbnormals = async () => {
    try {
      const res = await abnormalApi.getAll({
        is_resolved: filterResolved === 'true' ? true : filterResolved === 'false' ? false : undefined,
      })
      setAbnormals(res.data)
    } catch (error) {
      console.error('Failed to fetch abnormals:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAbnormals()
  }, [filterResolved])

  const handleResolve = async (id: number) => {
    if (!confirm('确定标记为已解决吗？')) return
    try {
      await abnormalApi.resolve(id, '手动标记解决')
      setMessage({ text: '已标记解决', type: 'success' })
      fetchAbnormals()
    } catch (error) {
      setMessage({ text: '操作失败', type: 'error' })
    }
    setTimeout(() => setMessage(null), 3000)
  }

  const handleExport = async () => {
    try {
      const res = await abnormalApi.export()
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'abnormal_queue.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Failed to export:', error)
    }
  }

  const getSeverityBadge = (severity: string) => {
    return severity === 'error' ? 'badge-error' : 'badge-warning'
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  return (
    <div>
      {message && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '20px',
          borderRadius: '8px',
          background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: message.type === 'success' ? '#166534' : '#991b1b',
        }}>
          {message.text}
        </div>
      )}

      <div className="card">
        <div className="filter-bar">
          <h2 className="card-title" style={{ margin: 0 }}>⚠️ 异常队列</h2>
          <div className="flex-spacer" />
          <div className="form-group">
            <select className="form-select" value={filterResolved} onChange={(e) => setFilterResolved(e.target.value)}>
              <option value="false">未解决</option>
              <option value="true">已解决</option>
              <option value="">全部</option>
            </select>
          </div>
          <button className="btn btn-success" onClick={handleExport}>导出CSV</button>
          <button className="btn btn-primary" onClick={fetchAbnormals}>刷新</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>任务</th>
              <th>实例ID</th>
              <th>异常类型</th>
              <th>描述</th>
              <th>严重度</th>
              <th>检测时间</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {abnormals.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.task_name || item.task_id}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{item.instance_id}</td>
                <td>{item.abnormal_type}</td>
                <td style={{ fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.description || '-'}
                </td>
                <td><span className={`badge ${getSeverityBadge(item.severity)}`}>{item.severity}</span></td>
                <td style={{ fontSize: '12px' }}>{new Date(item.detected_at).toLocaleString()}</td>
                <td>
                  <span className={`badge ${item.is_resolved ? 'badge-success' : 'badge-pending'}`}>
                    {item.is_resolved ? '已解决' : '未解决'}
                  </span>
                </td>
                <td>
                  {!item.is_resolved && (
                    <button className="btn btn-sm btn-success" onClick={() => handleResolve(item.id)}>
                      标记解决
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {abnormals.length === 0 && (
          <div className="empty-state">暂无异常记录</div>
        )}
      </div>
    </div>
  )
}
