import { useState, useEffect } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export function Tasks({ onViewDeadLetter }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', taskType: '', businessNo: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFailModal, setShowFailModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [failError, setFailError] = useState('');
  const { showToast } = useToast();

  const [newTask, setNewTask] = useState({
    taskType: 'invoice',
    taskName: '',
    businessNo: '',
    maxRetry: 3,
    hasSideEffect: false,
    sideEffectType: '',
    payload: ''
  });

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await api.getTasks(filters);
      setTasks(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleCreateTask = async () => {
    try {
      let payload;
      try {
        payload = JSON.parse(newTask.payload);
      } catch {
        throw new Error('Payload 必须是有效的 JSON');
      }

      await api.createTask({
        ...newTask,
        payload,
        hasSideEffect: newTask.taskType !== 'invoice'
      });
      showToast('任务创建成功', 'success');
      setShowCreateModal(false);
      loadTasks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleFailTask = async () => {
    try {
      await api.failTask(selectedTask.id, failError || '模拟任务执行失败');
      showToast('任务已进入死信队列', 'success');
      setShowFailModal(false);
      setSelectedTask(null);
      setFailError('');
      loadTasks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const getDefaultPayload = (type) => {
    const templates = {
      invoice: JSON.stringify({
        orderId: 'ORD-TEST-001',
        customerName: '测试用户',
        amount: 1000.00,
        taxRate: 0.13,
        invoiceType: 'normal'
      }, null, 2),
      sms: JSON.stringify({
        messageId: 'MSG-TEST-001',
        phone: '13800138000',
        templateId: 'TPL-TEST',
        content: '这是一条测试短信'
      }, null, 2),
      inventory: JSON.stringify({
        orderId: 'ORD-TEST-001',
        productId: 'PROD-001',
        productName: '测试商品',
        quantity: 1,
        reason: '测试扣减'
      }, null, 2)
    };
    return templates[type] || '{}';
  };

  useEffect(() => {
    if (newTask.taskType && !newTask.payload) {
      setNewTask(prev => ({
        ...prev,
        payload: getDefaultPayload(newTask.taskType)
      }));
    }
  }, [newTask.taskType]);

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2>任务列表</h2>
          <div className="action-bar">
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              + 创建任务
            </button>
            <button className="btn btn-secondary" onClick={() => api.exportData('tasks', filters)}>
              导出
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="filters">
            <div className="filter-group">
              <label>状态:</label>
              <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)}>
                <option value="">全部</option>
                <option value="pending">待处理</option>
                <option value="completed">已完成</option>
                <option value="dead_letter">死信</option>
                <option value="manual_required">需人工</option>
                <option value="closed">已关闭</option>
              </select>
            </div>
            <div className="filter-group">
              <label>类型:</label>
              <select value={filters.taskType} onChange={e => handleFilterChange('taskType', e.target.value)}>
                <option value="">全部</option>
                <option value="invoice">发票</option>
                <option value="sms">短信</option>
                <option value="inventory">库存</option>
              </select>
            </div>
            <div className="filter-group">
              <label>业务号:</label>
              <input
                type="text"
                placeholder="搜索业务号"
                value={filters.businessNo}
                onChange={e => handleFilterChange('businessNo', e.target.value)}
              />
            </div>
          </div>

          {tasks.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>任务名称</th>
                    <th>类型</th>
                    <th>业务号</th>
                    <th>重试次数</th>
                    <th>状态</th>
                    <th>副作用</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(task => (
                    <tr key={task.id}>
                      <td>{task.task_name}</td>
                      <td>
                        <span className={`badge badge-${task.task_type}`}>
                          {getTaskTypeName(task.task_type)}
                        </span>
                      </td>
                      <td>{task.business_no || '-'}</td>
                      <td>{task.retry_count}/{task.max_retry}</td>
                      <td>
                        <span className={`badge badge-${getStatusClass(task.status)}`}>
                          {getStatusName(task.status)}
                        </span>
                      </td>
                      <td>
                        {task.has_side_effect ? (
                          <span className={`badge badge-${task.side_effect_type || 'sms'}`}>
                            有 - {getTaskTypeName(task.side_effect_type || task.task_type)}
                          </span>
                        ) : (
                          <span className="badge badge-closed">无</span>
                        )}
                      </td>
                      <td>{formatDate(task.created_at)}</td>
                      <td>
                        <div className="action-bar">
                          {task.status === 'pending' && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                setSelectedTask(task);
                                setShowFailModal(true);
                              }}
                            >
                              模拟失败
                            </button>
                          )}
                          {(task.status === 'dead_letter' || task.status === 'manual_required') && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => onViewDeadLetter && onViewDeadLetter(task.id)}
                            >
                              查看死信
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="icon">📋</div>
              <div>暂无任务数据</div>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>创建新任务</h3>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>任务类型</label>
                <select
                  value={newTask.taskType}
                  onChange={e => setNewTask(prev => ({ ...prev, taskType: e.target.value, payload: '' }))}
                >
                  <option value="invoice">发票</option>
                  <option value="sms">短信</option>
                  <option value="inventory">库存</option>
                </select>
              </div>
              <div className="form-group">
                <label>任务名称</label>
                <input
                  type="text"
                  value={newTask.taskName}
                  onChange={e => setNewTask(prev => ({ ...prev, taskName: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>业务号</label>
                <input
                  type="text"
                  value={newTask.businessNo}
                  onChange={e => setNewTask(prev => ({ ...prev, businessNo: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>最大重试次数</label>
                <input
                  type="number"
                  value={newTask.maxRetry}
                  onChange={e => setNewTask(prev => ({ ...prev, maxRetry: parseInt(e.target.value) }))}
                />
              </div>
              <div className="form-group">
                <label>Payload (JSON)</label>
                <textarea
                  value={newTask.payload}
                  onChange={e => setNewTask(prev => ({ ...prev, payload: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleCreateTask}>创建</button>
            </div>
          </div>
        </div>
      )}

      {showFailModal && selectedTask && (
        <div className="modal-overlay" onClick={() => setShowFailModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>模拟任务执行失败</h3>
              <button className="close-btn" onClick={() => setShowFailModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {selectedTask.has_side_effect && (
                <div className="risk-warning">
                  <h4>⚠️ 副作用风险提示</h4>
                  <p>
                    此任务类型为 <strong>{getTaskTypeName(selectedTask.side_effect_type || selectedTask.task_type)}</strong>，
                    进入死信队列后可能需要人工处理。重放时请确认是否会产生重复副作用。
                  </p>
                </div>
              )}
              <div className="form-group">
                <label>错误信息 (可选)</label>
                <textarea
                  placeholder="输入模拟的错误信息..."
                  value={failError}
                  onChange={e => setFailError(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="section-title">当前 Payload</div>
              <pre className="json-viewer">
                {JSON.stringify(selectedTask.payload, null, 2)}
              </pre>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowFailModal(false)}>取消</button>
              <button className="btn btn-danger" onClick={handleFailTask}>确认失败</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getTaskTypeName(type) {
  const names = { invoice: '发票', sms: '短信', inventory: '库存' };
  return names[type] || type;
}

function getStatusName(status) {
  const names = {
    pending: '待处理',
    completed: '已完成',
    dead_letter: '死信',
    manual_required: '需人工',
    closed: '已关闭'
  };
  return names[status] || status;
}

function getStatusClass(status) {
  const classes = {
    pending: 'pending',
    completed: 'resolved',
    dead_letter: 'dead-letter',
    manual_required: 'manual-required',
    closed: 'closed'
  };
  return classes[status] || 'closed';
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString('zh-CN');
}
