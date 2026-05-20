import { useState, useEffect } from 'react'
import { lockApi } from '../services/api'
import { Lock } from '../types'

export default function Locks() {
  const [locks, setLocks] = useState<Lock[]>([])
  const [filter, setFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const fetchLocks = async () => {
    try {
      const res = await lockApi.getAll()
      setLocks(res.data)
    } catch (error) {
      console.error('Failed to fetch locks:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLocks()
    const interval = setInterval(fetchLocks, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleForceRelease = async (lockId: number) => {
    if (!confirm('确定要强制释放该锁吗？这可能导致任务异常！')) return
    try {
      await lockApi.forceRelease(lockId, '手动释放')
      setMessage({ text: '锁已释放', type: 'success' })
      fetchLocks()
    } catch (error) {
      setMessage({ text: '释放失败', type: 'error' })
    }
    setTimeout(() => setMessage(null), 3000)
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      acquired: 'badge-acquired',
      released: 'badge-released',
      expired: 'badge-expired',
      failed: 'badge-failed',
    }
    return badges[status] || 'badge-pending'
  }

  const filteredLocks = filter
    ? locks.filter((lock) => lock.status === filter)
    : locks

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
          <h2 className="card-title" style={{ margin: 0 }}>🔐 锁列表</h2>
          <div className="flex-spacer" />
          <div className="form-group">
            <select className="form-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">全部状态</option>
              <option value="acquired">持有中</option>
              <option value="released">已释放</option>
              <option value="expired">已过期</option>
              <option value="failed">失败</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={fetchLocks}>刷新</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>任务ID</th>
              <th>实例ID</th>
              <th>状态</th>
              <th>获得时间</th>
              <th>过期时间</th>
              <th>最后心跳</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredLocks.map((lock) => (
              <tr key={lock.id}>
                <td>{lock.id}</td>
                <td>{lock.task_id}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{lock.instance_id}</td>
                <td><span className={`badge ${getStatusBadge(lock.status)}`}>{lock.status}</span></td>
                <td style={{ fontSize: '12px' }}>{new Date(lock.acquired_at).toLocaleString()}</td>
                <td style={{ fontSize: '12px' }}>{new Date(lock.expires_at).toLocaleString()}</td>
                <td style={{ fontSize: '12px' }}>{new Date(lock.last_heartbeat_at).toLocaleString()}</td>
                <td>
                  {lock.status === 'acquired' && (
                    <button className="btn btn-sm btn-danger" onClick={() => handleForceRelease(lock.id)}>
                      强制释放
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredLocks.length === 0 && (
          <div className="empty-state">暂无锁记录</div>
        )}
      </div>
    </div>
  )
}
