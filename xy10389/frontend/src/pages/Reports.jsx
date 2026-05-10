import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { hospitalizationsAPI, careTasksAPI, transferRequestsAPI, alertsAPI, exportAPI } from '../services/api';

function Reports() {
  const [hospitalizations, setHospitalizations] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    status: 'active'
  });

  useEffect(() => {
    loadData();
  }, [filters.status]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [hospsRes, tasksRes, transfersRes, alertsRes] = await Promise.all([
        hospitalizationsAPI.getAll({ status: filters.status }),
        careTasksAPI.getAll(),
        transferRequestsAPI.getAll(),
        alertsAPI.getAll()
      ]);
      setHospitalizations(hospsRes.data);
      setTasks(tasksRes.data);
      setTransfers(transfersRes.data);
      setAlerts(alertsRes.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportHosps = async (format = 'csv') => {
    try {
      const params = { format: 'json' };
      if (filters.status) params.status = filters.status;

      const response = await exportAPI.exportHospitalizations(params);
      const data = response.data;

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `住院记录_${dayjs().format('YYYYMMDD')}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const csv = [
          ['住院号', '宠物', '种类', '笼位', '区域', '诊断', '传染病', '传染病类型', '护理等级',
           '入院时间', '预计出院', '实际出院', '主治医生', '状态'].join(','),
          ...data.map(row => [
            row.admission_number,
            row.pet_name,
            row.species,
            row.cage_number,
            row.location || '',
            row.primary_diagnosis || '',
            row.is_infectious,
            row.infectious_disease || '',
            row.care_level || '',
            row.admission_date || '',
            row.expected_discharge_date || '',
            row.actual_discharge_date || '',
            row.attending_vet || '',
            row.hospitalization_status
          ].join(','))
        ].join('\n');

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `住院记录_${dayjs().format('YYYYMMDD')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败');
    }
  };

  const handleExportTasks = async (format = 'csv') => {
    try {
      const params = { format: 'json' };

      const response = await exportAPI.exportCareTasks(params);
      const data = response.data;

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `护理任务_${dayjs().format('YYYYMMDD')}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
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
      }
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败');
    }
  };

  const stats = {
    totalHosps: hospitalizations.length,
    infectious: hospitalizations.filter(h => h.is_infectious).length,
    pendingTasks: tasks.filter(t => t.status === 'pending').length,
    completedTasks: tasks.filter(t => t.status === 'completed').length,
    pendingTransfers: transfers.filter(t => t.status === 'pending').length,
    approvedTransfers: transfers.filter(t => t.status === 'approved').length,
    rejectedTransfers: transfers.filter(t => t.status === 'rejected').length,
    unresolvedAlerts: alerts.filter(a => !a.is_resolved).length
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="filter-bar">
        <div className="filter-group">
          <label>住院状态筛选</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">全部</option>
            <option value="active">在院</option>
            <option value="discharged">已出院</option>
          </select>
        </div>
        <div className="filter-group" style={{ marginLeft: 'auto' }}>
          <button className="btn btn-secondary" onClick={loadData}>
            🔄 刷新数据
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div className="table-container">
          <div className="table-header">
            <h3>📊 数据统计概览</h3>
          </div>
          <div style={{ padding: '20px' }}>
            <div className="stats-grid" style={{ margin: 0 }}>
              <div className="stat-card">
                <div className="label">住院病例</div>
                <div className="value">{stats.totalHosps}</div>
              </div>
              <div className="stat-card warning">
                <div className="label">传染病病例</div>
                <div className="value">{stats.infectious}</div>
              </div>
              <div className="stat-card">
                <div className="label">已完成护理</div>
                <div className="value">{stats.completedTasks}</div>
              </div>
              <div className="stat-card warning">
                <div className="label">待处理护理</div>
                <div className="value">{stats.pendingTasks}</div>
              </div>
              <div className="stat-card warning">
                <div className="label">待审批转笼</div>
                <div className="value">{stats.pendingTransfers}</div>
              </div>
              <div className="stat-card">
                <div className="label">已批准转笼</div>
                <div className="value">{stats.approvedTransfers}</div>
              </div>
              <div className="stat-card">
                <div className="label">已驳回转笼</div>
                <div className="value">{stats.rejectedTransfers}</div>
              </div>
              <div className="stat-card warning">
                <div className="label">未解决异常</div>
                <div className="value">{stats.unresolvedAlerts}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="table-container">
          <div className="table-header">
            <h3>📥 数据导出</h3>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '12px', fontSize: '14px', color: '#333' }}>住院记录</h4>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" onClick={() => handleExportHosps('csv')}>
                  📄 导出CSV
                </button>
                <button className="btn btn-secondary" onClick={() => handleExportHosps('json')}>
                  📋 导出JSON
                </button>
              </div>
            </div>
            <div>
              <h4 style={{ marginBottom: '12px', fontSize: '14px', color: '#333' }}>护理任务</h4>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" onClick={() => handleExportTasks('csv')}>
                  📄 导出CSV
                </button>
                <button className="btn btn-secondary" onClick={() => handleExportTasks('json')}>
                  📋 导出JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="table-container" style={{ marginBottom: '20px' }}>
        <div className="table-header">
          <h3>📋 在院病例详情表</h3>
        </div>
        {hospitalizations.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>住院号</th>
                <th>宠物</th>
                <th>种类</th>
                <th>笼位</th>
                <th>诊断</th>
                <th>传染病</th>
                <th>护理等级</th>
                <th>入院时间</th>
                <th>主治医生</th>
              </tr>
            </thead>
            <tbody>
              {hospitalizations.map(h => (
                <tr key={h.id}>
                  <td style={{ fontWeight: '600' }}>{h.admission_number}</td>
                  <td>{h.pet_name}</td>
                  <td>{h.species_name}</td>
                  <td>{h.cage_number}</td>
                  <td>{h.primary_diagnosis}</td>
                  <td>
                    {h.is_infectious ? (
                      <span className="cage-tag tag-infectious">是</span>
                    ) : '否'}
                  </td>
                  <td>{h.care_level_name || '-'}</td>
                  <td>{dayjs(h.admission_date).format('YYYY-MM-DD HH:mm')}</td>
                  <td>{h.attending_vet || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p>暂无数据</p>
          </div>
        )}
      </div>

      <div className="table-container">
        <div className="table-header">
          <h3>🔄 转笼申请统计</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>住院号</th>
              <th>宠物</th>
              <th>原笼位</th>
              <th>目标笼位</th>
              <th>原因</th>
              <th>申请人</th>
              <th>状态</th>
              <th>审批人</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map(t => (
              <tr key={t.id}>
                <td>{t.admission_number}</td>
                <td>{t.pet_name}</td>
                <td>{t.from_cage_number}</td>
                <td>{t.to_cage_number}</td>
                <td>{t.request_reason || '-'}</td>
                <td>{t.requested_by || '-'}</td>
                <td>
                  <span className={`status-badge status-${t.status}`}>
                    {t.status === 'pending' ? '待处理' :
                     t.status === 'approved' ? '已确认' :
                     t.status === 'rejected' ? '已驳回' :
                     t.status === 'closed' ? '已关闭' : t.status}
                  </span>
                </td>
                <td>{t.reviewed_by || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Reports;
