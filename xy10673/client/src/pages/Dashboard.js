import React, { useState, useEffect } from 'react';
import axios from 'axios';
import moment from 'moment';

function Dashboard() {
  const [exceptions, setExceptions] = useState([]);
  const [stats, setStats] = useState({});
  const [filter, setFilter] = useState({ status: '', priority: '' });

  useEffect(() => {
    fetchExceptions();
    fetchStats();
  }, [filter]);

  const fetchExceptions = () => {
    axios.get('/api/exceptions', { params: filter })
      .then(res => setExceptions(res.data))
      .catch(err => console.error(err));
  };

  const fetchStats = () => {
    axios.get('/api/exceptions/stats')
      .then(res => setStats(res.data))
      .catch(err => console.error(err));
  };

  const updateException = (id, status, resolution) => {
    axios.put(`/api/exceptions/${id}`, { 
      status, 
      handled_by: '管理员', 
      resolution 
    })
      .then(() => {
        fetchExceptions();
        fetchStats();
      })
      .catch(err => console.error(err));
  };

  const getPriorityColor = (priority) => {
    const colors = { high: '#e74c3c', medium: '#f39c12', low: '#27ae60' };
    return colors[priority] || '#95a5a6';
  };

  const getStatusColor = (status) => {
    const colors = { open: '#e74c3c', in_progress: '#f39c12', resolved: '#27ae60' };
    return colors[status] || '#95a5a6';
  };

  const getStatusText = (status) => {
    const texts = { open: '待处理', in_progress: '处理中', resolved: '已解决' };
    return texts[status] || status;
  };

  const getTypeText = (type) => {
    const texts = { missed_delivery: '漏投', redelivery: '补投', pause_conflict: '暂停冲突', remaining_negative: '剩余期数异常' };
    return texts[type] || type;
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>异常看板</h2>
      
      <div style={styles.statsGrid}>
        <div style={{...styles.statCard, background: '#e74c3c'}}>
          <div style={styles.statNumber}>{stats.open || 0}</div>
          <div style={styles.statLabel}>待处理异常</div>
        </div>
        <div style={{...styles.statCard, background: '#f39c12'}}>
          <div style={styles.statNumber}>{stats.in_progress || 0}</div>
          <div style={styles.statLabel}>处理中</div>
        </div>
        <div style={{...styles.statCard, background: '#27ae60'}}>
          <div style={styles.statNumber}>{stats.resolved || 0}</div>
          <div style={styles.statLabel}>已解决</div>
        </div>
        <div style={{...styles.statCard, background: '#9b59b6'}}>
          <div style={styles.statNumber}>{stats.high_priority || 0}</div>
          <div style={styles.statLabel}>高优先级</div>
        </div>
      </div>

      <div style={styles.filters}>
        <select 
          style={styles.select} 
          value={filter.status} 
          onChange={(e) => setFilter({...filter, status: e.target.value})}
        >
          <option value="">全部状态</option>
          <option value="open">待处理</option>
          <option value="in_progress">处理中</option>
          <option value="resolved">已解决</option>
        </select>
        <select 
          style={styles.select} 
          value={filter.priority} 
          onChange={(e) => setFilter({...filter, priority: e.target.value})}
        >
          <option value="">全部优先级</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>类型</th>
              <th style={styles.th}>描述</th>
              <th style={styles.th}>状态</th>
              <th style={styles.th}>优先级</th>
              <th style={styles.th}>分配给</th>
              <th style={styles.th}>创建时间</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {exceptions.map(exp => (
              <tr key={exp.id} style={styles.tr}>
                <td style={styles.td}>{exp.id}</td>
                <td style={styles.td}>
                  <span style={{...styles.badge, background: '#3498db'}}>{getTypeText(exp.type)}</span>
                </td>
                <td style={styles.td}>{exp.description}</td>
                <td style={styles.td}>
                  <span style={{...styles.badge, background: getStatusColor(exp.status)}}>
                    {getStatusText(exp.status)}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={{...styles.badge, background: getPriorityColor(exp.priority)}}>
                    {exp.priority === 'high' ? '高' : exp.priority === 'medium' ? '中' : '低'}
                  </span>
                </td>
                <td style={styles.td}>{exp.assigned_to || '-'}</td>
                <td style={styles.td}>{moment(exp.created_at).format('YYYY-MM-DD HH:mm')}</td>
                <td style={styles.td}>
                  {exp.status !== 'resolved' && (
                    <>
                      <button 
                        style={styles.smallBtn} 
                        onClick={() => updateException(exp.id, 'in_progress', '正在处理')}
                      >
                        开始处理
                      </button>
                      <button 
                        style={{...styles.smallBtn, background: '#27ae60', marginLeft: '0.5rem'}} 
                        onClick={() => updateException(exp.id, 'resolved', '已解决')}
                      >
                        解决
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: '1400px', margin: '0 auto' },
  header: { fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem', color: '#2c3e50' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' },
  statCard: { padding: '1.5rem', borderRadius: '8px', color: 'white', textAlign: 'center' },
  statNumber: { fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem' },
  statLabel: { fontSize: '0.875rem', opacity: 0.9 },
  filters: { display: 'flex', gap: '1rem', marginBottom: '1.5rem' },
  select: { padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #ddd', fontSize: '0.875rem' },
  tableContainer: { background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { background: '#f8f9fa', padding: '1rem', textAlign: 'left', fontWeight: 600, color: '#2c3e50', borderBottom: '2px solid #e9ecef' },
  td: { padding: '1rem', borderBottom: '1px solid #eee' },
  tr: { '&:hover': { background: '#f8f9fa' } },
  badge: { padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', color: 'white', fontWeight: 500 },
  smallBtn: { padding: '0.25rem 0.75rem', borderRadius: '4px', border: 'none', background: '#3498db', color: 'white', fontSize: '0.75rem', cursor: 'pointer' }
};

export default Dashboard;
