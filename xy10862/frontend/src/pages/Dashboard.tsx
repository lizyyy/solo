import { useState, useEffect } from 'react'
import { statsApi, lockApi, abnormalApi, executionLogApi } from '../services/api'
import { Stats, Lock, AbnormalQueue, ExecutionLog } from '../types'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activeLocks, setActiveLocks] = useState<Lock[]>([])
  const [abnormals, setAbnormals] = useState<AbnormalQueue[]>([])
  const [recentLogs, setRecentLogs] = useState<ExecutionLog[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const [statsRes, locksRes, abnormalsRes, logsRes] = await Promise.all([
        statsApi.get(),
        lockApi.getAll({ status: 'acquired' }),
        abnormalApi.getAll({ is_resolved: false }),
        executionLogApi.getAll({ limit: 10 }),
      ])
      setStats(statsRes.data)
      setActiveLocks(locksRes.data)
      setAbnormals(abnormalsRes.data)
      setRecentLogs(logsRes.data)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      success: 'badge-success',
      running: 'badge-running',
      pending: 'badge-pending',
      failed: 'badge-failed',
    }
    return badges[status] || 'badge-pending'
  }

  const getSeverityBadge = (severity: string) => {
    return severity === 'error' ? 'badge-error' : 'badge-warning'
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  return (
    <div>
      <div className="card">
        <h2 className="card-title">📊 系统概览</h2>
        <div className="stats-grid">
          <div className="stat-card success">
            <div className="stat-value">{stats?.active_locks || 0}</div>
            <div className="stat-label">活跃锁</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats?.active_tasks || 0}</div>
            <div className="stat-label">活跃任务</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-value">{stats?.today_executions || 0}</div>
            <div className="stat-label">今日执行</div>
          </div>
          <div className="stat-card error">
            <div className="stat-value">{stats?.unresolved_abnormals || 0}</div>
            <div className="stat-label">未处理异常</div>
          </div>
          <div className="stat-card error">
            <div className="stat-value">{stats?.today_duplicates || 0}</div>
            <div className="stat-label">今日重复拦截</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="card">
          <h2 className="card-title">🔐 当前活跃锁</h2>
          {activeLocks.length === 0 ? (
            <div className="empty-state">暂无活跃锁</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>任务ID</th>
                  <th>实例ID</th>
                  <th>过期时间</th>
                </tr>
              </thead>
              <tbody>
                {activeLocks.map((lock) => (
                  <tr key={lock.id}>
                    <td>{lock.task_id}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{lock.instance_id}</td>
                    <td style={{ fontSize: '12px' }}>
                      {new Date(lock.expires_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2 className="card-title">⚠️ 待处理异常</h2>
          {abnormals.length === 0 ? (
            <div className="empty-state">暂无待处理异常</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>任务</th>
                  <th>类型</th>
                  <th>严重度</th>
                  <th>检测时间</th>
                </tr>
              </thead>
              <tbody>
                {abnormals.slice(0, 5).map((item) => (
                  <tr key={item.id}>
                    <td>{item.task_name || item.task_id}</td>
                    <td>{item.abnormal_type}</td>
                    <td><span className={`badge ${getSeverityBadge(item.severity)}`}>{item.severity}</span></td>
                    <td style={{ fontSize: '12px' }}>
                      {new Date(item.detected_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ marginTop: '16px', textAlign: 'right' }}>
            <Link to="/abnormal" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '14px' }}>
              查看全部 →
            </Link>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">📜 最近执行日志</h2>
        {recentLogs.length === 0 ? (
          <div className="empty-state">暂无执行日志</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>任务ID</th>
                <th>实例ID</th>
                <th>状态</th>
                <th>开始时间</th>
                <th>耗时</th>
                <th>重复</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((log) => (
                <tr key={log.id}>
                  <td>{log.id}</td>
                  <td>{log.task_id}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{log.instance_id}</td>
                  <td><span className={`badge ${getStatusBadge(log.status)}`}>{log.status}</span></td>
                  <td style={{ fontSize: '12px' }}>{new Date(log.started_at).toLocaleString()}</td>
                  <td>{log.duration_seconds ? `${log.duration_seconds.toFixed(2)}s` : '-'}</td>
                  <td>{log.is_duplicate ? <span className="text-danger">是</span> : '否'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
