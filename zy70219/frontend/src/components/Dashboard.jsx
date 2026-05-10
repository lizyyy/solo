import React, { useState, useEffect } from 'react';

function Dashboard({ onViewReservation }) {
  const [stats, setStats] = useState({});
  const [timeline, setTimeline] = useState({ reservations: [], cleanings: [], fireInspections: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, timelineRes] = await Promise.all([
        fetch('/api/reports/dashboard'),
        fetch('/api/reports/timeline')
      ]);
      
      const statsData = await statsRes.json();
      const timelineData = await timelineRes.json();
      
      setStats(statsData);
      setTimeline(timelineData);
    } catch (err) {
      console.error('获取数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeStr) => {
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="dashboard-grid">
        <div className="stat-card primary">
          <div className="label">总预约数</div>
          <div className="value">{stats.totalReservations || 0}</div>
        </div>
        <div className="stat-card warning">
          <div className="label">待审批</div>
          <div className="value">{stats.submittedReservations || 0}</div>
        </div>
        <div className="stat-card success">
          <div className="label">已批准</div>
          <div className="value">{stats.approvedReservations || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">已确认设备占用</div>
          <div className="value">{stats.confirmedEquipmentBookings || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">清洁窗口进行中</div>
          <div className="value">{stats.activeCleaning || 0}</div>
        </div>
        <div className="stat-card danger">
          <div className="label">待消防检查</div>
          <div className="value">{stats.pendingFireInspections || 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>档期时间线（未来7天）</h2>
          <button className="button button-secondary button-sm" onClick={fetchData}>
            刷新
          </button>
        </div>
        <div className="card-body">
          <div className="horizontal-timeline">
            {timeline.reservations.map(r => (
              <div 
                key={`r-${r.id}`} 
                className="timeline-block reservation"
                onClick={() => onViewReservation(r.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="time">
                  {formatTime(r.start_time)} - {formatTime(r.end_time)}
                </div>
                <div className="title">{r.team_name} @ {r.kitchen_name}</div>
                <div className="meta">
                  <span className={`badge badge-${r.status}`}>{r.status}</span>
                </div>
              </div>
            ))}
            {timeline.cleanings.map(c => (
              <div key={`c-${c.id}`} className="timeline-block cleaning">
                <div className="time">
                  {formatTime(c.start_time)} - {formatTime(c.end_time)}
                </div>
                <div className="title">🧹 清洁时间</div>
                <div className="meta">
                  {c.kitchen_name}
                  {c.operator && ` · ${c.operator}`}
                </div>
              </div>
            ))}
            {timeline.fireInspections.map(f => (
              <div key={`f-${f.id}`} className="timeline-block fire">
                <div className="time">{formatTime(f.scheduled_time)}</div>
                <div className="title">🔥 消防检查</div>
                <div className="meta">
                  {f.kitchen_name}
                  {f.inspector && ` · ${f.inspector}`}
                </div>
              </div>
            ))}
            {timeline.reservations.length === 0 && 
             timeline.cleanings.length === 0 && 
             timeline.fireInspections.length === 0 && (
              <div className="empty-state" style={{ width: '100%' }}>
                <h3>暂无档期安排</h3>
                <p>去创建第一个预约或安排清洁/检查吧！</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>关键流程说明</h2>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#f0f9ff', borderRadius: '8px' }}>
              <h4 style={{ color: '#0369a1', marginBottom: '0.5rem' }}>1. 厨房档案</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                先在「厨房档案」页面添加共享厨房和设备，建立基础档案。
              </p>
            </div>
            <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '8px' }}>
              <h4 style={{ color: '#92400e', marginBottom: '0.5rem' }}>2. 预约创建</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                餐饮团队创建预约，选择要使用的设备，系统自动检查冲突。
              </p>
            </div>
            <div style={{ padding: '1rem', background: '#d1fae5', borderRadius: '8px' }}>
              <h4 style={{ color: '#065f46', marginBottom: '0.5rem' }}>3. 档期审批</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                管理员查看卡点和冲突，批准或驳回预约，设备占用自动锁定。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
