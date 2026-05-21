import React, { useState, useEffect } from 'react'
import { inventoryApi } from '../services/api'

function Sync() {
  const [sources, setSources] = useState([])
  const [syncLogs, setSyncLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [form, setForm] = useState({ source_id: '', sync_type: 'full', operator: '' })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [sRes, lRes] = await Promise.all([
        inventoryApi.getSources(),
        inventoryApi.getSyncLogs()
      ])
      setSources(sRes.data.data)
      setSyncLogs(lRes.data.data)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async (e) => {
    e.preventDefault()
    try {
      setSyncing(true)
      setError(null)
      await inventoryApi.executeSync(form)
      setSuccess('同步执行成功！')
      loadData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setSyncing(false)
    }
  }

  if (loading) return <div className="loading">加载中...</div>

  return (
    <div>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h2>执行同步</h2>
        </div>
        <div className="card-body">
          <form onSubmit={handleSync}>
            <div className="detail-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>来源系统 *</label>
                <select 
                  value={form.source_id}
                  onChange={e => setForm({...form, source_id: e.target.value})}
                  required
                >
                  <option value="">请选择</option>
                  {sources.map(s => (
                    <option key={s.id} value={s.id} disabled={!s.is_active}>
                      {s.name} ({s.type}) {!s.is_active && '- 已停用'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>同步类型 *</label>
                <select 
                  value={form.sync_type}
                  onChange={e => setForm({...form, sync_type: e.target.value})}
                  required
                >
                  <option value="full">全量同步</option>
                  <option value="incremental">增量同步</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>操作人 *</label>
                <input 
                  type="text" 
                  value={form.operator}
                  onChange={e => setForm({...form, operator: e.target.value})}
                  placeholder="请输入操作人姓名"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary" disabled={syncing}>
                {syncing ? '同步执行中...' : '开始同步'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>同步日志</h2>
          <button className="btn btn-sm" onClick={loadData}>刷新</button>
        </div>
        <div className="card-body">
          {syncLogs.length === 0 ? (
            <div className="empty">暂无同步记录</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>来源系统</th>
                  <th>同步类型</th>
                  <th>状态</th>
                  <th>同步数量</th>
                  <th>开始时间</th>
                  <th>完成时间</th>
                  <th>请求ID</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.map(log => (
                  <tr key={log.id}>
                    <td>{log.source_name}</td>
                    <td>{log.sync_type === 'full' ? '全量' : '增量'}</td>
                    <td>
                      <span className={`badge ${log.status === 'success' ? 'normal' : log.status === 'failed' ? 'critical' : 'pending'}`}>
                        {log.status === 'success' ? '成功' : log.status === 'failed' ? '失败' : '处理中'}
                      </span>
                    </td>
                    <td>{log.record_count || 0}</td>
                    <td>{new Date(log.started_at).toLocaleString()}</td>
                    <td>{log.completed_at ? new Date(log.completed_at).toLocaleString() : '-'}</td>
                    <td style={{ fontSize: '12px', color: '#999' }}>{log.request_id?.substring(0, 12)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default Sync
