import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { getStatusBadgeClass, formatDate } from '../utils';

function Dashboard({ currentUser }) {
  const [stats, setStats] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsResponse, appsResponse] = await Promise.all([
          axios.get('/api/dashboard/stats'),
          axios.get('/api/applications')
        ]);
        setStats(statsResponse.data);
        setApplications(appsResponse.data);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredApplications = statusFilter 
    ? applications.filter(app => app.status === statusFilter)
    : applications;

  if (loading) {
    return <div className="loading"><p>加载中...</p></div>;
  }

  const activeStatuses = Object.entries(stats?.by_status || {})
    .filter(([_, data]) => data.count > 0);

  return (
    <div>
      <div className="stats-grid">
        {activeStatuses.map(([status, data]) => (
          <div key={status} className="stat-card" onClick={() => setStatusFilter(statusFilter === status ? '' : status)} style={{ cursor: 'pointer' }}>
            <div className="stat-value">{data.count}</div>
            <div className="stat-label">{data.display_name}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            申请列表
            {statusFilter && <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: '#666' }}>
              (筛选: {stats?.by_status[statusFilter]?.display_name})
            </span>}
          </h3>
          <div>
            {statusFilter && (
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setStatusFilter('')}
                style={{ marginRight: '10px' }}
              >
                清除筛选
              </button>
            )}
            <Link to="/create" className="btn btn-primary btn-sm">
              新建申请
            </Link>
          </div>
        </div>

        {filteredApplications.length === 0 ? (
          <div className="empty-state">
            <p>暂无申请数据</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>申请标题</th>
                <th>店铺</th>
                <th>施工类型</th>
                <th>计划时间</th>
                <th>状态</th>
                <th>申请人</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.map(app => (
                <tr key={app.id}>
                  <td>
                    <Link to={`/application/${app.id}`} style={{ textDecoration: 'none', color: '#333', fontWeight: '500' }}>
                      {app.title}
                    </Link>
                  </td>
                  <td>
                    {app.shop_name} ({app.floor} {app.shop_number})
                  </td>
                  <td>{app.construction_type}</td>
                  <td>
                    <div style={{ fontSize: '0.85rem' }}>
                      <div>开始: {formatDate(app.start_time)}</div>
                      <div>结束: {formatDate(app.end_time)}</div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(app.status)}`}>
                      {app.status_display}
                    </span>
                  </td>
                  <td>{app.creator_name}</td>
                  <td>{formatDate(app.created_at)}</td>
                  <td>
                    <Link to={`/application/${app.id}`} className="btn btn-primary btn-sm">
                      查看详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {stats?.recent_activities?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">最近活动</h3>
          </div>
          <div className="timeline">
            {stats.recent_activities.slice(0, 5).map((activity, index) => (
              <div key={activity.id} className="timeline-item">
                <div className="timeline-dot"></div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <span className="timeline-action">{activity.action_type_display}</span>
                    <span className="timeline-time">{formatDate(activity.created_at)}</span>
                  </div>
                  <div className="timeline-actor">
                    {activity.actor_name} 操作了申请: <strong>{activity.title}</strong>
                  </div>
                  {activity.comment && (
                    <div className="timeline-comment">{activity.comment}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
