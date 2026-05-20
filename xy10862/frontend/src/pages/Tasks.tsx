import { useState, useEffect } from 'react'
import { taskApi, lockApi } from '../services/api'
import { Task, TaskDetail } from '../types'

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAcquireModal, setShowAcquireModal] = useState(false)
  const [newTask, setNewTask] = useState({ name: '', description: '', max_execution_time: 300, heartbeat_interval: 30 })
  const [acquireData, setAcquireData] = useState({ task_name: '', instance_id: '' })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const fetchTasks = async () => {
    try {
      const res = await taskApi.getAll()
      setTasks(res.data)
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTaskDetail = async (id: number) => {
    try {
      const res = await taskApi.getById(id)
      setSelectedTask(res.data)
    } catch (error) {
      console.error('Failed to fetch task detail:', error)
    }
  }

  const handleCreateTask = async () => {
    try {
      await taskApi.create(newTask)
      setShowCreateModal(false)
      setNewTask({ name: '', description: '', max_execution_time: 300, heartbeat_interval: 30 })
      fetchTasks()
      setMessage({ text: '任务创建成功', type: 'success' })
    } catch (error: any) {
      setMessage({ text: error.response?.data?.detail || '创建失败', type: 'error' })
    }
    setTimeout(() => setMessage(null), 3000)
  }

  const handleAcquireLock = async () => {
    try {
      const res = await lockApi.acquire(acquireData)
      if (res.data.success) {
        setMessage({ text: res.data.message, type: 'success' })
      } else {
        setMessage({ text: res.data.message, type: 'error' })
      }
      setShowAcquireModal(false)
      setAcquireData({ task_name: '', instance_id: '' })
      if (selectedTask) {
        fetchTaskDetail(selectedTask.id)
      }
    } catch (error: any) {
      setMessage({ text: '抢锁失败', type: 'error' })
    }
    setTimeout(() => setMessage(null), 3000)
  }

  const handleForceRelease = async (lockId: number) => {
    if (!confirm('确定要强制释放该锁吗？这可能导致任务异常！')) return
    try {
      await lockApi.forceRelease(lockId, '手动释放')
      setMessage({ text: '锁已释放', type: 'success' })
      if (selectedTask) {
        fetchTaskDetail(selectedTask.id)
      }
    } catch (error) {
      setMessage({ text: '释放失败', type: 'error' })
    }
    setTimeout(() => setMessage(null), 3000)
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      success: 'badge-success',
      running: 'badge-running',
      failed: 'badge-failed',
    }
    return badges[status] || 'badge-pending'
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 className="card-title" style={{ margin: 0 }}>📋 任务列表</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-success" onClick={() => setShowAcquireModal(true)}>
              模拟抢锁
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              新建任务
            </button>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>名称</th>
              <th>最大执行时间</th>
              <th>心跳间隔</th>
              <th>创建时间</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>{task.id}</td>
                <td><strong>{task.name}</strong></td>
                <td>{task.max_execution_time}s</td>
                <td>{task.heartbeat_interval}s</td>
                <td style={{ fontSize: '12px' }}>{new Date(task.created_at).toLocaleString()}</td>
                <td>
                  <span className={`badge ${task.is_active ? 'badge-success' : 'badge-pending'}`}>
                    {task.is_active ? '活跃' : '停用'}
                  </span>
                </td>
                <td>
                  <button className="btn btn-sm btn-primary" onClick={() => fetchTaskDetail(task.id)}>
                    详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedTask && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 className="card-title" style={{ margin: 0 }}>📝 任务详情: {selectedTask.name}</h2>
            <button className="btn btn-sm" onClick={() => setSelectedTask(null)}>关闭</button>
          </div>

          {selectedTask.current_lock && (
            <div style={{ background: '#fef3c7', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: '#92400e' }}>⚠️ 当前持有锁</strong>
                  <div style={{ fontSize: '14px', color: '#78350f', marginTop: '8px' }}>
                    实例: {selectedTask.current_lock.instance_id} | 
                    获得时间: {new Date(selectedTask.current_lock.acquired_at).toLocaleString()} | 
                    过期时间: {new Date(selectedTask.current_lock.expires_at).toLocaleString()}
                  </div>
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => handleForceRelease(selectedTask.current_lock!.id)}>
                  强制释放
                </button>
              </div>
            </div>
          )}

          <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>最近执行记录</h3>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>实例ID</th>
                <th>状态</th>
                <th>开始时间</th>
                <th>耗时</th>
                <th>重复</th>
              </tr>
            </thead>
            <tbody>
              {selectedTask.recent_logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.id}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{log.instance_id}</td>
                  <td><span className={`badge ${getStatusBadge(log.status)}`}>{log.status}</span></td>
                  <td style={{ fontSize: '12px' }}>{new Date(log.started_at).toLocaleString()}</td>
                  <td>{log.duration_seconds ? `${log.duration_seconds.toFixed(2)}s` : '-'}</td>
                  <td>{log.is_duplicate ? <span className="text-danger">是</span> : '否'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">新建任务</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>&times;</button>
            </div>
            <div className="form-group">
              <label className="form-label">任务名称</label>
              <input className="form-input" value={newTask.name} onChange={(e) => setNewTask({ ...newTask, name: e.target.value })} placeholder="例如: daily_report" />
            </div>
            <div className="form-group">
              <label className="form-label">描述</label>
              <input className="form-input" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="任务描述" />
            </div>
            <div className="form-group">
              <label className="form-label">最大执行时间 (秒)</label>
              <input className="form-input" type="number" value={newTask.max_execution_time} onChange={(e) => setNewTask({ ...newTask, max_execution_time: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label className="form-label">心跳间隔 (秒)</label>
              <input className="form-input" type="number" value={newTask.heartbeat_interval} onChange={(e) => setNewTask({ ...newTask, heartbeat_interval: Number(e.target.value) })} />
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowCreateModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleCreateTask}>创建</button>
            </div>
          </div>
        </div>
      )}

      {showAcquireModal && (
        <div className="modal-overlay" onClick={() => setShowAcquireModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">模拟抢锁</h3>
              <button className="modal-close" onClick={() => setShowAcquireModal(false)}>&times;</button>
            </div>
            <div className="form-group">
              <label className="form-label">任务名称</label>
              <select className="form-select" value={acquireData.task_name} onChange={(e) => setAcquireData({ ...acquireData, task_name: e.target.value })}>
                <option value="">选择任务</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.name}>{task.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">实例ID</label>
              <input className="form-input" value={acquireData.instance_id} onChange={(e) => setAcquireData({ ...acquireData, instance_id: e.target.value })} placeholder="例如: instance-001" />
            </div>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              💡 提示: 使用不同的实例ID多次抢锁，可以测试互斥锁功能
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowAcquireModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleAcquireLock}>抢锁</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
