import React, { useState, useEffect } from 'react';
import { 
  Package, 
  AlertTriangle, 
  Lock, 
  Wrench, 
  Clock,
  PackageCheck,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { getStatusBadgeClass, getSeverityBadgeClass } from '../utils/api';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await api.get('/api/reports/dashboard');
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem' }}>正在加载数据...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        {error}
      </div>
    );
  }

  const statCards = [
    { 
      label: '总批次数', 
      value: data.stats.totalBatches, 
      icon: <Package size={24} />,
      color: 'primary'
    },
    { 
      label: '活跃批次', 
      value: data.stats.activeBatches, 
      icon: <PackageCheck size={24} />,
      color: 'warning'
    },
    { 
      label: '缺陷总数', 
      value: data.stats.totalDefects, 
      icon: <AlertTriangle size={24} />,
      color: 'danger'
    },
    { 
      label: '隔离数量', 
      value: data.stats.quarantinedQty, 
      icon: <Lock size={24} />,
      color: 'danger'
    },
    { 
      label: '返工中', 
      value: data.stats.reworkInProgress, 
      icon: <Wrench size={24} />,
      color: 'warning'
    },
    { 
      label: '待复判', 
      value: data.stats.pendingReinspection, 
      icon: <Clock size={24} />,
      color: 'primary'
    }
  ];

  const maxDefectValue = Math.max(...data.defectDistribution.map(d => d.total), 1);
  const maxBatchValue = Math.max(...data.batchStatusDistribution.map(b => b.count), 1);

  return (
    <div>
      <div className="page-header">
        <h2>概览仪表盘</h2>
        <button className="btn btn-primary" onClick={loadDashboard}>
          刷新数据
        </button>
      </div>

      <div className="stats-grid">
        {statCards.map((stat, idx) => (
          <div key={idx} className="stat-card">
            <div className="stat-icon">{stat.icon}</div>
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="chart-container">
        <div className="card">
          <h3 className="card-title">缺陷分布</h3>
          {data.defectDistribution.length > 0 ? (
            <div className="bar">
              {data.defectDistribution.map((item, idx) => {
                const height = (item.total / maxDefectValue) * 150;
                return (
                  <div key={idx} className="bar-item">
                    <div className="bar-value">{item.total}</div>
                    <div 
                      className="bar-bar" 
                      style={{ 
                        height: `${height}px`,
                        background: item.severity === '严重' ? '#ef4444' : 
                                   item.severity === '轻微' ? '#10b981' : '#f59e0b'
                      }}
                    ></div>
                    <div className="bar-label">{item.defect_type}</div>
                    <div className="bar-label">
                      <span className={`status-badge ${getSeverityBadgeClass(item.severity)}`}>
                        {item.severity}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">暂无缺陷数据</div>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">批次状态分布</h3>
          {data.batchStatusDistribution.length > 0 ? (
            <div className="bar">
              {data.batchStatusDistribution.map((item, idx) => {
                const height = (item.count / maxBatchValue) * 150;
                return (
                  <div key={idx} className="bar-item">
                    <div className="bar-value">{item.count}</div>
                    <div 
                      className="bar-bar" 
                      style={{ 
                        height: `${height}px`,
                        background: '#2563eb'
                      }}
                    ></div>
                    <div className="bar-label">
                      <span className={`status-badge ${getStatusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">暂无批次数据</div>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title" style={{ marginBottom: 0 }}>最近活动</h3>
          <Link to="/history" className="btn btn-secondary btn-sm">
            查看全部 <ArrowRight size={14} />
          </Link>
        </div>
        <div className="activity-list" style={{ marginTop: '1rem' }}>
          {data.recentActivity.map((activity, idx) => (
            <div key={idx} className="activity-item">
              <div className={`activity-icon ${activity.type === '批次创建' ? 'batch' : activity.type === '缺陷登记' ? 'defect' : 'decision'}`}>
                {activity.type === '批次创建' ? <Package size={18} /> :
                 activity.type === '缺陷登记' ? <AlertTriangle size={18} /> :
                 <PackageCheck size={18} />}
              </div>
              <div className="activity-content">
                <h4>{activity.type}: {activity.reference}</h4>
                <p>{activity.description}</p>
                <small>
                  {activity.operator && `操作人: ${activity.operator} · `}
                  {activity.timestamp}
                </small>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <Link to="/batches" className="btn btn-primary">
          管理批次
        </Link>
        <Link to="/reports" className="btn btn-secondary">
          查看月报
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
