import React, { useState, useEffect } from 'react';
import { taskAPI, downloadAPI } from '../api';

const statusConfig = {
  pending: { label: '等待中', color: '#faad14' },
  running: { label: '运行中', color: '#1890ff' },
  completed: { label: '已完成', color: '#52c41a' },
  failed: { label: '失败', color: '#ff4d4f' }
};

function TaskList({ onViewDetail }) {
  const [tasks, setTasks] = useState([]);
  const [filters, setFilters] = useState({ status: '', templateId: '', keyword: '' });
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadTasks();
    const interval = setInterval(loadTasks, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await taskAPI.templates();
      setTemplates(res.data.data);
    } catch (err) {
      console.error('加载模板失败:', err);
    }
  };

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await taskAPI.list(filters);
      setTasks(res.data.data);
    } catch (err) {
      console.error('加载任务失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [filters]);

  const handleRetry = async (taskId) => {
    try {
      await taskAPI.retry(taskId);
      alert('任务重试成功');
      loadTasks();
    } catch (err) {
      alert('重试失败: ' + err.response?.data?.error);
    }
  };

  const handleDownload = async (taskId) => {
    try {
      const res = await taskAPI.authorizeDownload(taskId, { authorizedBy: 'user' });
      downloadAPI.download(res.data.data.token);
    } catch (err) {
      alert('获取下载授权失败: ' + err.response?.data?.error);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>任务列表</h2>
      
      <div style={styles.filters}>
        <select
          style={styles.input}
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">全部状态</option>
          <option value="pending">等待中</option>
          <option value="running">运行中</option>
          <option value="completed">已完成</option>
          <option value="failed">失败</option>
        </select>
        
        <select
          style={styles.input}
          value={filters.templateId}
          onChange={(e) => setFilters({ ...filters, templateId: e.target.value })}
        >
          <option value="">全部模板</option>
          {templates.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        
        <input
          style={styles.input}
          placeholder="搜索任务名称/ID"
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
        />
        
        <button style={styles.button} onClick={loadTasks}>刷新</button>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>任务ID</th>
              <th style={styles.th}>任务名称</th>
              <th style={styles.th}>模板</th>
              <th style={styles.th}>状态</th>
              <th style={styles.th}>进度</th>
              <th style={styles.th}>创建时间</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
            <tr><td colSpan="7" style={styles.td}>加载中...</td></tr>
          ) : tasks.length === 0 ? (
            <tr><td colSpan="7" style={styles.td}>暂无数据</td></tr>
          ) : (
            tasks.map(task => (
              <tr key={task.id} style={styles.tr}>
                <td style={styles.td}>{task.id.substring(0, 20)}...</td>
                <td style={styles.td}>{task.task_name}</td>
                <td style={styles.td}>{task.template_name}</td>
                <td style={styles.td}>
                  <span style={{
                    ...styles.statusBadge,
                    backgroundColor: statusConfig[task.status]?.color
                  }}>
                    {statusConfig[task.status]?.label}
                  </span>
                </td>
                <td style={styles.td}>
                  <div style={styles.progressBar}>
                    <div style={{
                      ...styles.progressFill,
                      width: `${task.progress}%`,
                      backgroundColor: statusConfig[task.status]?.color
                    }} />
                  </div>
                  <span style={styles.progressText}>{task.progress}%</span>
                </td>
                <td style={styles.td}>{new Date(task.created_at).toLocaleString()}</td>
                <td style={styles.td}>
                  <button style={{...styles.smallButton, ...styles.viewButton}} onClick={() => onViewDetail(task.id)}>详情</button>
                  {task.status === 'failed' && (
                    <button style={{...styles.smallButton, ...styles.retryButton}} onClick={() => handleRetry(task.id)}>重试</button>
                  )}
                  {task.status === 'completed' && (
                    <button style={{...styles.smallButton, ...styles.downloadButton}} onClick={() => handleDownload(task.id)}>下载</button>
                  )}
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

const styles = {
  container: { padding: '20px' },
  title: { marginBottom: '20px', color: '#333' },
  filters: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
  input: { padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '4px', fontSize: '14px', minWidth: '150px' },
  button: { padding: '8px 16px', backgroundColor: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  tableContainer: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' },
  th: { padding: '12px', textAlign: 'left', backgroundColor: '#fafafa', borderBottom: '2px solid #f0f0f0', fontWeight: '600' },
  td: { padding: '12px', borderBottom: '1px solid #f0f0f0' },
  tr: { '&:hover': { backgroundColor: '#fafafa' } },
  statusBadge: { padding: '4px 8px', borderRadius: '4px', color: 'white', fontSize: '12px' },
  progressBar: { width: '100px', height: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', overflow: 'hidden', display: 'inline-block', marginRight: '8px' },
  progressFill: { height: '100%', transition: 'width 0.3s ease' },
  progressText: { fontSize: '12px', color: '#666' },
  smallButton: { padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '4px', fontSize: '12px' },
  viewButton: { backgroundColor: '#1890ff', color: 'white' },
  retryButton: { backgroundColor: '#faad14', color: 'white' },
  downloadButton: { backgroundColor: '#52c41a', color: 'white' }
};

export default TaskList;
