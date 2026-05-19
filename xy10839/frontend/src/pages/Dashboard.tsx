import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { apiClient } from '../api';
import type { Tenant, ExportTask, ExportStatus } from '../types';

const dataTypeOptions = ['users', 'orders', 'products', 'activity_logs', 'metadata'];

function Dashboard() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tasks, setTasks] = useState<ExportTask[]>([]);
  const [filterTenant, setFilterTenant] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<ExportStatus | ''>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTask, setNewTask] = useState({
    tenantId: '',
    name: '',
    dataTypes: [] as string[],
    createdBy: 'admin'
  });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    const [tenantsData, tasksData] = await Promise.all([
      apiClient.getTenants(),
      apiClient.getTasks()
    ]);
    setTenants(tenantsData);
    setTasks(tasksData);
    if (tenantsData.length > 0 && !newTask.tenantId) {
      setNewTask(prev => ({ ...prev, tenantId: tenantsData[0].id }));
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (filterTenant && t.tenantId !== filterTenant) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => ['pending', 'snapshot', 'packing', 'verifying'].includes(t.status)).length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length
  };

  const handleCreateTask = async () => {
    if (!newTask.tenantId || !newTask.name || newTask.dataTypes.length === 0) {
      alert('请填写完整信息');
      return;
    }
    setIsCreating(true);
    try {
      const result = await apiClient.createTask(newTask);
      setShowCreateModal(false);
      setNewTask({ tenantId: tenants[0]?.id || '', name: '', dataTypes: [], createdBy: 'admin' });
      navigate(`/task/${result.task.id}`);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleDataType = (type: string) => {
    setNewTask(prev => ({
      ...prev,
      dataTypes: prev.dataTypes.includes(type)
        ? prev.dataTypes.filter(t => t !== type)
        : [...prev.dataTypes, type]
    }));
  };

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">总任务数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">进行中</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.completed}</div>
          <div className="stat-label">已完成</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.failed}</div>
          <div className="stat-label">失败</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 className="card-title" style={{ marginBottom: 0 }}>导出任务列表</h2>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + 新建导出任务
          </button>
        </div>

        <div className="filters">
          <div className="filter-item">
            <select
              className="form-select"
              value={filterTenant}
              onChange={e => setFilterTenant(e.target.value)}
            >
              <option value="">全部租户</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <select
              className="form-select"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as ExportStatus | '')}
            >
              <option value="">全部状态</option>
              <option value="pending">等待中</option>
              <option value="snapshot">快照中</option>
              <option value="packing">打包中</option>
              <option value="verifying">校验中</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
            </select>
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-title">暂无任务</div>
            <div>点击右上角按钮创建新的导出任务</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>任务名称</th>
                <th>租户</th>
                <th>状态</th>
                <th>进度</th>
                <th>创建人</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(task => (
                <tr key={task.id}>
                  <td style={{ fontWeight: 500 }}>{task.name}</td>
                  <td>{tenants.find(t => t.id === task.tenantId)?.name || '-'}</td>
                  <td>
                    <span className={`status-badge status-${task.status}`}>
                      {task.status}
                    </span>
                  </td>
                  <td style={{ width: 150 }}>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${task.progress}%` }} />
                    </div>
                    <div style={{ fontSize: 12, textAlign: 'center', marginTop: 4 }}>{task.progress}%</div>
                  </td>
                  <td>{task.createdBy}</td>
                  <td>{dayjs(task.createdAt).format('YYYY-MM-DD HH:mm')}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => navigate(`/task/${task.id}`)}
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: 500, margin: 0 }}>
            <h2 className="card-title">新建导出任务</h2>

            <div className="form-group">
              <label className="form-label">选择租户</label>
              <select
                className="form-select"
                value={newTask.tenantId}
                onChange={e => setNewTask(prev => ({ ...prev, tenantId: e.target.value }))}
              >
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">任务名称</label>
              <input
                type="text"
                className="form-input"
                placeholder="例如：Q4全量数据导出"
                value={newTask.name}
                onChange={e => setNewTask(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">导出数据类型</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {dataTypeOptions.map(type => (
                  <button
                    key={type}
                    className={`btn btn-sm ${newTask.dataTypes.includes(type) ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => toggleDataType(type)}
                    style={{ textTransform: 'capitalize' }}
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateTask}
                disabled={isCreating}
              >
                {isCreating ? '创建中...' : '创建任务'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
