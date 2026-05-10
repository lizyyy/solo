import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { careTasksAPI, hospitalizationsAPI, exportAPI } from '../services/api';
import HospitalizationDetail from '../components/HospitalizationDetail';

function CareTasks() {
  const [tasks, setTasks] = useState([]);
  const [hospitalizations, setHospitalizations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    status: '',
    hospitalization_id: ''
  });

  const [selectedHosp, setSelectedHosp] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksRes, hospsRes] = await Promise.all([
        careTasksAPI.getAll(),
        hospitalizationsAPI.getAll({ status: 'active' })
      ]);
      setTasks(tasksRes.data);
      setHospitalizations(hospsRes.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (filters.status && t.status !== filters.status) return false;
    if (filters.hospitalization_id && t.hospitalization_id !== parseInt(filters.hospitalization_id)) return false;
    return true;
  });

  const getStatusLabel = (status) => {
    const labels = {
      pending: '待处理',
      completed: '已完成'
    };
    return labels[status] || status;
  };

  const handleComplete = async (taskId) => {
    try {
      await careTasksAPI.complete(taskId, {
        completed_by: '当前用户'
      });
      loadData();
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleExport = async () => {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      params.format = 'json';

      const response = await exportAPI.exportCareTasks(params);
      const data = response.data;

      const csv = [
        ['ID', '住院号', '宠物', '笼位', '任务类型', '计划时间',
         '完成时间', '状态', '完成人'].join(','),
        ...data.map(row => [
          row.id,
          row.admission_number,
          row.pet_name,
          row.cage_number,
          row.task_type,
          row.scheduled_time || '',
          row.completed_time || '',
          row.task_status,
          row.completed_by || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `护理任务_${dayjs().format('YYYYMMDD')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败');
    }
  };

  const pendingCount = filteredTasks.filter(t => t.status === 'pending').length;
  const completedCount = filteredTasks.filter(t => t.status === 'completed').length;

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="label">护理任务总数</div>
          <div className="value">{filteredTasks.length}</div>
        </div>
        <div className="stat-card warning">
          <div className="label">待处理</div>
          <div className="value">{pendingCount}</div>
        </div>
        <div className="stat-card">
          <div className="label">已完成</div>
          <div className="value">{completedCount}</div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <label>状态</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">全部状态</option>
            <option value="pending">待处理</option>
            <option value="completed">已完成</option>
          </select>
        </div>
        <div className="filter-group">
          <label>住院病例</label>
          <select
            value={filters.hospitalization_id}
            onChange={(e) => setFilters({ ...filters, hospitalization_id: e.target.value })}
          >
            <option value="">全部病例</option>
            {hospitalizations.map(h => (
              <option key={h.id} value={h.id}>
                {h.admission_number} - {h.pet_name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group" style={{ marginLeft: 'auto' }}>
          <button className="btn btn-primary" onClick={handleExport}>
            📥 导出CSV
          </button>
          <button className="btn btn-secondary" onClick={loadData}>
            🔄 刷新
          </button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h3>护理任务列表</h3>
        </div>

        {filteredTasks.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>住院号</th>
                <th>宠物</th>
                <th>笼位</th>
                <th>任务类型</th>
                <th>计划时间</th>
                <th>状态</th>
                <th>完成时间</th>
                <th>完成人</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(task => (
                <tr key={task.id}>
                  <td
                    style={{ cursor: 'pointer', color: '#667eea', fontWeight: '600' }}
                    onClick={() => setSelectedHosp(task.hospitalization_id)}
                  >
                    {task.admission_number}
                  </td>
                  <td>{task.pet_name}</td>
                  <td>{task.cage_number}</td>
                  <td>{task.task_type}</td>
                  <td>{dayjs(task.scheduled_time).format('YYYY-MM-DD HH:mm')}</td>
                  <td>
                    <span className={`status-badge status-${task.status}`}>
                      {getStatusLabel(task.status)}
                    </span>
                  </td>
                  <td>
                    {task.completed_time
                      ? dayjs(task.completed_time).format('MM-DD HH:mm')
                      : '-'}
                  </td>
                  <td>{task.completed_by || '-'}</td>
                  <td>
                    {task.status === 'pending' && (
                      <button
                        className="btn btn-success"
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                        onClick={() => handleComplete(task.id)}
                      >
                        完成
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="icon">📋</div>
            <p>暂无护理任务</p>
          </div>
        )}
      </div>

      {selectedHosp && (
        <HospitalizationDetail
          hospId={selectedHosp}
          onClose={() => setSelectedHosp(null)}
          onRefresh={loadData}
        />
      )}
    </div>
  );
}

export default CareTasks;
