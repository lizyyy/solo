import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { RectificationTaskWithSuggestion } from '../types';
import {
  problemTypeLabels,
  statusLabels,
  statusColors,
  priorityLabels,
  priorityColors,
  formatDate,
} from '../utils';

export default function TaskList() {
  const [tasks, setTasks] = useState<RectificationTaskWithSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    try {
      setLoading(true);
      const data = await api.getTasks();
      setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredTasks = tasks.filter((t) => {
    const statusMatch = statusFilter === 'all' || t.status === statusFilter;
    const typeMatch = typeFilter === 'all' || t.problemType === typeFilter;
    return statusMatch && typeMatch;
  });

  if (loading) {
    return <div className="card">加载中...</div>;
  }

  return (
    <div>
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 style={{ margin: 0 }}>整改任务列表</h2>
          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
            >
              <option value="all">全部问题类型</option>
              <option value="hose">软管</option>
              <option value="alarm">报警器</option>
              <option value="valve">阀门</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
            >
              <option value="all">全部状态</option>
              <option value="created">待整改</option>
              <option value="scheduled_review">待复查</option>
              <option value="review_failed">复查不通过</option>
              <option value="gas_cut_off">已停气</option>
              <option value="completed">已完成</option>
            </select>
            <button className="btn btn-outline" onClick={loadTasks}>
              刷新
            </button>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>优先级</th>
              <th>商户名称</th>
              <th>问题类型</th>
              <th>问题描述</th>
              <th>状态</th>
              <th>截止日期</th>
              <th>当前卡点</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                  暂无符合条件的整改任务
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <span
                      className="badge"
                      style={{ background: priorityColors[task.suggestion.priority] }}
                    >
                      {priorityLabels[task.suggestion.priority]}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{task.merchantName}</td>
                  <td>{problemTypeLabels[task.problemType]}</td>
                  <td className="text-sm text-muted">{task.problemDescription}</td>
                  <td>
                    <span
                      className="badge"
                      style={{ background: statusColors[task.status] }}
                    >
                      {statusLabels[task.status]}
                    </span>
                  </td>
                  <td>{formatDate(task.deadline)}</td>
                  <td className="text-sm" style={{ maxWidth: '200px' }}>
                    {task.suggestion.currentBlock}
                  </td>
                  <td>
                    <Link to={`/tasks/${task.id}`} className="link">
                      查看详情
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
