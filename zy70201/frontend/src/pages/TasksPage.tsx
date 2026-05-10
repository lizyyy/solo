import { useEffect, useState } from 'react';
import { taskApi, slopeApi, vehicleApi } from '../services/api';
import type { Task, Slope, Vehicle, TaskStatus } from '../types';
import { taskStatusLabels } from '../types';

function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [slopes, setSlopes] = useState<Slope[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<Task | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<Task | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<Task | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState<Task | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [tasksRes, slopesRes, vehiclesRes] = await Promise.all([
        taskApi.getAll(),
        slopeApi.getAll(),
        vehicleApi.getAll()
      ]);
      
      setTasks(tasksRes.data.data);
      setSlopes(slopesRes.data.data);
      setVehicles(vehiclesRes.data.data);
    } catch (error: any) {
      setAlert({ type: 'error', message: '加载数据失败: ' + (error.response?.data?.message || error.message) });
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoSchedule() {
    if (!confirm('确定要执行自动排程吗？系统会自动为积雪厚度不足的雪道分配可用的压雪车。')) return;
    
    try {
      const res = await taskApi.autoSchedule();
      const successCount = res.data.data.filter((r: any) => r.success).length;
      const failCount = res.data.data.filter((r: any) => !r.success).length;
      
      let message = `自动排程完成：成功 ${successCount} 条`;
      if (failCount > 0) message += `，失败 ${failCount} 条`;
      
      setAlert({ type: successCount > 0 ? 'success' : 'error', message });
      loadData();
    } catch (error: any) {
      setAlert({ type: 'error', message: '自动排程失败: ' + (error.response?.data?.message || error.message) });
    }
  }

  async function handleCreateTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const slope = slopes.find(s => s.id === formData.get('slopeId'));
    if (!slope) {
      setAlert({ type: 'error', message: '请选择有效的雪道' });
      return;
    }
    
    const scheduledStart = new Date(formData.get('scheduledStart') as string);
    const scheduledEnd = new Date(formData.get('scheduledEnd') as string);
    
    try {
      await taskApi.create({
        slopeId: formData.get('slopeId') as string,
        scheduledStartTime: scheduledStart.toISOString(),
        scheduledEndTime: scheduledEnd.toISOString(),
        notes: formData.get('notes') as string
      });
      
      setAlert({ type: 'success', message: '任务创建成功' });
      setShowCreateModal(false);
      loadData();
    } catch (error: any) {
      setAlert({ type: 'error', message: '创建失败: ' + (error.response?.data?.message || error.message) });
    }
  }

  async function handleAssignTask(taskId: string, vehicleId: string) {
    try {
      await taskApi.assign(taskId, vehicleId);
      setAlert({ type: 'success', message: '任务分配成功' });
      setShowAssignModal(null);
      loadData();
    } catch (error: any) {
      setAlert({ type: 'error', message: '分配失败: ' + (error.response?.data?.message || error.message) });
    }
  }

  async function handleConfirmTask(taskId: string) {
    try {
      await taskApi.confirm(taskId);
      setAlert({ type: 'success', message: '任务已确认开始执行' });
      loadData();
    } catch (error: any) {
      setAlert({ type: 'error', message: '确认失败: ' + (error.response?.data?.message || error.message) });
    }
  }

  async function handleRejectTask(taskId: string, reason: string) {
    try {
      await taskApi.reject(taskId, reason);
      setAlert({ type: 'success', message: '任务已拒绝' });
      setShowRejectModal(null);
      loadData();
    } catch (error: any) {
      setAlert({ type: 'error', message: '拒绝失败: ' + (error.response?.data?.message || error.message) });
    }
  }

  async function handleCompleteTask(taskId: string, snowThicknessAfter: number, qualityScore: number) {
    try {
      await taskApi.complete(taskId, snowThicknessAfter, qualityScore);
      setAlert({ type: 'success', message: '任务已完成' });
      setShowCompleteModal(null);
      loadData();
    } catch (error: any) {
      setAlert({ type: 'error', message: '完成失败: ' + (error.response?.data?.message || error.message) });
    }
  }

  async function handleCancelTask(taskId: string, reason: string) {
    try {
      await taskApi.cancel(taskId, reason);
      setAlert({ type: 'success', message: '任务已取消' });
      setShowCancelModal(null);
      loadData();
    } catch (error: any) {
      setAlert({ type: 'error', message: '取消失败: ' + (error.response?.data?.message || error.message) });
    }
  }

  async function handleExport(format: 'json' | 'excel') {
    try {
      const res = await taskApi.export(format);
      
      if (format === 'excel') {
        const blob = new Blob([res.data], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tasks-${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        console.log('JSON数据:', res.data);
        alert('JSON数据已输出到控制台');
      }
      
      setAlert({ type: 'success', message: '导出成功' });
    } catch (error: any) {
      setAlert({ type: 'error', message: '导出失败: ' + (error.response?.data?.message || error.message) });
    }
  }

  if (loading) {
    return <div>加载中...</div>;
  }

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);
  const availableVehicles = vehicles.filter(v => v.status === 'AVAILABLE' && !v.assignedTaskId);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">任务排程</h1>
        <div className="action-buttons">
          <button className="btn btn-success" onClick={handleAutoSchedule}>
            🤖 自动排程
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + 新增任务
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport('json')}>
            导出JSON
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport('excel')}>
            导出Excel
          </button>
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.message}
        </div>
      )}

      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-body" style={{ padding: '12px 20px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('all')}
            >
              全部 ({tasks.length})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'PENDING_ASSIGNMENT' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('PENDING_ASSIGNMENT')}
            >
              待分配 ({tasks.filter(t => t.status === 'PENDING_ASSIGNMENT').length})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'PENDING_EXECUTION' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('PENDING_EXECUTION')}
            >
              待执行 ({tasks.filter(t => t.status === 'PENDING_EXECUTION').length})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'IN_PROGRESS' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('IN_PROGRESS')}
            >
              执行中 ({tasks.filter(t => t.status === 'IN_PROGRESS').length})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'COMPLETED' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('COMPLETED')}
            >
              已完成 ({tasks.filter(t => t.status === 'COMPLETED').length})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'REJECTED' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('REJECTED')}
            >
              已拒绝 ({tasks.filter(t => t.status === 'REJECTED').length})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'CANCELLED' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('CANCELLED')}
            >
              已取消 ({tasks.filter(t => t.status === 'CANCELLED').length})
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>雪道</th>
                  <th>车辆</th>
                  <th>计划时间</th>
                  <th>实际时间</th>
                  <th>状态</th>
                  <th>厚度变化</th>
                  <th>改派</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => (
                  <tr key={task.id}>
                    <td>{task.slope?.name}</td>
                    <td>{task.vehicle?.name || '未分配'}</td>
                    <td>
                      <div>{new Date(task.scheduledStartTime).toLocaleString('zh-CN')}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        至 {new Date(task.scheduledEndTime).toLocaleString('zh-CN')}
                      </div>
                    </td>
                    <td>
                      {task.actualStartTime ? (
                        <>
                          <div>{new Date(task.actualStartTime).toLocaleString('zh-CN')}</div>
                          {task.actualEndTime && (
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              至 {new Date(task.actualEndTime).toLocaleString('zh-CN')}
                            </div>
                          )}
                        </>
                      ) : '-'}
                    </td>
                    <td>
                      <span className="badge" style={{ 
                        backgroundColor: getTaskStatusBgColor(task.status),
                        color: getTaskStatusTextColor(task.status)
                      }}>
                        {taskStatusLabels[task.status]}
                      </span>
                      {task.reason && (
                        <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>
                          {task.reason}
                        </div>
                      )}
                    </td>
                    <td>
                      {task.snowThicknessBefore !== undefined ? (
                        <div>
                          {task.snowThicknessBefore}cm
                          {task.snowThicknessAfter !== undefined && (
                            <span> → {task.snowThicknessAfter}cm</span>
                          )}
                          {task.qualityScore !== undefined && (
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              质量: {task.qualityScore}/10
                            </div>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      {task.isReassigned ? (
                        <span className="badge" style={{ backgroundColor: '#fef2f2', color: '#991b1b' }}>
                          是
                        </span>
                      ) : '否'}
                    </td>
                    <td>
                      <div className="action-buttons">
                        {task.status === 'PENDING_ASSIGNMENT' && (
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => setShowAssignModal(task)}
                          >
                            分配
                          </button>
                        )}
                        {task.status === 'PENDING_EXECUTION' && (
                          <>
                            <button 
                              className="btn btn-success btn-sm"
                              onClick={() => handleConfirmTask(task.id)}
                            >
                              确认
                            </button>
                            <button 
                              className="btn btn-danger btn-sm"
                              onClick={() => setShowRejectModal(task)}
                            >
                              拒绝
                            </button>
                          </>
                        )}
                        {task.status === 'IN_PROGRESS' && (
                          <button 
                            className="btn btn-success btn-sm"
                            onClick={() => setShowCompleteModal(task)}
                          >
                            完成
                          </button>
                        )}
                        {['PENDING_ASSIGNMENT', 'PENDING_EXECUTION', 'IN_PROGRESS'].includes(task.status) && (
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => setShowCancelModal(task)}
                          >
                            取消
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateTaskModal
          slopes={slopes}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTask}
        />
      )}

      {showAssignModal && (
        <AssignTaskModal
          task={showAssignModal}
          availableVehicles={availableVehicles}
          onClose={() => setShowAssignModal(null)}
          onSubmit={handleAssignTask}
        />
      )}

      {showRejectModal && (
        <ReasonModal
          title="拒绝任务"
          task={showRejectModal}
          onClose={() => setShowRejectModal(null)}
          onSubmit={(reason) => handleRejectTask(showRejectModal.id, reason)}
        />
      )}

      {showCancelModal && (
        <ReasonModal
          title="取消任务"
          task={showCancelModal}
          onClose={() => setShowCancelModal(null)}
          onSubmit={(reason) => handleCancelTask(showCancelModal.id, reason)}
        />
      )}

      {showCompleteModal && (
        <CompleteTaskModal
          task={showCompleteModal}
          onClose={() => setShowCompleteModal(null)}
          onSubmit={handleCompleteTask}
        />
      )}
    </div>
  );
}

function CreateTaskModal({ slopes, onClose, onSubmit }: {
  slopes: Slope[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(22, 0, 0, 0);
  
  const defaultEnd = new Date(tomorrow);
  defaultEnd.setHours(defaultEnd.getHours() + 3);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">新增压雪任务</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            <div className="alert alert-success">
              💡 提示：压雪任务必须安排在雪道开放时间之外（通常是夜间 22:00 - 次日 08:00）
            </div>
            
            <div className="form-group">
              <label className="form-label">选择雪道</label>
              <select name="slopeId" className="form-select" required>
                <option value="">请选择雪道</option>
                {slopes.map(slope => {
                  const needsGrooming = slope.currentSnowThickness < slope.minSnowThickness;
                  return (
                    <option key={slope.id} value={slope.id}>
                      {slope.name} ({slope.openWindowStart}-{slope.openWindowEnd})
                      {needsGrooming ? ' [需要压雪]' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="form-label">计划开始时间</label>
                <input 
                  type="datetime-local" 
                  name="scheduledStart" 
                  className="form-input"
                  defaultValue={formatDateTimeLocal(tomorrow)}
                  required
                />
              </div>
              <div>
                <label className="form-label">计划结束时间</label>
                <input 
                  type="datetime-local" 
                  name="scheduledEnd" 
                  className="form-input"
                  defaultValue={formatDateTimeLocal(defaultEnd)}
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">备注</label>
              <textarea 
                name="notes" 
                className="form-textarea" 
                rows={3}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary">创建任务</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignTaskModal({ task, availableVehicles, onClose, onSubmit }: {
  task: Task;
  availableVehicles: Vehicle[];
  onClose: () => void;
  onSubmit: (taskId: string, vehicleId: string) => void;
}) {
  const [selectedVehicle, setSelectedVehicle] = useState('');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">分配压雪车</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '16px' }}>
            <strong>任务：</strong> {task.slope?.name}
          </div>
          <div className="form-group">
            <label className="form-label">选择可用车辆</label>
            <select 
              className="form-select" 
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              required
            >
              <option value="">请选择车辆</option>
              {availableVehicles.map(vehicle => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name} ({vehicle.model}, {vehicle.capacityPerHour.toLocaleString()}㎡/h)
                </option>
              ))}
            </select>
            {availableVehicles.length === 0 && (
              <div className="alert alert-error" style={{ marginTop: '12px' }}>
                当前没有可用的压雪车，请等待车辆完成当前任务或维修完成。
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
          <button 
            type="button" 
            className="btn btn-primary"
            disabled={!selectedVehicle}
            onClick={() => onSubmit(task.id, selectedVehicle)}
          >
            确认分配
          </button>
        </div>
      </div>
    </div>
  );
}

function ReasonModal({ title, task, onClose, onSubmit }: {
  title: string;
  task: Task;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '16px' }}>
            <strong>任务：</strong> {task.slope?.name}
          </div>
          <div className="form-group">
            <label className="form-label">请输入原因</label>
            <textarea 
              className="form-textarea" 
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请说明原因..."
            />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
          <button 
            type="button" 
            className="btn btn-danger"
            disabled={!reason.trim()}
            onClick={() => onSubmit(reason)}
          >
            确认{title}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompleteTaskModal({ task, onClose, onSubmit }: {
  task: Task;
  onClose: () => void;
  onSubmit: (taskId: string, snowThicknessAfter: number, qualityScore: number) => void;
}) {
  const [snowThicknessAfter, setSnowThicknessAfter] = useState(task.slope?.targetSnowThickness || 40);
  const [qualityScore, setQualityScore] = useState(8);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">完成任务</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '16px' }}>
            <strong>任务：</strong> {task.slope?.name}
            {task.snowThicknessBefore !== undefined && (
              <div style={{ marginTop: '8px' }}>
                作业前厚度：{task.snowThicknessBefore}cm
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">作业后积雪厚度 (cm)</label>
            <input 
              type="number" 
              className="form-input"
              value={snowThicknessAfter}
              onChange={(e) => setSnowThicknessAfter(parseInt(e.target.value) || 0)}
              min="0"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">质量评分 (1-10)</label>
            <input 
              type="number" 
              className="form-input"
              value={qualityScore}
              onChange={(e) => setQualityScore(parseInt(e.target.value) || 1)}
              min="1"
              max="10"
              required
            />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
          <button 
            type="button" 
            className="btn btn-success"
            onClick={() => onSubmit(task.id, snowThicknessAfter, qualityScore)}
          >
            确认完成
          </button>
        </div>
      </div>
    </div>
  );
}

function getTaskStatusBgColor(status: string) {
  const colors: Record<string, string> = {
    PENDING_ASSIGNMENT: '#fffbeb',
    PENDING_EXECUTION: '#eff6ff',
    IN_PROGRESS: '#ecfdf5',
    COMPLETED: '#f5f3ff',
    REJECTED: '#fef2f2',
    CANCELLED: '#f3f4f6'
  };
  return colors[status] || '#f3f4f6';
}

function getTaskStatusTextColor(status: string) {
  const colors: Record<string, string> = {
    PENDING_ASSIGNMENT: '#92400e',
    PENDING_EXECUTION: '#1e40af',
    IN_PROGRESS: '#065f46',
    COMPLETED: '#5b21b6',
    REJECTED: '#991b1b',
    CANCELLED: '#374151'
  };
  return colors[status] || '#374151';
}

function formatDateTimeLocal(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default TasksPage;
